package middleware

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	"docflow/internal/observability"
)

// AccessLog пишет по одной строке на обращение.
//
// В журнал попадает путь без строки запроса: в параметрах поиска бывают фамилии
// и другие персональные данные, которым в логах не место (CLAUDE.md, п. 3.10).
func AccessLog(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		started := time.Now()
		rec := newRecorder(w)

		// Запись откладывается, а не оборачивается в замыкание: аргументы
		// вычисляются сразу, а rec к моменту вызова уже знает код ответа.
		defer logRequest(r.Context(), r, rec, started)

		next.ServeHTTP(rec, r)
	})
}

func logRequest(ctx context.Context, r *http.Request, rec *recorder, started time.Time) {
	logger := observability.LoggerFrom(ctx)

	attrs := []any{
		slog.String("method", r.Method),
		slog.String("path", r.URL.Path),
		slog.String("route", routePattern(r)),
		slog.Int("status", rec.status),
		slog.Int64("bytes", rec.bytes),
		slog.Int64("duration_ms", time.Since(started).Milliseconds()),
	}

	switch {
	case rec.status >= http.StatusInternalServerError:
		logger.ErrorContext(ctx, "обращение завершилось сбоем", attrs...)
	case rec.status >= http.StatusBadRequest:
		logger.WarnContext(ctx, "обращение отклонено", attrs...)
	default:
		logger.InfoContext(ctx, "обращение обработано", attrs...)
	}
}

// routePattern возвращает шаблон маршрута ("/documents/{id}"), по которому
// удобно группировать записи. Вне маршрутизатора chi контекста нет, поэтому
// проверка на nil обязательна: иначе журналирование уронит запрос.
func routePattern(r *http.Request) string {
	if rc := chi.RouteContext(r.Context()); rc != nil {
		return rc.RoutePattern()
	}
	return ""
}
