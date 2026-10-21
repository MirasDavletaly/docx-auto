package response

import (
	"net/http"

	"docflow/internal/observability"
)

// RequestIDFrom возвращает идентификатор обращения, установленный middleware.
func RequestIDFrom(r *http.Request) string {
	if r == nil {
		return ""
	}
	return observability.RequestIDFrom(r.Context())
}
