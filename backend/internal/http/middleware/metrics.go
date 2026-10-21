package middleware

import (
	"net/http"
	"time"

	"docflow/internal/observability"
)

// Metrics считает обращения и время их обработки.
func Metrics(m *observability.Metrics) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			done := m.StartRequest()
			defer done()

			started := time.Now()
			rec := newRecorder(w)

			defer func() {
				m.ObserveRequest(r.Method, routePattern(r), rec.status, time.Since(started))
			}()

			next.ServeHTTP(rec, r)
		})
	}
}
