// Package db – подключение к PostgreSQL, миграции и транзакции с контекстом
// человека и компании.
//
// Главное правило пакета: каждая транзакция с данными выполняет
//
//	SET LOCAL app.user_id, app.company_id, app.platform_admin
//
// из токена (CLAUDE.md, п. 3.1). Политики Row-Level Security в базе
// пропускают только строки этого человека и этой компании; без контекста –
// ничего (по умолчанию запрещено). Сделать запрос мимо этого правила
// можно только явно – функцией NoTenant для входа, когда человек ещё не
// известен.
package db

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"

	"docflow/internal/config"
	"docflow/migrations"
)

// Open открывает пул соединений роли приложения.
//
// statement_timeout ставится на каждое соединение (CLAUDE.md, п. 3.11):
// зависший запрос не держит соединение и запрос пользователя дольше предела.
func Open(ctx context.Context, cfg config.Database) (*pgxpool.Pool, error) {
	pc, err := pgxpool.ParseConfig(cfg.URL)
	if err != nil {
		return nil, fmt.Errorf("строка подключения к базе: %w", err)
	}
	pc.MaxConns = cfg.MaxConns
	pc.ConnConfig.RuntimeParams["statement_timeout"] = fmt.Sprintf("%d", cfg.StatementTimeout.Milliseconds())
	pc.ConnConfig.RuntimeParams["application_name"] = "docflow"

	pool, err := pgxpool.NewWithConfig(ctx, pc)
	if err != nil {
		return nil, fmt.Errorf("пул соединений с базой: %w", err)
	}
	return pool, nil
}

// Migrate применяет все миграции (вверх). Выполняется ролью-владельцем
// базы, а не ролью приложения: у той нет прав менять схему.
func Migrate(ctx context.Context, url string) error {
	return withGoose(url, func(conn *sql.DB) error { return goose.UpContext(ctx, conn, ".") })
}

// MigrateDownAll откатывает все миграции – только для тестов up → down → up.
func MigrateDownAll(ctx context.Context, url string) error {
	return withGoose(url, func(conn *sql.DB) error { return goose.DownToContext(ctx, conn, ".", 0) })
}

func withGoose(url string, run func(*sql.DB) error) error {
	pc, err := pgx.ParseConfig(url)
	if err != nil {
		return fmt.Errorf("строка подключения для миграций: %w", err)
	}
	conn := stdlib.OpenDB(*pc)
	defer func() { _ = conn.Close() }()

	goose.SetBaseFS(migrations.FS)
	goose.SetLogger(goose.NopLogger())
	if err := goose.SetDialect("postgres"); err != nil {
		return fmt.Errorf("диалект миграций: %w", err)
	}
	if err := run(conn); err != nil {
		return fmt.Errorf("миграции: %w", err)
	}
	return nil
}

// Tenant – кто выполняет запрос: из токена, никогда из тела запроса.
type Tenant struct {
	UserID        string
	CompanyID     string
	PlatformAdmin bool
}

// InTx выполняет fn в транзакции с контекстом человека и компании.
func InTx(ctx context.Context, pool *pgxpool.Pool, t Tenant, fn func(pgx.Tx) error) error {
	return inTx(ctx, pool, func(tx pgx.Tx) error {
		admin := "off"
		if t.PlatformAdmin {
			admin = "on"
		}
		// set_config(..., true) – то же, что SET LOCAL, но с параметрами:
		// значения не вставляются в текст запроса.
		if _, err := tx.Exec(ctx,
			`SELECT set_config('app.user_id', $1, true), set_config('app.company_id', $2, true), set_config('app.platform_admin', $3, true)`,
			t.UserID, t.CompanyID, admin,
		); err != nil {
			return fmt.Errorf("контекст транзакции: %w", err)
		}
		return fn(tx)
	})
}

// NoTenant – транзакция без человека: только для входа и обновления токена,
// когда человек ещё не известен. Политики RLS в ней не пропускают ни одной
// строки; работать можно только через функции auth_* базы.
func NoTenant(ctx context.Context, pool *pgxpool.Pool, fn func(pgx.Tx) error) error {
	return inTx(ctx, pool, fn)
}

func inTx(ctx context.Context, pool *pgxpool.Pool, fn func(pgx.Tx) error) (err error) {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("начало транзакции: %w", err)
	}
	defer func() {
		if err != nil {
			// Откат после отмены контекста не нужен: соединение закроется само.
			_ = tx.Rollback(context.WithoutCancel(ctx))
		}
	}()
	if err = fn(tx); err != nil {
		return err
	}
	if err = tx.Commit(ctx); err != nil {
		return fmt.Errorf("фиксация транзакции: %w", err)
	}
	return nil
}

// Ping – проверка готовности для /readyz.
func Ping(pool *pgxpool.Pool) func(ctx context.Context) error {
	return func(ctx context.Context) error {
		ctx, cancel := context.WithTimeout(ctx, 2*time.Second)
		defer cancel()
		return pool.Ping(ctx)
	}
}

// IsUniqueViolation – нарушено уникальное ограничение (логин занят).
func IsUniqueViolation(err error) bool {
	var pgErr interface{ SQLState() string }
	return errors.As(err, &pgErr) && pgErr.SQLState() == "23505"
}
