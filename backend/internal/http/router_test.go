package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"docflow/internal/config"
	"docflow/internal/observability"
)

func testDeps(t *testing.T) Deps {
	t.Helper()

	cfg, err := config.LoadFrom(map[string]string{
		"DATABASE_URL":       "postgres://app:secret@localhost:6432/docflow",
		"REDIS_URL":          "redis://localhost:6379/0",
		"STORAGE_ENDPOINT":   "localhost:9000",
		"STORAGE_ACCESS_KEY": "minio",
		"STORAGE_SECRET_KEY": "minio12345",
		"AUTH_JWT_SECRET":    "test-secret-0123456789abcdef-0123456789",
	})
	if err != nil {
		t.Fatalf("настройки для теста должны загружаться: %v", err)
	}

	return Deps{
		Config:  cfg,
		Metrics: observability.NewMetrics("test"),
		Health:  observability.NewHealth(time.Second),
	}
}

func do(h http.Handler, method, path string, body io.Reader) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, body)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func TestLiveAlwaysAnswersOK(t *testing.T) {
	deps := testDeps(t)
	// Зависимость лежит, но /healthz обязан отвечать: иначе оркестратор
	// перезапустит исправный процесс из-за недоступной базы.
	deps.Health.Register("database", func(context.Context) error {
		return errors.New("подключение к postgres://app:secret@db:5432 не удалось")
	})

	rec := do(NewRouter(deps), http.MethodGet, "/healthz", nil)

	if rec.Code != http.StatusOK {
		t.Fatalf("/healthz должен отвечать 200, получено %d", rec.Code)
	}
}

func TestReadyFailsWhenDependencyIsDown(t *testing.T) {
	deps := testDeps(t)
	deps.Health.Register("database", func(context.Context) error {
		return errors.New("подключение к postgres://app:secret@db:5432 не удалось")
	})

	rec := do(NewRouter(deps), http.MethodGet, "/readyz", nil)

	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("при недоступной зависимости /readyz должен отвечать 503, получено %d", rec.Code)
	}

	body := rec.Body.String()
	// Причина отказа наружу не выдаётся: в тексте ошибки подключения бывают
	// хосты, логины и пароли.
	if strings.Contains(body, "secret") || strings.Contains(body, "postgres://") {
		t.Fatalf("строка подключения утекла в публичный ответ: %s", body)
	}
	if !strings.Contains(body, "database") || !strings.Contains(body, observability.StatusDown) {
		t.Fatalf("ответ должен называть недоступную зависимость: %s", body)
	}
}

func TestReadyIsOKWhenDependenciesAreUp(t *testing.T) {
	deps := testDeps(t)
	deps.Health.Register("database", func(context.Context) error { return nil })
	deps.Health.Register("redis", func(context.Context) error { return nil })

	rec := do(NewRouter(deps), http.MethodGet, "/readyz", nil)

	if rec.Code != http.StatusOK {
		t.Fatalf("/readyz должен отвечать 200, получено %d (%s)", rec.Code, rec.Body.String())
	}
}

func TestMetricsRouterShowsReasons(t *testing.T) {
	deps := testDeps(t)
	deps.Health.Register("database", func(context.Context) error {
		return errors.New("соединение отвергнуто")
	})

	rec := do(NewMetricsRouter(deps), http.MethodGet, "/readyz", nil)

	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("ожидался 503, получено %d", rec.Code)
	}
	// На служебном адресе причина нужна: по ней дежурный понимает, что чинить.
	if !strings.Contains(rec.Body.String(), "соединение отвергнуто") {
		t.Fatalf("на служебном адресе должна быть причина отказа: %s", rec.Body.String())
	}
}

func TestMetricsAreExposed(t *testing.T) {
	deps := testDeps(t)
	router := NewRouter(deps)

	do(router, http.MethodGet, "/healthz", nil)

	rec := do(NewMetricsRouter(deps), http.MethodGet, "/metrics", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("/metrics должен отвечать 200, получено %d", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "http_requests_total") {
		t.Fatalf("в показателях нет счётчика обращений: %s", rec.Body.String())
	}
}

func TestUnknownPathAnswersNotFoundAsJSON(t *testing.T) {
	rec := do(NewRouter(testDeps(t)), http.MethodGet, "/no-such-thing", nil)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("ожидался 404, получено %d", rec.Code)
	}

	var body struct {
		Error struct {
			Code      string `json:"code"`
			Message   string `json:"message"`
			RequestID string `json:"request_id"`
		} `json:"error"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("ответ об ошибке должен быть JSON: %v (%s)", err, rec.Body.String())
	}
	if body.Error.Code != "not_found" {
		t.Errorf("код ошибки: получено %q", body.Error.Code)
	}
	// Номер обращения в ответе — то, что человек называет поддержке.
	if body.Error.RequestID == "" {
		t.Error("в ответе об ошибке нет номера обращения")
	}
}

func TestRequestIDIsReturnedAndSanitized(t *testing.T) {
	router := NewRouter(testDeps(t))

	t.Run("свой идентификатор сохраняется", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
		req.Header.Set(observability.RequestIDHeader, "abc-123")
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		if got := rec.Header().Get(observability.RequestIDHeader); got != "abc-123" {
			t.Errorf("идентификатор обращения не вернулся: %q", got)
		}
	})

	t.Run("подделка заголовков не проходит", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
		req.Header.Set(observability.RequestIDHeader, "abc\r\nX-Admin: true")
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		got := rec.Header().Get(observability.RequestIDHeader)
		if strings.ContainsAny(got, "\r\n ") {
			t.Errorf("управляющие символы не вычищены: %q", got)
		}
		if rec.Header().Get("X-Admin") != "" {
			t.Error("удалось подделать дополнительный заголовок ответа")
		}
	})

	t.Run("без заголовка выдаётся свой", func(t *testing.T) {
		rec := do(router, http.MethodGet, "/healthz", nil)
		if rec.Header().Get(observability.RequestIDHeader) == "" {
			t.Error("идентификатор обращения должен выдаваться всегда")
		}
	})
}

func TestTooLargeBodyIsRejected(t *testing.T) {
	deps := testDeps(t)
	body := strings.NewReader(strings.Repeat("x", int(deps.Config.HTTP.MaxBodyBytes)+1))

	rec := do(NewRouter(deps), http.MethodPost, "/healthz", body)

	// Обработчика POST у /healthz нет, но предел размера проверяется раньше
	// маршрутизации — тело не должно даже дочитываться.
	if rec.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("ожидался 413, получено %d (%s)", rec.Code, rec.Body.String())
	}
}

// Поведение при панике проверяется там, где оно реализовано:
// internal/http/middleware/recover_test.go.
