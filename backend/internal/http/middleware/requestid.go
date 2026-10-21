// Package middleware содержит сквозные обработчики HTTP: опознание обращения,
// журналирование, страховку от паники, предельное время и предельный размер тела.
package middleware

import (
	"log/slog"
	"net/http"

	"docflow/internal/observability"
)

// RequestID проставляет идентификатор обращения и кладёт в контекст журнал,
// к которому этот идентификатор уже привязан.
//
// Значение, пришедшее снаружи, принимается, но очищается: так обращение можно
// проследить от nginx и от сайта, при этом чужой заголовок не подделает строку
// в журнале и не сломает заголовки ответа.
func RequestID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := observability.SanitizeRequestID(r.Header.Get(observability.RequestIDHeader))
		if id == "" {
			id = observability.NewRequestID()
		}

		ctx := observability.WithRequestID(r.Context(), id)
		ctx = observability.WithLogger(ctx, observability.LoggerFrom(ctx).With(slog.String("request_id", id)))

		w.Header().Set(observability.RequestIDHeader, id)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
