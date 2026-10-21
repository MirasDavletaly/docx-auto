package middleware

import (
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"docflow/internal/config"
	"docflow/internal/observability"
)

// silentContext подкладывает журнал, который никуда не пишет: паника в этих
// тестах ожидаемая, и её стек в выводе теста только мешает.
func silentContext(r *http.Request) *http.Request {
	logger := observability.NewLogger(config.Log{Level: slog.LevelError, JSON: true}, io.Discard)
	return r.WithContext(observability.WithLogger(r.Context(), logger))
}

func TestRecoverTurnsPanicIntoInternalError(t *testing.T) {
	const secret = "пароль базы hunter2"

	handler := Recover(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		panic(secret)
	}))

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, silentContext(httptest.NewRequest(http.MethodGet, "/", nil)))

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("паника должна превращаться в 500, получено %d", rec.Code)
	}
	// Клиенту нельзя показывать ни текст паники, ни стек: по ним изучают
	// устройство системы.
	if strings.Contains(rec.Body.String(), secret) {
		t.Fatalf("подробности паники ушли клиенту: %s", rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), "internal_error") {
		t.Fatalf("ответ должен нести код ошибки: %s", rec.Body.String())
	}
}

func TestRecoverKeepsAlreadySentResponse(t *testing.T) {
	// Если ответ уже пошёл клиенту, подменить его нечем. Обрыв соединения
	// честнее, чем обрезанное тело, которое выглядит как успешный ответ.
	handler := Recover(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"partial":`))
		panic("сбой на середине ответа")
	}))

	defer func() {
		cause := recover()
		err, ok := cause.(error)
		if !ok || !errors.Is(err, http.ErrAbortHandler) {
			t.Fatalf("ожидался ErrAbortHandler, получено %v", cause)
		}
	}()

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, silentContext(httptest.NewRequest(http.MethodGet, "/", nil)))

	t.Fatal("обработчик должен был прервать ответ паникой ErrAbortHandler")
}

func TestRecoverPassesNormalResponsesThrough(t *testing.T) {
	handler := Recover(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write([]byte("ок"))
	}))

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/", nil))

	if rec.Code != http.StatusCreated {
		t.Errorf("код ответа: получено %d", rec.Code)
	}
	if rec.Body.String() != "ок" {
		t.Errorf("тело ответа: получено %q", rec.Body.String())
	}
}
