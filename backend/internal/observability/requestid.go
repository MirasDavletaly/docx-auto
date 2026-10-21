package observability

import (
	"context"
	"crypto/rand"
	"encoding/hex"
)

// RequestIDHeader — заголовок, по которому обращение прослеживается от nginx
// до записей в журнале и до ответа об ошибке.
const RequestIDHeader = "X-Request-Id"

// maxRequestIDLen ограничивает длину значения, пришедшего извне: идентификатор
// попадает в каждую запись журнала, и раздувать их чужой строкой незачем.
const maxRequestIDLen = 64

type requestIDKey struct{}

// WithRequestID кладёт идентификатор обращения в контекст.
func WithRequestID(ctx context.Context, id string) context.Context {
	return context.WithValue(ctx, requestIDKey{}, id)
}

// RequestIDFrom достаёт идентификатор обращения; пустая строка, если его нет.
func RequestIDFrom(ctx context.Context) string {
	id, _ := ctx.Value(requestIDKey{}).(string)
	return id
}

// NewRequestID выдаёт новый идентификатор обращения.
func NewRequestID() string {
	var b [16]byte
	// rand.Read из crypto/rand в актуальных версиях Go не возвращает ошибку
	// иначе как паникой, поэтому отдельная ветка обработки здесь не нужна.
	_, _ = rand.Read(b[:])
	return hex.EncodeToString(b[:])
}

// SanitizeRequestID приводит пришедшее снаружи значение к безопасному виду.
//
// Значение подставляется в журналы и в заголовок ответа, поэтому переводы строк
// и управляющие символы из него убираются: иначе чужой заголовок сможет
// подделать строку в журнале или разорвать заголовки ответа.
func SanitizeRequestID(raw string) string {
	if raw == "" {
		return ""
	}
	if len(raw) > maxRequestIDLen {
		raw = raw[:maxRequestIDLen]
	}

	out := make([]byte, 0, len(raw))
	for i := 0; i < len(raw); i++ {
		c := raw[i]
		switch {
		case c >= 'a' && c <= 'z',
			c >= 'A' && c <= 'Z',
			c >= '0' && c <= '9',
			c == '-', c == '_', c == '.':
			out = append(out, c)
		default:
			// Остальное отбрасываем молча: это не ошибка запроса.
		}
	}
	return string(out)
}
