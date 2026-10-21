package main

import (
	"bytes"
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"docflow/internal/config"
	"docflow/internal/domain"
	"docflow/internal/service"
	"docflow/internal/testdb"
)

func newService(tdb *testdb.DB) *service.Service {
	return service.New(tdb.App, config.Auth{
		JWTSecret: []byte("test-secret-test-secret-test-secret!"), AccessTTL: 10 * time.Minute,
		RefreshTTL: time.Hour, MaxAttempts: 5, LockFor: 15 * time.Minute,
	}, nil)
}

func TestCreateAdminAndResetPassword(t *testing.T) {
	tdb := testdb.New(t)
	ctx := context.Background()
	svc := newService(tdb)
	var out bytes.Buffer

	err := run(ctx, tdb.OwnerURL, []string{"create-admin", "-login", "Miras", "-name", "Мирас"}, strings.NewReader("first-password-1\n"), &out)
	if err != nil {
		t.Fatal(err)
	}
	s, err := svc.Login(ctx, "miras", "first-password-1", "")
	if err != nil {
		t.Fatalf("вход заведённого администратора: %v", err)
	}
	if !s.Me.Platform {
		t.Fatal("не администратор платформы")
	}

	// Второй раз тот же логин – отказ, пароль не меняется.
	if err := run(ctx, tdb.OwnerURL, []string{"create-admin", "-login", "MIRAS", "-name", "X"}, strings.NewReader("other-password-1\n"), &out); err == nil {
		t.Fatal("повторный логин принят")
	}
	// Короткий пароль – отказ.
	if err := run(ctx, tdb.OwnerURL, []string{"reset-password", "-login", "Miras"}, strings.NewReader("short\n"), &out); err == nil {
		t.Fatal("короткий пароль принят")
	}

	if err := run(ctx, tdb.OwnerURL, []string{"reset-password", "-login", "Miras"}, strings.NewReader("second-password-1\r\n"), &out); err != nil {
		t.Fatal(err)
	}
	// Старые сессии закрыты, старый пароль не подходит, новый – подходит.
	if _, err := svc.Authenticate(ctx, s.AccessToken); !errors.Is(err, domain.ErrUnauthorized) {
		t.Fatalf("старый токен: %v", err)
	}
	if _, err := svc.Login(ctx, "Miras", "first-password-1", ""); !errors.Is(err, domain.ErrInvalidCredentials) {
		t.Fatalf("старый пароль: %v", err)
	}
	if _, err := svc.Login(ctx, "Miras", "second-password-1", ""); err != nil {
		t.Fatal(err)
	}
	if err := run(ctx, tdb.OwnerURL, []string{"reset-password", "-login", "nobody"}, strings.NewReader("second-password-1\n"), &out); err == nil {
		t.Fatal("нет логина – а ошибки нет")
	}
}
