package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"

	"docflow/internal/auth"
	"docflow/internal/domain"
	"docflow/internal/service"
	"docflow/internal/testdb"
)

const apiPass = "test-password-123"

// apiEnv – настоящий маршрутизатор на настоящей базе: компании A и B,
// администратор, директор и работник в каждой.
type apiEnv struct {
	t   *testing.T
	h   http.Handler
	db  *testdb.DB
	tok map[string]string
}

func validBIN(t *testing.T, prefix string) string {
	t.Helper()
	for d := 0; d <= 9; d++ {
		if s := prefix + strconv.Itoa(d); domain.ValidIINBIN(s) {
			return s
		}
	}
	t.Fatalf("нет контрольной цифры для %s", prefix)
	return ""
}

func newAPIEnv(t *testing.T, env map[string]string) *apiEnv {
	t.Helper()
	tdb := testdb.New(t)
	deps := testDeps(t)
	for k, v := range env {
		switch k {
		case "RATE_LOGIN_PER_MINUTE":
			n, _ := strconv.Atoi(v)
			deps.Config.HTTP.LoginPerMinute = n
		case "RATE_USER_PER_MINUTE":
			n, _ := strconv.Atoi(v)
			deps.Config.HTTP.UserPerMinute = n
		}
	}
	deps.Service = service.New(tdb.App, deps.Config.Auth, nil)
	e := &apiEnv{t: t, h: NewRouter(deps), db: tdb, tok: map[string]string{}}

	hash, err := auth.HashPassword(apiPass)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = tdb.Owner.Exec(context.Background(),
		`INSERT INTO users (id, login, display_name, password_hash, role_id) VALUES ('u-admin', 'admin', 'Администратор', $1, 'platform-admin')`, hash); err != nil {
		t.Fatal(err)
	}

	user := func(id, role, company string) map[string]any {
		return map[string]any{"id": id, "login": id, "displayName": "Имя " + id, "role": role, "companyIds": []string{company}, "createdAt": "2026-09-01T00:00:00Z"}
	}
	res := e.call("admin", http.MethodPost, "/api/admin/import", map[string]any{
		"companies": []map[string]any{
			{"id": "c-a", "name": "ТОО «А»", "bin": validBIN(t, "10014000123")},
			{"id": "c-b", "name": "ТОО «Б»", "bin": validBIN(t, "10014000456")},
		},
		"users": []map[string]any{user("dir-a", "director", "c-a"), user("emp-a", "employee", "c-a"), user("dir-b", "director", "c-b"), user("emp-b", "employee", "c-b")},
	}, nil)
	e.want(res, http.StatusOK)
	for _, id := range []string{"dir-a", "emp-a", "dir-b", "emp-b"} {
		e.want(e.call("admin", http.MethodPost, "/api/users/"+id+"/password", map[string]any{"password": apiPass}, nil), http.StatusNoContent)
	}
	return e
}

func (e *apiEnv) raw(method, path string, body any, header http.Header) *httptest.ResponseRecorder {
	e.t.Helper()
	var buf bytes.Buffer
	if s, ok := body.(string); ok {
		buf.WriteString(s)
	} else if body != nil {
		if err := json.NewEncoder(&buf).Encode(body); err != nil {
			e.t.Fatal(err)
		}
	}
	req := httptest.NewRequest(method, path, &buf)
	req.RemoteAddr = "192.0.2.10:5555"
	req.Header.Set("Content-Type", "application/json")
	for k, v := range header {
		req.Header[k] = v
	}
	rec := httptest.NewRecorder()
	e.h.ServeHTTP(rec, req)
	return rec
}

// call – запрос от имени человека (вход при первом обращении).
func (e *apiEnv) call(who, method, path string, body any, header http.Header) *httptest.ResponseRecorder {
	e.t.Helper()
	if _, ok := e.tok[who]; !ok {
		res := e.raw(http.MethodPost, "/api/auth/login", map[string]string{"login": who, "password": apiPass}, nil)
		e.want(res, http.StatusOK)
		var s struct {
			AccessToken string `json:"accessToken"`
		}
		e.decode(res, &s)
		e.tok[who] = s.AccessToken
	}
	h := http.Header{}
	for k, v := range header {
		h[k] = v
	}
	h.Set("Authorization", "Bearer "+e.tok[who])
	return e.raw(method, path, body, h)
}

func (e *apiEnv) want(res *httptest.ResponseRecorder, status int) {
	e.t.Helper()
	if res.Code != status {
		e.t.Fatalf("код %d, ожидался %d: %s", res.Code, status, res.Body.String())
	}
}

func (e *apiEnv) decode(res *httptest.ResponseRecorder, dst any) {
	e.t.Helper()
	if err := json.Unmarshal(res.Body.Bytes(), dst); err != nil {
		e.t.Fatalf("ответ %q: %v", res.Body.String(), err)
	}
}

func errorCode(t *testing.T, res *httptest.ResponseRecorder) string {
	t.Helper()
	var body struct {
		Error struct {
			Code string `json:"code"`
		} `json:"error"`
	}
	if err := json.Unmarshal(res.Body.Bytes(), &body); err != nil {
		t.Fatalf("ответ %q: %v", res.Body.String(), err)
	}
	return body.Error.Code
}

func refreshCookieOf(t *testing.T, res *httptest.ResponseRecorder) *http.Cookie {
	t.Helper()
	for _, c := range res.Result().Cookies() {
		if c.Name == refreshCookie {
			return c
		}
	}
	t.Fatalf("нет cookie %s", refreshCookie)
	return nil
}

// ── Вход ────────────────────────────────────────────────────────────────────

func TestAPILoginSetsSafeCookie(t *testing.T) {
	e := newAPIEnv(t, nil)
	res := e.raw(http.MethodPost, "/api/auth/login", map[string]string{"login": "emp-a", "password": apiPass}, nil)
	e.want(res, http.StatusOK)

	c := refreshCookieOf(t, res)
	if !c.HttpOnly || !c.Secure || c.SameSite != http.SameSiteStrictMode || c.Path != "/api/auth" || c.Value == "" {
		t.Fatalf("cookie: %+v", c)
	}
	if got := res.Header().Get("Cache-Control"); got != "no-store" {
		t.Fatalf("Cache-Control: %q", got)
	}
	var s map[string]any
	e.decode(res, &s)
	if s["accessToken"] == "" || s["me"] == nil {
		t.Fatalf("ответ: %v", s)
	}
	// Refresh-токен в тело не попадает – только в cookie.
	if strings.Contains(res.Body.String(), c.Value) {
		t.Fatal("refresh-токен в теле ответа")
	}
}

func TestAPILoginFailureIsUniform(t *testing.T) {
	e := newAPIEnv(t, nil)
	bodies := map[string]string{}
	for _, in := range []map[string]string{
		{"login": "emp-a", "password": "wrong-password-1"},
		{"login": "nobody", "password": apiPass},
	} {
		res := e.raw(http.MethodPost, "/api/auth/login", in, nil)
		e.want(res, http.StatusUnauthorized)
		var body struct {
			Error struct{ Code, Message string } `json:"error"`
		}
		e.decode(res, &body)
		bodies[in["login"]] = body.Error.Code + "|" + body.Error.Message
	}
	if bodies["emp-a"] != bodies["nobody"] || !strings.Contains(bodies["emp-a"], "Неверный логин или пароль") {
		t.Fatalf("ответы различаются: %v", bodies)
	}
}

func TestAPILoginRateLimitedByIP(t *testing.T) {
	e := newAPIEnv(t, map[string]string{"RATE_LOGIN_PER_MINUTE": "3"})
	for i := 0; i < 3; i++ {
		e.raw(http.MethodPost, "/api/auth/login", map[string]string{"login": "x" + strconv.Itoa(i), "password": "p"}, nil)
	}
	res := e.raw(http.MethodPost, "/api/auth/login", map[string]string{"login": "emp-a", "password": apiPass}, nil)
	e.want(res, http.StatusTooManyRequests)
	if res.Header().Get("Retry-After") == "" {
		t.Fatal("нет Retry-After")
	}
}

func TestAPIRefreshAndLogout(t *testing.T) {
	e := newAPIEnv(t, nil)
	login := e.raw(http.MethodPost, "/api/auth/login", map[string]string{"login": "emp-a", "password": apiPass}, nil)
	first := refreshCookieOf(t, login)

	withCookie := func(c *http.Cookie) http.Header {
		return http.Header{"Cookie": []string{c.Name + "=" + c.Value}}
	}
	res := e.raw(http.MethodPost, "/api/auth/refresh", nil, withCookie(first))
	e.want(res, http.StatusOK)
	second := refreshCookieOf(t, res)
	if second.Value == first.Value {
		t.Fatal("refresh не сменился")
	}

	// Повтор старого – отзыв цепочки, cookie стирается.
	res = e.raw(http.MethodPost, "/api/auth/refresh", nil, withCookie(first))
	e.want(res, http.StatusUnauthorized)
	if c := refreshCookieOf(t, res); c.MaxAge >= 0 {
		t.Fatalf("cookie не стёрта: %+v", c)
	}
	e.want(e.raw(http.MethodPost, "/api/auth/refresh", nil, withCookie(second)), http.StatusUnauthorized)

	// Выход.
	third := refreshCookieOf(t, e.raw(http.MethodPost, "/api/auth/login", map[string]string{"login": "emp-a", "password": apiPass}, nil))
	e.want(e.raw(http.MethodPost, "/api/auth/logout", nil, withCookie(third)), http.StatusNoContent)
	e.want(e.raw(http.MethodPost, "/api/auth/refresh", nil, withCookie(third)), http.StatusUnauthorized)
	// Без cookie – 401.
	e.want(e.raw(http.MethodPost, "/api/auth/refresh", nil, nil), http.StatusUnauthorized)
}

func TestAPIRequiresToken(t *testing.T) {
	e := newAPIEnv(t, nil)
	for _, path := range []string{"/api/me", "/api/users", "/api/companies"} {
		res := e.raw(http.MethodGet, path, nil, nil)
		e.want(res, http.StatusUnauthorized)
		res = e.raw(http.MethodGet, path, nil, http.Header{"Authorization": []string{"Bearer forged.token.value"}})
		e.want(res, http.StatusUnauthorized)
	}
}

func TestAPIRejectsUnknownFields(t *testing.T) {
	e := newAPIEnv(t, nil)
	res := e.raw(http.MethodPost, "/api/auth/login", `{"login":"emp-a","password":"x","companyId":"c-b"}`, nil)
	e.want(res, http.StatusBadRequest)
	res = e.raw(http.MethodPost, "/api/auth/login", `{"login":"emp-a"} {"x":1}`, nil)
	e.want(res, http.StatusBadRequest)
}

// ── Изоляция компаний через API ─────────────────────────────────────────────

// Компания – только из токена: в теле и адресе её не подменить, чужое – 404.
func TestAPICompanyIsolation(t *testing.T) {
	e := newAPIEnv(t, nil)

	var users struct {
		Items []service.User `json:"items"`
	}
	res := e.call("dir-a", http.MethodGet, "/api/users", nil, nil)
	e.want(res, http.StatusOK)
	e.decode(res, &users)
	for _, u := range users.Items {
		if u.ID == "emp-b" || u.ID == "dir-b" {
			t.Fatalf("директор A видит %s", u.ID)
		}
	}

	in := map[string]any{"displayName": "Взлом", "role": "employee", "companyIds": []string{"c-a"}, "sectionIds": []string{}, "viewSectionIds": []string{}, "grantedActions": []string{}, "blocked": true, "lockVersion": 1}
	res = e.call("dir-a", http.MethodPatch, "/api/users/emp-b", in, nil)
	e.want(res, http.StatusNotFound)
	res = e.call("dir-a", http.MethodPatch, "/api/users/no-such-user", in, nil)
	e.want(res, http.StatusNotFound)
	e.want(e.call("dir-a", http.MethodPost, "/api/users/emp-b/password", map[string]any{"password": "another-password-1"}, nil), http.StatusNotFound)
	e.want(e.call("dir-a", http.MethodDelete, "/api/users/emp-b?lockVersion=1", nil, nil), http.StatusNotFound)

	res = e.call("dir-a", http.MethodPatch, "/api/companies/c-b", map[string]any{"name": "Взлом", "bin": validBIN(t, "10014000456"), "lockVersion": 0}, nil)
	e.want(res, http.StatusNotFound)
	e.want(e.call("dir-a", http.MethodPost, "/api/auth/company", map[string]any{"companyId": "c-b"}, nil), http.StatusNotFound)

	var companies struct {
		Items []map[string]any `json:"items"`
	}
	res = e.call("dir-a", http.MethodGet, "/api/companies", nil, nil)
	e.want(res, http.StatusOK)
	e.decode(res, &companies)
	if len(companies.Items) != 1 || companies.Items[0]["id"] != "c-a" {
		t.Fatalf("директор A видит компании %v", companies.Items)
	}

	// Пользователь B по-прежнему входит с прежним паролем – ничего не изменилось.
	e.want(e.raw(http.MethodPost, "/api/auth/login", map[string]string{"login": "emp-b", "password": apiPass}, nil), http.StatusOK)
}

func TestAPIConflictOnStaleVersion(t *testing.T) {
	e := newAPIEnv(t, nil)
	var users struct {
		Items []service.User `json:"items"`
	}
	list := e.call("dir-a", http.MethodGet, "/api/users", nil, nil)
	e.want(list, http.StatusOK)
	e.decode(list, &users)
	var version int32 = -1
	for _, u := range users.Items {
		if u.ID == "emp-a" {
			version = u.LockVersion
		}
	}
	in := map[string]any{"displayName": "Новое имя", "role": "employee", "companyIds": []string{"c-a"}, "sectionIds": []string{}, "viewSectionIds": []string{}, "grantedActions": []string{}, "blocked": false, "lockVersion": version}
	e.want(e.call("dir-a", http.MethodPatch, "/api/users/emp-a", in, nil), http.StatusOK)
	res := e.call("dir-a", http.MethodPatch, "/api/users/emp-a", in, nil)
	e.want(res, http.StatusConflict)
	if code := errorCode(t, res); code != "conflict" {
		t.Fatalf("код ошибки %q", code)
	}
}

// Смена логина по HTTP (решение человека 16.10): сайт шлёт логин в каждой
// правке; тот же – не смена; другой – только администратору платформы,
// иначе 403. Пароль этой правкой по-прежнему не меняется.
func TestAPILoginChange(t *testing.T) {
	e := newAPIEnv(t, nil)
	version := func(who string) int32 {
		t.Helper()
		var users struct {
			Items []service.User `json:"items"`
		}
		list := e.call(who, http.MethodGet, "/api/users", nil, nil)
		e.want(list, http.StatusOK)
		e.decode(list, &users)
		for _, u := range users.Items {
			if u.ID == "emp-a" {
				return u.LockVersion
			}
		}
		t.Fatalf("%s не видит emp-a", who)
		return 0
	}
	body := func(login string, v int32) map[string]any {
		return map[string]any{"login": login, "displayName": "Работник А", "role": "employee", "companyIds": []string{"c-a"}, "sectionIds": []string{}, "viewSectionIds": []string{}, "grantedActions": []string{}, "blocked": false, "lockVersion": v}
	}

	e.want(e.call("dir-a", http.MethodPatch, "/api/users/emp-a", body("emp-a", version("dir-a")), nil), http.StatusOK)
	e.want(e.call("dir-a", http.MethodPatch, "/api/users/emp-a", body("emp-a-new", version("dir-a")), nil), http.StatusForbidden)

	e.want(e.call("admin", http.MethodPatch, "/api/users/emp-a", body("aidana.k", version("admin")), nil), http.StatusOK)
	e.want(e.raw(http.MethodPost, "/api/auth/login", map[string]string{"login": "aidana.k", "password": apiPass}, nil), http.StatusOK)

	withPassword := body("aidana.k", version("admin"))
	withPassword["password"] = "another-password-1"
	e.want(e.call("admin", http.MethodPatch, "/api/users/emp-a", withPassword, nil), http.StatusBadRequest)
}

// ── Идемпотентность ─────────────────────────────────────────────────────────

func TestAPIIdempotentCreate(t *testing.T) {
	e := newAPIEnv(t, nil)
	in := map[string]any{"login": "new-emp", "displayName": "Новый", "role": "employee", "companyIds": []string{"c-a"}, "password": apiPass}
	key := http.Header{"Idempotency-Key": []string{"key-0000000001"}}

	first := e.call("dir-a", http.MethodPost, "/api/users", in, key)
	e.want(first, http.StatusCreated)
	again := e.call("dir-a", http.MethodPost, "/api/users", in, key)
	e.want(again, http.StatusCreated)
	if again.Body.String() != first.Body.String() || again.Header().Get("Idempotent-Replayed") != "true" {
		t.Fatalf("повтор не вернул сохранённый ответ: %s", again.Body.String())
	}
	var n int
	if err := e.db.Owner.QueryRow(context.Background(), `SELECT count(*) FROM users WHERE login = 'new-emp'`).Scan(&n); err != nil || n != 1 {
		t.Fatalf("создано %d учётных записей: %v", n, err)
	}

	// Тот же ключ с другим телом – 422.
	in["displayName"] = "Другой"
	res := e.call("dir-a", http.MethodPost, "/api/users", in, key)
	e.want(res, http.StatusUnprocessableEntity)
	if code := errorCode(t, res); code != "idempotency_mismatch" {
		t.Fatalf("код ошибки %q", code)
	}

	// Ключ другого человека с тем же значением – свой.
	in["login"], in["companyIds"] = "new-emp-b", []string{"c-b"}
	e.want(e.call("dir-b", http.MethodPost, "/api/users", in, key), http.StatusCreated)
}

func TestAPIImportOnlyOnce(t *testing.T) {
	e := newAPIEnv(t, nil)
	res := e.call("admin", http.MethodPost, "/api/admin/import", map[string]any{
		"companies": []map[string]any{{"id": "c-x", "name": "X", "bin": validBIN(t, "10014000789")}},
		"users":     []map[string]any{},
	}, nil)
	e.want(res, http.StatusConflict)
	e.want(e.call("dir-a", http.MethodPost, "/api/admin/import", map[string]any{"companies": []map[string]any{}, "users": []map[string]any{}}, nil), http.StatusForbidden)
}

func TestAPIConfirmAndDeleteCompany(t *testing.T) {
	e := newAPIEnv(t, nil)
	e.want(e.call("dir-a", http.MethodPost, "/api/auth/confirm", map[string]any{"password": apiPass}, nil), http.StatusNoContent)
	res := e.call("dir-a", http.MethodPost, "/api/auth/confirm", map[string]any{"password": "wrong-password-1"}, nil)
	e.want(res, http.StatusUnprocessableEntity)

	e.want(e.call("dir-a", http.MethodDelete, "/api/companies/c-b?lockVersion=0", nil, nil), http.StatusNotFound)
	e.want(e.call("dir-a", http.MethodDelete, "/api/companies/c-a?lockVersion=0", nil, nil), http.StatusForbidden)
	e.want(e.call("admin", http.MethodDelete, "/api/companies/c-b", nil, nil), http.StatusBadRequest)
	e.want(e.call("admin", http.MethodDelete, "/api/companies/c-b?lockVersion=0", nil, nil), http.StatusNoContent)
	e.want(e.call("admin", http.MethodDelete, "/api/companies/c-b?lockVersion=1", nil, nil), http.StatusNotFound)
}

func TestAPIClientIP(t *testing.T) {
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.RemoteAddr = "10.0.0.5:1234"
	r.Header.Set("X-Forwarded-For", "6.6.6.6, 203.0.113.7")
	if got := clientIP(r, false); got != "10.0.0.5" {
		t.Fatalf("без доверия к прокси: %q", got)
	}
	if got := clientIP(r, true); got != "203.0.113.7" {
		t.Fatalf("за прокси: %q", got)
	}
}
