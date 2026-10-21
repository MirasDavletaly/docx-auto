// Package testdb – база для интеграционных тестов на настоящем PostgreSQL
// (CLAUDE.md, п. 5).
//
// Docker на машине разработчика не работает, поэтому testcontainers не
// подходит: адрес сервера PostgreSQL берётся из DOCFLOW_TEST_DATABASE_URL
// (на машине разработчика – scripts/dev/db.ps1 start). Для каждого теста
// заводится своя чистая база с применёнными миграциями и удаляется после.
package testdb

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"net/url"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"docflow/internal/db"
)

// EnvURL – где искать сервер PostgreSQL для тестов.
const EnvURL = "DOCFLOW_TEST_DATABASE_URL"

// DB – чистая база одного теста.
type DB struct {
	// Owner – владелец схемы: миграции и подготовка данных мимо RLS.
	Owner *pgxpool.Pool
	// App – роль приложения docflow_app: всё, что проверяется, идёт через неё.
	App *pgxpool.Pool
	// OwnerURL – адрес базы от имени владельца.
	OwnerURL string
}

// New заводит базу с миграциями. Без сервера PostgreSQL тест не
// пропускается, а падает: интеграционные тесты – часть проверки.
func New(t *testing.T) *DB {
	t.Helper()
	base := os.Getenv(EnvURL)
	if base == "" {
		t.Fatalf("нет %s: запустите базу для тестов (scripts/dev/db.ps1 start) и задайте адрес", EnvURL)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	admin, err := pgx.Connect(ctx, base)
	if err != nil {
		t.Fatalf("подключение к серверу PostgreSQL: %v", err)
	}
	defer func() { _ = admin.Close(ctx) }()

	name := "docflow_test_" + randomSuffix(t)
	if _, err = admin.Exec(ctx, "CREATE DATABASE "+name); err != nil {
		t.Fatalf("создание базы %s: %v", name, err)
	}

	ownerURL := withDatabase(t, base, name, "")
	if err = db.Migrate(ctx, ownerURL); err != nil {
		t.Fatalf("миграции: %v", err)
	}

	owner, err := pgxpool.New(ctx, ownerURL)
	if err != nil {
		t.Fatalf("пул владельца: %v", err)
	}
	app, err := pgxpool.New(ctx, withDatabase(t, base, name, "docflow_app"))
	if err != nil {
		t.Fatalf("пул приложения: %v", err)
	}

	t.Cleanup(func() {
		app.Close()
		owner.Close()
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		conn, err := pgx.Connect(ctx, base)
		if err != nil {
			t.Errorf("удаление базы %s: %v", name, err)
			return
		}
		defer func() { _ = conn.Close(ctx) }()
		if _, err := conn.Exec(ctx, "DROP DATABASE IF EXISTS "+name+" WITH (FORCE)"); err != nil {
			t.Errorf("удаление базы %s: %v", name, err)
		}
	})

	return &DB{Owner: owner, App: app, OwnerURL: ownerURL}
}

func randomSuffix(t *testing.T) string {
	b := make([]byte, 6)
	if _, err := rand.Read(b); err != nil {
		t.Fatalf("случайное имя базы: %v", err)
	}
	return hex.EncodeToString(b)
}

// withDatabase – тот же сервер, другая база и, если задано, другой пользователь.
func withDatabase(t *testing.T, raw, name, user string) string {
	t.Helper()
	u, err := url.Parse(raw)
	if err != nil {
		t.Fatalf("адрес %s: %v", EnvURL, err)
	}
	u.Path = "/" + name
	if user != "" {
		u.User = url.User(user)
	}
	return u.String()
}
