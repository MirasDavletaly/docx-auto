package db_test

import (
	"context"
	"testing"

	"github.com/jackc/pgx/v5"

	"docflow/internal/db"
	"docflow/internal/testdb"
)

// Миграции проходят up → down → up (CLAUDE.md, п. 4.10).
func TestMigrationsUpDownUp(t *testing.T) {
	d := testdb.New(t)
	ctx := context.Background()
	if err := db.MigrateDownAll(ctx, d.OwnerURL); err != nil {
		t.Fatalf("down: %v", err)
	}
	if err := db.Migrate(ctx, d.OwnerURL); err != nil {
		t.Fatalf("up после down: %v", err)
	}
	var roles int
	if err := d.Owner.QueryRow(ctx, "SELECT count(*) FROM roles").Scan(&roles); err != nil || roles != 3 {
		t.Fatalf("роли после up: %d, %v", roles, err)
	}
}

// seed – две компании и по человеку в каждой, мимо RLS (владелец схемы).
func seed(t *testing.T, d *testdb.DB) {
	t.Helper()
	ctx := context.Background()
	for _, q := range []string{
		`INSERT INTO companies (id, name, bin) VALUES ('c-a', 'ТОО «А»', '111111111111'), ('c-b', 'ТОО «Б»', '222222222222')`,
		`INSERT INTO users (id, login, display_name, role_id) VALUES
		   ('u-a', 'director-a', 'Директор А', 'director'),
		   ('u-b', 'director-b', 'Директор Б', 'director'),
		   ('u-admin', 'miras', 'Miras', 'platform-admin')`,
		`INSERT INTO user_companies (company_id, user_id) VALUES ('c-a', 'u-a'), ('c-b', 'u-b')`,
		`INSERT INTO audit_log (company_id, user_id, event) VALUES ('c-a', 'u-a', 'x'), ('c-b', 'u-b', 'y')`,
		`INSERT INTO documents (company_id, id, template_id, title, status, author_id, body) VALUES
		   ('c-a', 'd-a', 't', 'Документ А', 'saved', 'u-a', '{}'), ('c-b', 'd-b', 't', 'Документ Б', 'saved', 'u-b', '{}')`,
		`INSERT INTO custom_templates (company_id, id, section_id, title, author_id, body) VALUES
		   ('c-a', 'tpl-a', 'hr', 'Шаблон А', 'u-a', '{}'), ('c-b', 'tpl-b', 'hr', 'Шаблон Б', 'u-b', '{}')`,
		`INSERT INTO archive_files (company_id, id, section_id, title, document_date, file_name, size, sha256, uploaded_by) VALUES
		   ('c-a', 'f-a', 'hr', 'Файл А', '2026-01-01', 'a.pdf', 1, repeat('a', 64), 'u-a'),
		   ('c-b', 'f-b', 'hr', 'Файл Б', '2026-01-01', 'b.pdf', 1, repeat('b', 64), 'u-b')`,
	} {
		if _, err := d.Owner.Exec(ctx, q); err != nil {
			t.Fatalf("подготовка: %v\n%s", err, q)
		}
	}
}

func ids(t *testing.T, d *testdb.DB, tenant db.Tenant, query string) []string {
	t.Helper()
	var out []string
	err := db.InTx(context.Background(), d.App, tenant, func(tx pgx.Tx) error {
		rows, err := tx.Query(context.Background(), query)
		if err != nil {
			return err
		}
		out, err = pgx.CollectRows(rows, pgx.RowTo[string])
		return err
	})
	if err != nil {
		t.Fatalf("%s: %v", query, err)
	}
	return out
}

func TestRowLevelSecurity(t *testing.T) {
	d := testdb.New(t)
	seed(t, d)
	a := db.Tenant{UserID: "u-a", CompanyID: "c-a"}

	t.Run("человек видит только свои компании", func(t *testing.T) {
		got := ids(t, d, a, "SELECT id FROM companies ORDER BY id")
		if len(got) != 1 || got[0] != "c-a" {
			t.Fatalf("компании: %v", got)
		}
	})

	t.Run("людей чужой компании не видно", func(t *testing.T) {
		got := ids(t, d, a, "SELECT id FROM users ORDER BY id")
		if len(got) != 1 || got[0] != "u-a" {
			t.Fatalf("учётные записи: %v", got)
		}
	})

	t.Run("журнал – только своей компании", func(t *testing.T) {
		got := ids(t, d, a, "SELECT event FROM audit_log")
		if len(got) != 1 || got[0] != "x" {
			t.Fatalf("журнал: %v", got)
		}
	})

	t.Run("подставленная чужая компания без доступа не открывает её людей, реквизиты и журнал", func(t *testing.T) {
		// Приложение по ошибке поставило чужую компанию: база её не признаёт.
		wrong := db.Tenant{UserID: "u-a", CompanyID: "c-b"}
		for _, id := range ids(t, d, wrong, "SELECT id FROM companies") {
			if id == "c-b" {
				t.Fatalf("видна чужая компания")
			}
		}
		if got := ids(t, d, wrong, "SELECT id FROM users WHERE id = 'u-b'"); len(got) != 0 {
			t.Fatalf("виден человек чужой компании: %v", got)
		}
		if got := ids(t, d, wrong, "SELECT event FROM audit_log WHERE company_id = 'c-b'"); len(got) != 0 {
			t.Fatalf("виден журнал чужой компании: %v", got)
		}
	})

	t.Run("документы, шаблоны и архив – только своих компаний", func(t *testing.T) {
		for _, q := range []string{"SELECT id FROM documents", "SELECT id FROM custom_templates", "SELECT id FROM archive_files"} {
			got := ids(t, d, a, q)
			if len(got) != 1 || got[0][len(got[0])-1] != 'a' {
				t.Fatalf("%s: %v", q, got)
			}
			if got := ids(t, d, db.Tenant{UserID: "u-a", CompanyID: "c-b"}, q+" WHERE id LIKE '%b'"); len(got) != 0 {
				t.Fatalf("%s: подставленная компания открыла %v", q, got)
			}
		}
		// Записать строку в чужую компанию нельзя.
		err := db.InTx(context.Background(), d.App, a, func(tx pgx.Tx) error {
			_, err := tx.Exec(context.Background(),
				`INSERT INTO documents (company_id, id, template_id, title, status, author_id, body) VALUES ('c-b', 'd-x', 't', 'x', 'draft', 'u-a', '{}')`)
			return err
		})
		if err == nil {
			t.Fatal("документ в чужой компании записан")
		}
	})

	t.Run("без человека не видно ничего", func(t *testing.T) {
		for _, q := range []string{"SELECT id FROM companies", "SELECT id FROM users", "SELECT event FROM audit_log"} {
			if got := ids(t, d, db.Tenant{}, q); len(got) != 0 {
				t.Fatalf("%s: %v", q, got)
			}
		}
	})

	t.Run("администратор платформы видит все компании", func(t *testing.T) {
		got := ids(t, d, db.Tenant{UserID: "u-admin", PlatformAdmin: true}, "SELECT id FROM companies ORDER BY id")
		if len(got) != 2 {
			t.Fatalf("компании администратора: %v", got)
		}
	})

	t.Run("журнал нельзя ни править, ни удалять", func(t *testing.T) {
		for _, q := range []string{"UPDATE audit_log SET event = 'z'", "DELETE FROM audit_log"} {
			err := db.InTx(context.Background(), d.App, db.Tenant{UserID: "u-admin", PlatformAdmin: true}, func(tx pgx.Tx) error {
				_, err := tx.Exec(context.Background(), q)
				return err
			})
			if err == nil {
				t.Fatalf("%s прошёл", q)
			}
		}
	})

	t.Run("роль приложения не обходит RLS", func(t *testing.T) {
		var bypass bool
		if err := d.App.QueryRow(context.Background(), "SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user").Scan(&bypass); err != nil || bypass {
			t.Fatalf("BYPASSRLS у роли приложения: %v, %v", bypass, err)
		}
	})
}
