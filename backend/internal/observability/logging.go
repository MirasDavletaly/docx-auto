// Package observability собирает то, через что система видна снаружи:
// логи, метрики и проверки готовности.
package observability

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"regexp"
	"strings"
	"time"

	"docflow/internal/config"
)

// Placeholder подставляется вместо значения, которому не место в логах.
const Placeholder = "[скрыто]"

// NewLogger собирает журнал процесса.
//
// Поверх обычного обработчика надевается фильтр: правило «в логах нет паролей,
// токенов, ИИН, окладов» (CLAUDE.md, п. 3.10) нельзя оставлять на внимательность
// того, кто пишет вызов. Один невнимательный slog.String — и персональные данные
// уехали в сборщик логов, откуда их уже не вычистить.
func NewLogger(cfg config.Log, w io.Writer) *slog.Logger {
	opts := &slog.HandlerOptions{
		Level: cfg.Level,
		// Место в коде дорого стоит при разборе, но заметно замедляет запись,
		// поэтому включается только вместе с отладочным уровнем.
		AddSource:   cfg.Level <= slog.LevelDebug,
		ReplaceAttr: toUTC,
	}

	var base slog.Handler
	if cfg.JSON {
		base = slog.NewJSONHandler(w, opts)
	} else {
		base = slog.NewTextHandler(w, opts)
	}

	return slog.New(redactHandler{inner: base})
}

// toUTC приводит отметку времени к UTC: моменты времени хранятся и пишутся в UTC,
// часовой пояс — дело отображения (CLAUDE.md, п. 3.9).
func toUTC(_ []string, a slog.Attr) slog.Attr {
	if a.Key == slog.TimeKey && a.Value.Kind() == slog.KindTime {
		return slog.Time(a.Key, a.Value.Time().UTC())
	}
	return a
}

// redactHandler вычищает чувствительные значения перед записью.
type redactHandler struct {
	inner slog.Handler
}

func (h redactHandler) Enabled(ctx context.Context, level slog.Level) bool {
	return h.inner.Enabled(ctx, level)
}

func (h redactHandler) Handle(ctx context.Context, r slog.Record) error {
	clean := slog.NewRecord(r.Time, r.Level, redactString(r.Message), r.PC)
	r.Attrs(func(a slog.Attr) bool {
		clean.AddAttrs(redactAttr(a))
		return true
	})
	return h.inner.Handle(ctx, clean)
}

func (h redactHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	clean := make([]slog.Attr, 0, len(attrs))
	for _, a := range attrs {
		clean = append(clean, redactAttr(a))
	}
	return redactHandler{inner: h.inner.WithAttrs(clean)}
}

func (h redactHandler) WithGroup(name string) slog.Handler {
	return redactHandler{inner: h.inner.WithGroup(name)}
}

func redactAttr(a slog.Attr) slog.Attr {
	a.Value = a.Value.Resolve()

	if isSensitiveKey(a.Key) {
		return slog.String(a.Key, Placeholder)
	}

	switch a.Value.Kind() {
	case slog.KindGroup:
		nested := a.Value.Group()
		clean := make([]slog.Attr, 0, len(nested))
		for _, n := range nested {
			clean = append(clean, redactAttr(n))
		}
		return slog.Attr{Key: a.Key, Value: slog.GroupValue(clean...)}

	case slog.KindString:
		return slog.String(a.Key, redactString(a.Value.String()))

	case slog.KindAny:
		// Произвольное значение (структура, срез, ошибка) сериализует уже
		// обработчик, и заглянуть внутрь мы не можем. Поэтому проверяем его
		// текстовое представление: если там похоже на ИИН или токен — прячем
		// целиком. Лучше потерять запись в логе, чем выпустить наружу ИИН.
		if mayContainSecret(fmt.Sprint(a.Value.Any())) {
			return slog.String(a.Key, Placeholder)
		}
		return a

	default:
		return a
	}
}

// sensitiveParts — части имён полей, при которых значение не пишется никогда.
// Сравнение идёт по имени, приведённому к нижнему регистру и без разделителей,
// поэтому "refresh_token", "RefreshToken" и "refresh-token" попадают сюда все.
var sensitiveParts = []string{
	"password", "passwd", "pwd", "passphrase",
	"secret", "token", "apikey", "privatekey",
	"authorization", "cookie", "credential",
}

// sensitiveNames — имена полей целиком. Частичное совпадение здесь не годится:
// например "addr" — это адрес прослушивания сервера, его прятать не нужно.
var sensitiveNames = map[string]struct{}{
	"iin": {}, "иин": {},
	"salary": {}, "oklad": {}, "оклад": {},
	"address": {}, "адрес": {},
	"homeaddress": {}, "legaladdress": {}, "residenceaddress": {},
	"dsn": {}, "databaseurl": {}, "redisurl": {}, "connectionstring": {},
	"sessionid": {}, "pin": {}, "otp": {},
}

func isSensitiveKey(key string) bool {
	normalized := normalizeKey(key)
	if normalized == "" {
		return false
	}
	if _, ok := sensitiveNames[normalized]; ok {
		return true
	}
	for _, part := range sensitiveParts {
		if strings.Contains(normalized, part) {
			return true
		}
	}
	return false
}

func normalizeKey(key string) string {
	var b strings.Builder
	b.Grow(len(key))
	for _, r := range strings.ToLower(key) {
		switch r {
		case '_', '-', ' ', '.':
			continue
		default:
			b.WriteRune(r)
		}
	}
	return b.String()
}

var (
	// Токен в формате JWT: заголовок всегда начинается с eyJ.
	jwtPattern = regexp.MustCompile(`eyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}(\.[A-Za-z0-9_-]*)?`)
	// Двенадцать цифр подряд — это ИИН или БИН. Различить их по виду нельзя,
	// поэтому прячем оба: в логах вместо БИН уместен company_id.
	twelveDigitsPattern = regexp.MustCompile(`\b\d{12}\b`)
)

func redactString(s string) string {
	if !mayContainSecret(s) {
		return s
	}
	s = jwtPattern.ReplaceAllString(s, Placeholder)
	s = twelveDigitsPattern.ReplaceAllString(s, Placeholder)
	return s
}

// mayContainSecret — быстрая проверка без выделения памяти: она отсекает
// подавляющее большинство строк, чтобы не гонять регулярные выражения на
// каждой записи в журнале.
func mayContainSecret(s string) bool {
	run := 0
	for i := 0; i < len(s); i++ {
		if c := s[i]; c >= '0' && c <= '9' {
			run++
			if run >= 12 {
				return true
			}
		} else {
			run = 0
		}
	}
	return strings.Contains(s, "eyJ")
}

type loggerKey struct{}

// WithLogger кладёт журнал в контекст: обработчик добавляет к нему request_id,
// и дальше по всей цепочке вызовов пишется уже он.
func WithLogger(ctx context.Context, l *slog.Logger) context.Context {
	return context.WithValue(ctx, loggerKey{}, l)
}

// LoggerFrom достаёт журнал из контекста. Если его там нет — возвращает общий,
// чтобы вызывающий код никогда не получал nil.
func LoggerFrom(ctx context.Context) *slog.Logger {
	if l, ok := ctx.Value(loggerKey{}).(*slog.Logger); ok && l != nil {
		return l
	}
	return slog.Default()
}

// StartupAttrs — набор полей, которые каждый процесс пишет при старте.
func StartupAttrs(process string, cfg config.Config, version, commit string, started time.Time) []any {
	return []any{
		slog.String("process", process),
		slog.String("version", version),
		slog.String("commit", commit),
		slog.Time("started_at", started.UTC()),
		slog.Any("config", cfg),
	}
}
