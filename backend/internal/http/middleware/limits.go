package middleware

import (
	"context"
	"net/http"
	"time"

	"docflow/internal/http/response"
)

// Timeout ограничивает время обработки одного обращения.
//
// Предел живёт в контексте, поэтому его видят и запросы к базе, и вызовы
// внешних служб: у каждой операции должен быть таймаут (CLAUDE.md, п. 3.11).
// Если обработчик вернулся, ничего не написав, а время вышло — клиент получает
// внятный ответ вместо оборванного соединения.
func Timeout(d time.Duration) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx, cancel := context.WithTimeout(r.Context(), d)
			defer cancel()

			rec := newRecorder(w)
			next.ServeHTTP(rec, r.WithContext(ctx))

			if !rec.Written() && ctx.Err() != nil {
				response.Error(rec, r, ctx.Err())
			}
		})
	}
}

// MaxBody ограничивает размер тела запроса (CLAUDE.md, п. 3.11: тело JSON ≤ 1 МБ).
//
// Проверяются оба случая: объявленная длина — чтобы отказать сразу, не вычитывая
// тело, и фактическая — потому что Content-Length клиент может не прислать вовсе.
func MaxBody(limit int64) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.ContentLength > limit {
				response.TooLarge(w, r)
				return
			}
			if r.Body != nil {
				r.Body = http.MaxBytesReader(w, r.Body, limit)
			}
			next.ServeHTTP(w, r)
		})
	}
}
