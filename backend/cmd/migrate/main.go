// Команда migrate применяет миграции базы.
//
// Запускается владельцем базы (DATABASE_OWNER_URL), а не ролью приложения:
// у роли приложения нет прав менять схему. Остальные настройки процесса ей
// не нужны, поэтому общая загрузка конфигурации здесь не используется.
//
//	DATABASE_OWNER_URL=postgres://postgres:...@db:5432/docflow migrate
package main

import (
	"context"
	"fmt"
	"os"
	"time"

	"docflow/internal/db"
)

func main() {
	url := os.Getenv("DATABASE_OWNER_URL")
	if url == "" {
		fmt.Fprintln(os.Stderr, "migrate: не задан DATABASE_OWNER_URL")
		os.Exit(2)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()
	if err := db.Migrate(ctx, url); err != nil {
		fmt.Fprintf(os.Stderr, "migrate: %v\n", err)
		os.Exit(1)
	}
	fmt.Println("migrate: база в актуальном виде")
}
