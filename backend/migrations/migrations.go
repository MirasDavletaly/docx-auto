// Package migrations встраивает миграции базы в программу: сервер и команда
// migrate несут их с собой, отдельные файлы на сервер класть не нужно.
//
// Применённую миграцию не правят – только новая (CLAUDE.md, п. 4.10).
package migrations

import "embed"

// FS – все файлы миграций goose (*.sql).
//
//go:embed *.sql
var FS embed.FS
