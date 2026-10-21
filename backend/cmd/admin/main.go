// Команда admin – обслуживание учётных записей с сервера, мимо сайта.
//
//	create-admin   – первый администратор платформы при установке;
//	reset-password – новый пароль, если администратор свой забыл.
//
// Работает от владельца базы (DATABASE_OWNER_URL), как migrate: на сервере
// ещё нет ни одного человека, от имени которого можно войти. Пароль читается
// из первой строки стандартного ввода – в аргументах и истории команд его нет:
//
//	read -rs PASS; printf '%s\n' "$PASS" | admin create-admin -login Miras -name "Мирас"
package main

import (
	"bufio"
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"docflow/internal/auth"
)

func main() {
	url := os.Getenv("DATABASE_OWNER_URL")
	if url == "" {
		fmt.Fprintln(os.Stderr, "admin: не задан DATABASE_OWNER_URL")
		os.Exit(2)
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()
	if err := run(ctx, url, os.Args[1:], os.Stdin, os.Stdout); err != nil {
		fmt.Fprintf(os.Stderr, "admin: %v\n", err)
		os.Exit(1)
	}
}

var (
	errUsage   = errors.New("команды: create-admin -login L -name N | reset-password -login L (пароль – первой строкой на входе)")
	errNoLogin = errors.New("нужен -login")
	errNoName  = errors.New("нужен -name")
	errExists  = errors.New("логин уже есть; новый пароль – командой reset-password")
	errMissing = errors.New("такого логина нет")
)

func run(ctx context.Context, url string, args []string, stdin io.Reader, stdout io.Writer) error {
	if len(args) == 0 {
		return errUsage
	}
	fs := flag.NewFlagSet(args[0], flag.ContinueOnError)
	login := fs.String("login", "", "логин")
	name := fs.String("name", "", "имя, как его видят в журнале")
	if err := fs.Parse(args[1:]); err != nil {
		return err
	}
	*login = strings.TrimSpace(*login)
	if *login == "" {
		return errNoLogin
	}

	password, err := readPassword(stdin)
	if err != nil {
		return err
	}
	if err = auth.CheckPasswordPolicy(password); err != nil {
		return err
	}
	hash, err := auth.HashPassword(password)
	if err != nil {
		return err
	}

	conn, err := pgx.Connect(ctx, url)
	if err != nil {
		return fmt.Errorf("подключение к базе: %w", err)
	}
	defer func() { _ = conn.Close(ctx) }()

	switch args[0] {
	case "create-admin":
		if strings.TrimSpace(*name) == "" {
			return errNoName
		}
		return createAdmin(ctx, conn, *login, strings.TrimSpace(*name), hash, stdout)
	case "reset-password":
		return resetPassword(ctx, conn, *login, hash, stdout)
	default:
		return errUsage
	}
}

func readPassword(r io.Reader) (string, error) {
	line, err := bufio.NewReader(r).ReadString('\n')
	if err != nil && !errors.Is(err, io.EOF) {
		return "", fmt.Errorf("чтение пароля: %w", err)
	}
	return strings.TrimRight(line, "\r\n"), nil
}

func createAdmin(ctx context.Context, conn *pgx.Conn, login, name, hash string, out io.Writer) error {
	id, err := auth.NewID("u")
	if err != nil {
		return err
	}
	return pgx.BeginFunc(ctx, conn, func(tx pgx.Tx) error {
		var exists bool
		if err := tx.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM users WHERE lower(login) = lower($1) AND deleted_at IS NULL)`, login).Scan(&exists); err != nil {
			return err
		}
		if exists {
			return fmt.Errorf("%q: %w", login, errExists)
		}
		if _, err := tx.Exec(ctx,
			`INSERT INTO users (id, login, display_name, password_hash, role_id) VALUES ($1, $2, $3, $4, 'platform-admin')`,
			id, login, name, hash); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx,
			`INSERT INTO audit_log (user_id, user_name, event, target) VALUES ($1, $2, 'admin.cli.create', $3)`,
			id, name, login); err != nil {
			return err
		}
		_, err := fmt.Fprintf(out, "администратор %s заведён\n", login)
		return err
	})
}

// resetPassword – новый пароль: все сессии человека закрываются, блокировка
// входа снимается.
func resetPassword(ctx context.Context, conn *pgx.Conn, login, hash string, out io.Writer) error {
	return pgx.BeginFunc(ctx, conn, func(tx pgx.Tx) error {
		var id, name string
		err := tx.QueryRow(ctx,
			`UPDATE users SET password_hash = $2, token_version = token_version + 1, failed_attempts = 0, locked_until = NULL, updated_at = now()
			 WHERE lower(login) = lower($1) AND deleted_at IS NULL RETURNING id, display_name`, login, hash).Scan(&id, &name)
		if errors.Is(err, pgx.ErrNoRows) {
			return fmt.Errorf("%q: %w", login, errMissing)
		}
		if err != nil {
			return err
		}
		if _, err = tx.Exec(ctx,
			`INSERT INTO audit_log (user_id, user_name, event, target) VALUES ($1, $2, 'admin.cli.reset-password', $3)`,
			id, name, login); err != nil {
			return err
		}
		_, err = fmt.Fprintf(out, "пароль %s заменён\n", login)
		return err
	})
}
