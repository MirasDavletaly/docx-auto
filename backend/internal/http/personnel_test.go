package httpapi

import (
	"context"
	"net/http"
	"strings"
	"testing"

	"docflow/internal/service"
)

// Персонал: компания только из токена (CLAUDE.md, п. 3.1), чужое – 404.
func TestAPIPersonnelIsolation(t *testing.T) {
	e := newAPIEnv(t, nil)

	var list struct {
		Items []service.Person `json:"items"`
	}
	res := e.call("dir-a", http.MethodGet, "/api/personnel", nil, nil)
	e.want(res, http.StatusOK)
	e.decode(res, &list)
	if len(list.Items) != 2 {
		t.Fatalf("директор A видит персонал %+v", list.Items)
	}
	var version int32
	for _, p := range list.Items {
		if p.CompanyID != "c-a" {
			t.Fatalf("директор A видит человека компании %s", p.CompanyID)
		}
		if p.ID == "emp-a" {
			version = p.LockVersion
		}
	}
	// Логинов, телефонов и почты в карточке нет.
	if body := res.Body.String(); strings.Contains(body, `"login"`) || strings.Contains(body, `"phone"`) {
		t.Fatalf("в персонале лишнее: %s", body)
	}

	card := map[string]any{"fullName": "Взлом", "fullNameGenitive": "", "position": "", "unit": "", "lockVersion": 0}
	e.want(e.call("dir-a", http.MethodPatch, "/api/personnel/emp-b", card, nil), http.StatusNotFound)
	e.want(e.call("dir-a", http.MethodPatch, "/api/personnel/no-such", card, nil), http.StatusNotFound)
	e.want(e.call("dir-a", http.MethodDelete, "/api/personnel/emp-b?lockVersion=0", nil, nil), http.StatusNotFound)
	e.want(e.call("emp-a", http.MethodPatch, "/api/personnel/emp-a", card, nil), http.StatusForbidden)

	// Компанию нельзя передать в теле – только токен.
	withCompany := map[string]any{"login": "x-b", "fullName": "Чужой", "companyId": "c-b"}
	e.want(e.call("dir-a", http.MethodPost, "/api/personnel", withCompany, nil), http.StatusBadRequest)

	card["fullName"], card["position"], card["lockVersion"] = "Имя emp-a", "Инженер", version
	res = e.call("dir-a", http.MethodPatch, "/api/personnel/emp-a", card, nil)
	e.want(res, http.StatusOK)
	e.want(e.call("dir-a", http.MethodPatch, "/api/personnel/emp-a", card, nil), http.StatusConflict)

	// Сотрудник B ничего этого не заметил.
	res = e.call("dir-b", http.MethodGet, "/api/personnel", nil, nil)
	e.want(res, http.StatusOK)
	e.decode(res, &list)
	for _, p := range list.Items {
		if p.CompanyID != "c-b" || p.FullName == "Взлом" {
			t.Fatalf("персонал B: %+v", list.Items)
		}
	}
}

func TestAPIPersonnelIdempotentCreate(t *testing.T) {
	e := newAPIEnv(t, nil)
	in := map[string]any{"login": "new-person", "fullName": "Новый", "position": "Водитель"}
	key := http.Header{"Idempotency-Key": []string{"person-key-0001"}}

	first := e.call("dir-a", http.MethodPost, "/api/personnel", in, key)
	e.want(first, http.StatusCreated)
	again := e.call("dir-a", http.MethodPost, "/api/personnel", in, key)
	e.want(again, http.StatusCreated)
	if again.Body.String() != first.Body.String() || again.Header().Get("Idempotent-Replayed") != "true" {
		t.Fatalf("повтор не вернул сохранённый ответ: %s", again.Body.String())
	}
	var n int
	if err := e.db.Owner.QueryRow(context.Background(), `SELECT count(*) FROM users WHERE login = 'new-person'`).Scan(&n); err != nil || n != 1 {
		t.Fatalf("заведено %d: %v", n, err)
	}
}
