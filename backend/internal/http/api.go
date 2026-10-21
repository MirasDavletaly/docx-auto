package httpapi

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"docflow/internal/access"
	"docflow/internal/config"
	"docflow/internal/domain"
	"docflow/internal/http/middleware"
	"docflow/internal/http/response"
	"docflow/internal/service"
)

// Обработчики /api (этап 1а): вход, учётные записи, компании, перенос из
// браузера. Здесь только HTTP (CLAUDE.md, п. 3.3): разобрать, вызвать
// сервис, ответить. Права и данные – в сервисе.

// refreshCookie – имя cookie с refresh-токеном. Путь – только /api/auth:
// остальным запросам cookie не нужна и не отправляется.
const (
	refreshCookie = "docflow_refresh"
	refreshPath   = "/api/auth"
)

type api struct {
	svc     *service.Service
	cfg     config.Config
	login   *middleware.Limiter
	user    *middleware.Limiter
	company *middleware.Limiter
}

func mountAPI(r chi.Router, svc *service.Service, cfg config.Config) {
	a := &api{
		svc:     svc,
		cfg:     cfg,
		login:   middleware.NewLimiter(cfg.HTTP.LoginPerMinute, time.Minute, nil),
		user:    middleware.NewLimiter(cfg.HTTP.UserPerMinute, time.Minute, nil),
		company: middleware.NewLimiter(cfg.HTTP.CompanyPerMinute, time.Minute, nil),
	}

	r.Use(noStore)

	r.With(a.limitByIP).Post("/auth/login", a.handleLogin)
	r.With(a.limitByIP).Post("/auth/refresh", a.handleRefresh)
	r.Post("/auth/logout", a.handleLogout)

	r.Group(func(r chi.Router) {
		r.Use(a.authenticate, a.limitByPrincipal)

		r.Get("/me", a.handleMe)
		r.Patch("/me", a.handleUpdateProfile)
		r.Post("/me/password", a.handleChangePassword)
		r.Post("/auth/company", a.handleSelectCompany)
		r.Post("/auth/confirm", a.handleConfirmPassword)

		r.Get("/users", a.handleListUsers)
		r.With(a.idempotent).Post("/users", a.handleCreateUser)
		r.Patch("/users/{id}", a.handleUpdateUser)
		r.Delete("/users/{id}", a.handleDeleteUser)
		r.Post("/users/{id}/password", a.handleSetUserPassword)

		r.Get("/personnel", a.handleListPersonnel)
		r.With(a.idempotent).Post("/personnel", a.handleCreatePerson)
		r.Patch("/personnel/{id}", a.handleUpdatePerson)
		r.Delete("/personnel/{id}", a.handleRemovePerson)

		r.Get("/companies", a.handleListCompanies)
		r.With(a.idempotent).Post("/companies", a.handleCreateCompany)
		r.Patch("/companies/{id}", a.handleUpdateCompany)
		r.Delete("/companies/{id}", a.handleDeleteCompany)

		r.With(a.idempotent).Post("/admin/import", a.handleImport)

		mountDocuments(r, a)
	})
}

// ── Промежуточные обработчики ───────────────────────────────────────────────

// noStore – ответы API не кешируются ни браузером, ни прокси: в них
// токены и персональные данные. nosniff – браузер не угадывает тип ответа.
func noStore(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		next.ServeHTTP(w, r)
	})
}

type principalKey struct{}

func principalFrom(r *http.Request) access.Principal {
	p, _ := r.Context().Value(principalKey{}).(access.Principal)
	return p
}

// authenticate – кто выполняет запрос, по заголовку Authorization: Bearer.
// Компания – только из токена (CLAUDE.md, п. 3.1).
func (a *api) authenticate(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw, ok := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer ")
		if !ok || raw == "" {
			response.Error(w, r, domain.ErrUnauthorized)
			return
		}
		p, err := a.svc.Authenticate(r.Context(), raw)
		if err != nil {
			response.Error(w, r, err)
			return
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), principalKey{}, p)))
	})
}

func tooMany(w http.ResponseWriter, r *http.Request, retry time.Duration) {
	w.Header().Set("Retry-After", strconv.Itoa(int(retry.Seconds())+1))
	response.Error(w, r, domain.ErrRateLimited)
}

func (a *api) limitByIP(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if ok, retry := a.login.Allow(clientIP(r, a.cfg.HTTP.TrustProxy)); !ok {
			tooMany(w, r, retry)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// limitByPrincipal – частота по человеку и по компании (CLAUDE.md, п. 3.11).
func (a *api) limitByPrincipal(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p := principalFrom(r)
		if ok, retry := a.user.Allow(p.UserID); !ok {
			tooMany(w, r, retry)
			return
		}
		if p.CompanyID != "" {
			if ok, retry := a.company.Allow(p.CompanyID); !ok {
				tooMany(w, r, retry)
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}

// clientIP – адрес клиента. За своим прокси – последний адрес в
// X-Forwarded-For: его дописал прокси, а не клиент.
func clientIP(r *http.Request, trustProxy bool) string {
	if trustProxy {
		if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
			parts := strings.Split(xff, ",")
			if ip := strings.TrimSpace(parts[len(parts)-1]); ip != "" {
				return ip
			}
		}
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

// idempotent – повтор создающего запроса с тем же Idempotency-Key получает
// сохранённый ответ, а не второй объект (CLAUDE.md, п. 3.5). Ключ не
// обязателен, но сайт отправляет его всегда.
func (a *api) idempotent(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		key := r.Header.Get("Idempotency-Key")
		if key == "" {
			next.ServeHTTP(w, r)
			return
		}
		if len(key) < 8 || len(key) > 200 {
			response.BadRequest(w, r, "Idempotency-Key – от 8 до 200 знаков")
			return
		}
		body, err := io.ReadAll(r.Body)
		if err != nil {
			bodyError(w, r, err)
			return
		}
		r.Body = io.NopCloser(bytes.NewReader(body))
		h := sha256.New()
		h.Write([]byte(r.Method + " " + r.URL.Path + "\n"))
		h.Write(body)

		p := principalFrom(r)
		replay, err := a.svc.IdempotencyBegin(r.Context(), p, key, h.Sum(nil))
		if err != nil {
			response.Error(w, r, err)
			return
		}
		if replay != nil {
			w.Header().Set("Content-Type", "application/json; charset=utf-8")
			w.Header().Set("Idempotent-Replayed", "true")
			w.WriteHeader(replay.Status)
			_, _ = w.Write(replay.Body) //nolint:gosec // G705: наш же JSON-ответ, сохранённый при первом запросе; nosniff
			return
		}

		buf := &bufferedWriter{header: w.Header(), status: http.StatusOK}
		next.ServeHTTP(buf, r)

		// Запись ключа – и когда клиент уже ушёл: повтор должен найти ответ.
		ctx, cancel := context.WithTimeout(context.WithoutCancel(r.Context()), 5*time.Second)
		defer cancel()
		if buf.status >= http.StatusInternalServerError {
			err = a.svc.IdempotencyAbort(ctx, p, key)
		} else {
			err = a.svc.IdempotencyFinish(ctx, p, key, buf.status, buf.body.Bytes())
		}
		if err != nil {
			slog.ErrorContext(ctx, "ключ идемпотентности не сохранён", slog.Any("error", err))
		}
		w.WriteHeader(buf.status)
		_, _ = w.Write(buf.body.Bytes())
	})
}

// bufferedWriter держит ответ целиком: его надо сохранить до отправки.
type bufferedWriter struct {
	header http.Header
	status int
	body   bytes.Buffer
	wrote  bool
}

func (b *bufferedWriter) Header() http.Header { return b.header }

func (b *bufferedWriter) WriteHeader(status int) {
	if !b.wrote {
		b.status, b.wrote = status, true
	}
}

func (b *bufferedWriter) Write(p []byte) (int, error) {
	b.wrote = true
	return b.body.Write(p)
}

// ── Разбор запроса ──────────────────────────────────────────────────────────

// decode читает тело JSON: одно значение, без лишних полей (CLAUDE.md,
// п. 3.11). Пустое тело при optional – не ошибка.
func decode(w http.ResponseWriter, r *http.Request, dst any, optional bool) bool {
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		if optional && errors.Is(err, io.EOF) {
			return true
		}
		bodyError(w, r, err)
		return false
	}
	if dec.More() {
		response.BadRequest(w, r, "В запросе лишние данные")
		return false
	}
	return true
}

func bodyError(w http.ResponseWriter, r *http.Request, err error) {
	var tooLarge *http.MaxBytesError
	if errors.As(err, &tooLarge) {
		response.TooLarge(w, r)
		return
	}
	response.BadRequest(w, r, "Не удалось разобрать запрос")
}

// ── Вход ────────────────────────────────────────────────────────────────────

// Secure – из настроек: в prod без него процесс не запустится (config).
func (a *api) setRefresh(w http.ResponseWriter, s service.Session) {
	http.SetCookie(w, &http.Cookie{ //nolint:gosec // G124: Secure из настроек, HttpOnly и SameSite=Strict – всегда
		Name: refreshCookie, Value: s.RefreshToken, Path: refreshPath,
		Expires: s.RefreshExpires, MaxAge: int(time.Until(s.RefreshExpires).Seconds()),
		HttpOnly: true, Secure: a.cfg.Auth.CookieSecure, SameSite: http.SameSiteStrictMode,
	})
}

func (a *api) clearRefresh(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{ //nolint:gosec // G124: как в setRefresh
		Name: refreshCookie, Path: refreshPath, MaxAge: -1,
		HttpOnly: true, Secure: a.cfg.Auth.CookieSecure, SameSite: http.SameSiteStrictMode,
	})
}

func (a *api) handleLogin(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Login    string `json:"login"`
		Password string `json:"password"`
	}
	if !decode(w, r, &in, false) {
		return
	}
	s, err := a.svc.Login(r.Context(), in.Login, in.Password, clientIP(r, a.cfg.HTTP.TrustProxy))
	if err != nil {
		response.Error(w, r, err)
		return
	}
	a.setRefresh(w, s)
	response.JSON(w, http.StatusOK, s)
}

func (a *api) handleRefresh(w http.ResponseWriter, r *http.Request) {
	var in struct {
		CompanyID string `json:"companyId"`
	}
	if !decode(w, r, &in, true) {
		return
	}
	c, err := r.Cookie(refreshCookie)
	if err != nil || c.Value == "" {
		response.Error(w, r, domain.ErrUnauthorized)
		return
	}
	s, err := a.svc.Refresh(r.Context(), c.Value, in.CompanyID)
	if err != nil {
		if errors.Is(err, domain.ErrUnauthorized) {
			a.clearRefresh(w)
		}
		response.Error(w, r, err)
		return
	}
	a.setRefresh(w, s)
	response.JSON(w, http.StatusOK, s)
}

func (a *api) handleLogout(w http.ResponseWriter, r *http.Request) {
	if c, err := r.Cookie(refreshCookie); err == nil {
		if err := a.svc.Logout(r.Context(), c.Value); err != nil {
			response.Error(w, r, err)
			return
		}
	}
	a.clearRefresh(w)
	response.NoContent(w)
}

func (a *api) handleSelectCompany(w http.ResponseWriter, r *http.Request) {
	var in struct {
		CompanyID string `json:"companyId"`
	}
	if !decode(w, r, &in, false) {
		return
	}
	s, err := a.svc.SelectCompany(r.Context(), principalFrom(r), in.CompanyID)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, s)
}

// handleConfirmPassword – пароль ещё раз перед входом в админ-панель.
func (a *api) handleConfirmPassword(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Password string `json:"password"`
	}
	if !decode(w, r, &in, false) {
		return
	}
	if err := a.svc.ConfirmPassword(r.Context(), principalFrom(r), in.Password); err != nil {
		response.Error(w, r, err)
		return
	}
	response.NoContent(w)
}

// ── Своя учётная запись ─────────────────────────────────────────────────────

func (a *api) handleMe(w http.ResponseWriter, r *http.Request) {
	me, err := a.svc.Me(r.Context(), principalFrom(r))
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, me)
}

func (a *api) handleUpdateProfile(w http.ResponseWriter, r *http.Request) {
	var in service.ProfileInput
	if !decode(w, r, &in, false) {
		return
	}
	me, err := a.svc.UpdateOwnProfile(r.Context(), principalFrom(r), in)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, me)
}

func (a *api) handleChangePassword(w http.ResponseWriter, r *http.Request) {
	var in struct {
		CurrentPassword string `json:"currentPassword"`
		NewPassword     string `json:"newPassword"`
	}
	if !decode(w, r, &in, false) {
		return
	}
	s, err := a.svc.ChangeOwnPassword(r.Context(), principalFrom(r), in.CurrentPassword, in.NewPassword)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	a.setRefresh(w, s)
	response.JSON(w, http.StatusOK, s)
}

// ── Учётные записи ──────────────────────────────────────────────────────────

func (a *api) handleListUsers(w http.ResponseWriter, r *http.Request) {
	users, err := a.svc.ListUsers(r.Context(), principalFrom(r))
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, map[string]any{"items": users})
}

func (a *api) handleCreateUser(w http.ResponseWriter, r *http.Request) {
	var in service.UserInput
	if !decode(w, r, &in, false) {
		return
	}
	u, err := a.svc.CreateUser(r.Context(), principalFrom(r), in)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusCreated, u)
}

// handleUpdateUser – учётная запись целиком, с lockVersion, которую видел
// человек; не та версия – 409.
func (a *api) handleUpdateUser(w http.ResponseWriter, r *http.Request) {
	var in service.UserInput
	if !decode(w, r, &in, false) {
		return
	}
	// Пароль – отдельным запросом (/users/{id}/password). Логин – здесь: тот
	// же – не смена, другой – по праву users.login (service.UpdateUser).
	if in.Password != "" {
		response.BadRequest(w, r, "Пароль здесь не меняется")
		return
	}
	if in.Position != "" {
		response.BadRequest(w, r, "Должность меняется в персонале")
		return
	}
	u, err := a.svc.UpdateUser(r.Context(), principalFrom(r), chi.URLParam(r, "id"), in)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, u)
}

// lockVersion – версия из параметра адреса (у DELETE нет тела).
func lockVersion(w http.ResponseWriter, r *http.Request) (int32, bool) {
	v, err := strconv.ParseInt(r.URL.Query().Get("lockVersion"), 10, 32)
	if err != nil {
		response.BadRequest(w, r, "Нужен параметр lockVersion")
		return 0, false
	}
	return int32(v), true
}

func (a *api) handleDeleteUser(w http.ResponseWriter, r *http.Request) {
	version, ok := lockVersion(w, r)
	if !ok {
		return
	}
	if err := a.svc.DeleteUser(r.Context(), principalFrom(r), chi.URLParam(r, "id"), version); err != nil {
		response.Error(w, r, err)
		return
	}
	response.NoContent(w)
}

func (a *api) handleSetUserPassword(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Password string `json:"password"`
	}
	if !decode(w, r, &in, false) {
		return
	}
	if err := a.svc.SetUserPassword(r.Context(), principalFrom(r), chi.URLParam(r, "id"), in.Password); err != nil {
		response.Error(w, r, err)
		return
	}
	response.NoContent(w)
}

// ── Персонал ────────────────────────────────────────────────────────────────

// Персонал всегда текущей компании из токена: в адресе и теле компании нет
// (CLAUDE.md, п. 3.1).

func (a *api) handleListPersonnel(w http.ResponseWriter, r *http.Request) {
	list, err := a.svc.ListPersonnel(r.Context(), principalFrom(r))
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, map[string]any{"items": list})
}

func (a *api) handleCreatePerson(w http.ResponseWriter, r *http.Request) {
	var in service.NewPersonInput
	if !decode(w, r, &in, false) {
		return
	}
	person, err := a.svc.CreatePerson(r.Context(), principalFrom(r), in)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusCreated, person)
}

func (a *api) handleUpdatePerson(w http.ResponseWriter, r *http.Request) {
	var in service.PersonInput
	if !decode(w, r, &in, false) {
		return
	}
	person, err := a.svc.UpdatePerson(r.Context(), principalFrom(r), chi.URLParam(r, "id"), in)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, person)
}

func (a *api) handleRemovePerson(w http.ResponseWriter, r *http.Request) {
	version, ok := lockVersion(w, r)
	if !ok {
		return
	}
	if err := a.svc.RemovePerson(r.Context(), principalFrom(r), chi.URLParam(r, "id"), version); err != nil {
		response.Error(w, r, err)
		return
	}
	response.NoContent(w)
}

// ── Компании ────────────────────────────────────────────────────────────────

func (a *api) handleListCompanies(w http.ResponseWriter, r *http.Request) {
	list, err := a.svc.ListCompanies(r.Context(), principalFrom(r))
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, map[string]any{"items": list})
}

func (a *api) handleCreateCompany(w http.ResponseWriter, r *http.Request) {
	var in service.Company
	if !decode(w, r, &in, false) {
		return
	}
	c, err := a.svc.CreateCompany(r.Context(), principalFrom(r), in)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusCreated, c)
}

func (a *api) handleUpdateCompany(w http.ResponseWriter, r *http.Request) {
	var in service.Company
	if !decode(w, r, &in, false) {
		return
	}
	c, err := a.svc.UpdateCompany(r.Context(), principalFrom(r), chi.URLParam(r, "id"), in)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, c)
}

func (a *api) handleDeleteCompany(w http.ResponseWriter, r *http.Request) {
	version, ok := lockVersion(w, r)
	if !ok {
		return
	}
	if err := a.svc.DeleteCompany(r.Context(), principalFrom(r), chi.URLParam(r, "id"), version); err != nil {
		response.Error(w, r, err)
		return
	}
	response.NoContent(w)
}

// ── Перенос из браузера ─────────────────────────────────────────────────────

func (a *api) handleImport(w http.ResponseWriter, r *http.Request) {
	var in service.ImportData
	if !decode(w, r, &in, false) {
		return
	}
	res, err := a.svc.Import(r.Context(), principalFrom(r), in)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, res)
}
