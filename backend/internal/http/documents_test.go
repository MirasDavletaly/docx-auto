package httpapi

import (
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"strings"
	"testing"

	"docflow/internal/service"
)

// Документы и архив через HTTP (docs/plans/phase-01c-documents.md):
// компания – из токена, чужое – 404, файл – частями.

// in – токен человека в выбранной компании; запросы потом – call(who+"@"+company).
func (e *apiEnv) in(who, company string) string {
	e.t.Helper()
	res := e.call(who, http.MethodPost, "/api/auth/company", map[string]string{"companyId": company}, nil)
	e.want(res, http.StatusOK)
	var s struct {
		AccessToken string `json:"accessToken"`
	}
	e.decode(res, &s)
	key := who + "@" + company
	e.tok[key] = s.AccessToken
	return key
}

func TestAPIDocumentsIsolation(t *testing.T) {
	e := newAPIEnv(t, nil)
	a, b := e.in("dir-a", "c-a"), e.in("dir-b", "c-b")

	doc := map[string]any{
		"templateId": "hr-hire-order", "sectionId": "hr", "title": "Приказ", "description": "", "subject": "",
		"status": "saved", "number": "7", "values": map[string]string{"x": "1"},
		"companySnapshot": map[string]any{"id": "c-a", "lockVersion": 0}, "lockVersion": 0,
	}
	res := e.call(a, http.MethodPut, "/api/documents/d-http-1", doc, nil)
	e.want(res, http.StatusOK)
	var got service.Document
	e.decode(res, &got)
	if got.CompanyID != "c-a" || got.LockVersion != 1 {
		t.Fatalf("документ %+v", got)
	}

	// Компанию в теле не передать: лишнее поле – отказ.
	withCompany := map[string]any{}
	for k, v := range doc {
		withCompany[k] = v
	}
	withCompany["companyId"] = "c-b"
	e.want(e.call(b, http.MethodPut, "/api/documents/d-http-2", withCompany, nil), http.StatusBadRequest)

	// Компания Б: не видит, не правит, не удаляет.
	res = e.call(b, http.MethodGet, "/api/documents", nil, nil)
	e.want(res, http.StatusOK)
	if strings.Contains(res.Body.String(), "d-http-1") {
		t.Fatalf("компания Б видит документ А: %s", res.Body.String())
	}
	doc["lockVersion"] = 1
	e.want(e.call(b, http.MethodPut, "/api/documents/d-http-1", doc, nil), http.StatusNotFound)
	e.want(e.call(b, http.MethodDelete, "/api/documents/d-http-1?lockVersion=1", nil, nil), http.StatusNotFound)

	// Без токена – 401.
	e.want(e.raw(http.MethodGet, "/api/documents", nil, nil), http.StatusUnauthorized)
}

// Карточку компании правили, пока документ был открыт: 409 со своим кодом –
// сайт по нему берёт свежие реквизиты (docs/plans/phase-01e-company-fresh.md).
func TestAPICompanyChanged(t *testing.T) {
	e := newAPIEnv(t, nil)
	a := e.in("dir-a", "c-a")
	doc := func(cardVersion int) map[string]any {
		return map[string]any{
			"templateId": "hr-hire-order", "sectionId": "hr", "title": "Приказ", "description": "", "subject": "",
			"status": "saved", "number": "", "values": map[string]string{},
			"companySnapshot": map[string]any{"id": "c-a", "lockVersion": cardVersion}, "lockVersion": 0,
		}
	}
	if _, err := e.db.Owner.Exec(t.Context(), `UPDATE companies SET lock_version = lock_version + 1 WHERE id = 'c-a'`); err != nil {
		t.Fatal(err)
	}

	res := e.call(a, http.MethodPut, "/api/documents/d-card-1", doc(0), nil)
	e.want(res, http.StatusConflict)
	if !strings.Contains(res.Body.String(), `"code":"company_changed"`) {
		t.Fatalf("ответ: %s", res.Body.String())
	}
	e.want(e.call(a, http.MethodPut, "/api/documents/d-card-1", doc(1), nil), http.StatusOK)
}

func TestAPIArchiveParts(t *testing.T) {
	e := newAPIEnv(t, nil)
	a, b := e.in("dir-a", "c-a"), e.in("dir-b", "c-b")
	data := "%PDF-1.7\n" + strings.Repeat("z", 1000)
	sum := sha256.Sum256([]byte(data))

	res := e.call(a, http.MethodPost, "/api/archive", map[string]any{
		"title": "Скан", "number": "", "documentDate": "2026-02-01", "sectionId": "hr", "description": "",
		"fileName": "scan.pdf", "size": len(data), "sha256": hex.EncodeToString(sum[:]),
	}, nil)
	e.want(res, http.StatusCreated)
	var up service.ArchiveUpload
	e.decode(res, &up)
	if up.Parts != 1 {
		t.Fatalf("загрузка %+v", up)
	}
	// Часть чужой загрузки не принять.
	e.want(e.call(b, http.MethodPut, "/api/archive/"+up.ID+"/parts/0", data, nil), http.StatusNotFound)
	e.want(e.call(a, http.MethodPut, "/api/archive/"+up.ID+"/parts/0", data, nil), http.StatusNoContent)
	e.want(e.call(a, http.MethodPost, "/api/archive/"+up.ID+"/complete", nil, nil), http.StatusOK)

	res = e.call(a, http.MethodGet, "/api/archive/"+up.ID+"/parts/0", nil, nil)
	e.want(res, http.StatusOK)
	if res.Body.String() != data || res.Header().Get("Content-Type") != "application/octet-stream" {
		t.Fatalf("часть файла: %q, %s", res.Body.String()[:20], res.Header().Get("Content-Type"))
	}
	e.want(e.call(b, http.MethodGet, "/api/archive/"+up.ID+"/parts/0", nil, nil), http.StatusNotFound)
}
