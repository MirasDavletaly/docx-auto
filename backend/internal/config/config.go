// Package config читает настройки процесса из переменных окружения.
//
// Два правила, ради которых пакет устроен именно так:
//   - секреты берутся только из окружения, в репозитории их нет (CLAUDE.md, п. 3.10);
//   - процесс падает при старте, если настройка отсутствует или бессмысленна, а не при
//     первом запросе (CLAUDE.md, п. 6: «никаких заглушек»).
//
// Ошибки собираются все сразу: человеку показывается полный список того, что надо
// дописать в .env, а не первая попавшаяся переменная.
package config

import (
	"errors"
	"fmt"
	"log/slog"
	"math"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
)

// Env — режим работы процесса. От него зависят формат логов и строгость проверок.
type Env string

const (
	EnvDev  Env = "dev"
	EnvTest Env = "test"
	EnvProd Env = "prod"
)

// Valid сообщает, известен ли режим.
func (e Env) Valid() bool {
	switch e {
	case EnvDev, EnvTest, EnvProd:
		return true
	default:
		return false
	}
}

// IsProd используется там, где в бою нужно поведение строже, чем в разработке.
func (e Env) IsProd() bool { return e == EnvProd }

// Config — полный набор настроек. Все процессы (api, worker, relay, scheduler,
// migrate, seed) читают один и тот же набор: так .env остаётся единственным.
type Config struct {
	Env      Env
	Log      Log
	HTTP     HTTP
	Database Database
	Redis    Redis
	Storage  Storage
	Auth     Auth

	// ShutdownTimeout — сколько ждать завершения начатой работы после сигнала.
	ShutdownTimeout time.Duration
}

// Log — настройки журналирования.
type Log struct {
	Level slog.Level
	// JSON=false включает человекочитаемый вывод; допустимо только в разработке.
	JSON bool
}

// HTTP — адреса и таймауты HTTP-серверов (docs/architecture.md, п. 13).
type HTTP struct {
	Addr        string
	MetricsAddr string

	ReadHeaderTimeout time.Duration
	ReadTimeout       time.Duration
	WriteTimeout      time.Duration
	IdleTimeout       time.Duration

	// RequestTimeout — предельное время обработки одного запроса.
	RequestTimeout time.Duration
	// MaxBodyBytes — предел размера тела запроса (CLAUDE.md, п. 3.11).
	MaxBodyBytes int64

	// TrustProxy — адрес клиента брать из X-Forwarded-For (последний адрес:
	// его дописал наш Caddy). Включать только за своим прокси: иначе адрес
	// подделает кто угодно и обойдёт ограничение частоты входа.
	TrustProxy bool

	// Ограничения частоты, обращений в минуту (CLAUDE.md, п. 3.8, 3.11):
	// вход – с одного адреса; API – одного человека и одной компании.
	LoginPerMinute   int
	UserPerMinute    int
	CompanyPerMinute int
}

// Database — подключение к PostgreSQL через PgBouncer.
type Database struct {
	// URL содержит пароль, поэтому наружу отдаётся только в скрытом виде.
	URL string
	// MaxConns ограничивает пул приложения: PgBouncer не спасает от того,
	// что каждый процесс откроет сотни соединений.
	MaxConns int32
	// StatementTimeout — предел на один запрос к БД (CLAUDE.md, п. 3.11).
	StatementTimeout time.Duration
}

// Redis — кэш, счётчики и очереди.
//
// На этапе 1а не используется: пусто – не подключается. Станет
// обязательным вместе с очередями (этап 2).
type Redis struct {
	URL string
}

// Auth — вход и токены (CLAUDE.md, п. 3.8).
type Auth struct {
	// JWTSecret подписывает access-токены (HS256). Не короче 32 байт.
	JWTSecret []byte
	// AccessTTL — срок access-токена: 10 минут.
	AccessTTL time.Duration
	// RefreshTTL — срок refresh-токена; каждое использование выдаёт новый.
	RefreshTTL time.Duration
	// CookieSecure — refresh-cookie только по HTTPS. Выключить можно лишь в
	// разработке.
	CookieSecure bool
	// MaxAttempts неудачных входов подряд – и вход закрыт на LockFor.
	MaxAttempts int
	LockFor     time.Duration
}

// Storage — объектное хранилище (MinIO/S3).
type Storage struct {
	Endpoint  string
	AccessKey string
	SecretKey string
	Bucket    string
	UseSSL    bool
}

// Load читает конфигурацию из окружения процесса.
func Load() (Config, error) { return load(os.LookupEnv) }

// LoadFrom читает конфигурацию из заданного набора значений.
//
// Нужен тестам: они собирают настройки, не трогая окружение процесса, и поэтому
// могут идти параллельно.
func LoadFrom(values map[string]string) (Config, error) {
	return load(func(key string) (string, bool) {
		v, ok := values[key]
		return v, ok
	})
}

// LookupFunc повторяет сигнатуру os.LookupEnv и позволяет тестировать загрузку
// без глобального состояния процесса.
type LookupFunc func(key string) (string, bool)

func load(lookup LookupFunc) (Config, error) {
	l := &loader{lookup: lookup}

	cfg := Config{
		Env: Env(l.str("APP_ENV", "dev")),
		Log: Log{
			Level: l.level("LOG_LEVEL", slog.LevelInfo),
			JSON:  l.bool("LOG_JSON", true),
		},
		HTTP: HTTP{
			Addr:        l.str("HTTP_ADDR", ":8080"),
			MetricsAddr: l.str("METRICS_ADDR", ":9090"),

			ReadHeaderTimeout: l.duration("HTTP_READ_HEADER_TIMEOUT", 5*time.Second),
			ReadTimeout:       l.duration("HTTP_READ_TIMEOUT", 15*time.Second),
			WriteTimeout:      l.duration("HTTP_WRITE_TIMEOUT", 30*time.Second),
			IdleTimeout:       l.duration("HTTP_IDLE_TIMEOUT", 60*time.Second),

			RequestTimeout: l.duration("HTTP_REQUEST_TIMEOUT", 20*time.Second),
			MaxBodyBytes:   l.bytes("HTTP_MAX_BODY_BYTES", 1<<20),

			TrustProxy:       l.bool("HTTP_TRUST_PROXY", false),
			LoginPerMinute:   int(l.intInRange("RATE_LOGIN_PER_MINUTE", 20, 1, 10000, 32)),
			UserPerMinute:    int(l.intInRange("RATE_USER_PER_MINUTE", 600, 1, 100000, 32)),
			CompanyPerMinute: int(l.intInRange("RATE_COMPANY_PER_MINUTE", 3000, 1, 1000000, 32)),
		},
		Database: Database{
			URL:              l.requiredURL("DATABASE_URL", "postgres", "postgresql"),
			MaxConns:         l.int32InRange("DATABASE_MAX_CONNS", 10, 1, 1000),
			StatementTimeout: l.duration("DATABASE_STATEMENT_TIMEOUT", 5*time.Second),
		},
		Redis: Redis{
			URL: l.optionalURL("REDIS_URL", "redis", "rediss"),
		},
		Storage: Storage{
			Endpoint:  l.str("STORAGE_ENDPOINT", ""),
			AccessKey: l.str("STORAGE_ACCESS_KEY", ""),
			SecretKey: l.str("STORAGE_SECRET_KEY", ""),
			Bucket:    l.str("STORAGE_BUCKET", "docflow"),
			UseSSL:    l.bool("STORAGE_USE_SSL", false),
		},
		Auth: Auth{
			JWTSecret:    []byte(l.required("AUTH_JWT_SECRET")),
			AccessTTL:    l.duration("AUTH_ACCESS_TTL", 10*time.Minute),
			RefreshTTL:   l.duration("AUTH_REFRESH_TTL", 12*time.Hour),
			CookieSecure: l.bool("AUTH_COOKIE_SECURE", true),
			MaxAttempts:  int(l.intInRange("AUTH_MAX_ATTEMPTS", 5, 1, 100, 32)),
			LockFor:      l.duration("AUTH_LOCK_FOR", 15*time.Minute),
		},
		ShutdownTimeout: l.duration("SHUTDOWN_TIMEOUT", 20*time.Second),
	}

	if !cfg.Env.Valid() {
		l.fail("APP_ENV", fmt.Sprintf("допустимы %q, %q, %q", EnvDev, EnvTest, EnvProd))
	}
	if cfg.Env.IsProd() && !cfg.Log.JSON {
		l.fail("LOG_JSON", "в режиме prod логи должны быть в JSON")
	}
	// Хранилище файлов (этап 5): задан адрес – нужны и ключи.
	if cfg.Storage.Endpoint != "" && (cfg.Storage.AccessKey == "" || cfg.Storage.SecretKey == "") {
		l.fail("STORAGE_ACCESS_KEY", "при заданном STORAGE_ENDPOINT нужны STORAGE_ACCESS_KEY и STORAGE_SECRET_KEY")
	}
	if len(cfg.Auth.JWTSecret) > 0 && len(cfg.Auth.JWTSecret) < 32 {
		l.fail("AUTH_JWT_SECRET", "не короче 32 знаков: короткий ключ подписи подбирается")
	}
	if cfg.Env.IsProd() && !cfg.Auth.CookieSecure {
		l.fail("AUTH_COOKIE_SECURE", "в режиме prod refresh-cookie только по HTTPS")
	}
	if cfg.HTTP.RequestTimeout >= cfg.HTTP.WriteTimeout {
		l.fail("HTTP_REQUEST_TIMEOUT", "должен быть меньше HTTP_WRITE_TIMEOUT, иначе клиент получит обрыв вместо ответа")
	}

	if err := l.err(); err != nil {
		return Config{}, err
	}
	return cfg, nil
}

// LogValue отдаёт конфигурацию для логов без секретов: строки подключения содержат
// пароли, а им в логах не место (CLAUDE.md, п. 3.10).
func (c Config) LogValue() slog.Value {
	return slog.GroupValue(
		slog.String("env", string(c.Env)),
		slog.String("http_addr", c.HTTP.Addr),
		slog.String("metrics_addr", c.HTTP.MetricsAddr),
		slog.String("database", hideCredentials(c.Database.URL)),
		slog.String("redis", hideCredentials(c.Redis.URL)),
		slog.String("storage_endpoint", c.Storage.Endpoint),
		slog.String("storage_bucket", c.Storage.Bucket),
	)
}

// hideCredentials оставляет от строки подключения только то, что полезно при
// разборе инцидента: схему, хост и имя базы. Логин и пароль убираются.
func hideCredentials(raw string) string {
	u, err := url.Parse(raw)
	if err != nil {
		return "[не разобрано]"
	}
	u.User = nil
	u.RawQuery = ""
	return u.String()
}

// loader накапливает ошибки разбора, чтобы показать их одним списком.
type loader struct {
	lookup LookupFunc
	errs   []error
}

// ErrInvalid — признак того, что процесс не запустился именно из-за настроек,
// а не из-за недоступной зависимости. По нему это отличают вызывающий код и тесты.
var ErrInvalid = errors.New("неверная настройка окружения")

func (l *loader) fail(key, reason string) {
	l.errs = append(l.errs, fmt.Errorf("%w: %s: %s", ErrInvalid, key, reason))
}

func (l *loader) err() error {
	if len(l.errs) == 0 {
		return nil
	}
	return fmt.Errorf("настройки окружения заполнены неверно:\n\t%w", errors.Join(l.errs...))
}

func (l *loader) raw(key string) (string, bool) {
	v, ok := l.lookup(key)
	if !ok {
		return "", false
	}
	v = strings.TrimSpace(v)
	if v == "" {
		return "", false
	}
	return v, true
}

func (l *loader) str(key, def string) string {
	if v, ok := l.raw(key); ok {
		return v
	}
	return def
}

func (l *loader) required(key string) string {
	v, ok := l.raw(key)
	if !ok {
		l.fail(key, "обязательная переменная не задана")
		return ""
	}
	return v
}

// optionalURL – как requiredURL, но пустое значение допустимо.
func (l *loader) optionalURL(key string, schemes ...string) string {
	if _, ok := l.raw(key); !ok {
		return ""
	}
	return l.requiredURL(key, schemes...)
}

func (l *loader) requiredURL(key string, schemes ...string) string {
	v := l.required(key)
	if v == "" {
		return ""
	}
	u, err := url.Parse(v)
	if err != nil {
		l.fail(key, "не разбирается как URL")
		return v
	}
	for _, s := range schemes {
		if u.Scheme == s {
			return v
		}
	}
	l.fail(key, fmt.Sprintf("схема %q не подходит, ожидается одна из: %s", u.Scheme, strings.Join(schemes, ", ")))
	return v
}

func (l *loader) bool(key string, def bool) bool {
	v, ok := l.raw(key)
	if !ok {
		return def
	}
	parsed, err := strconv.ParseBool(v)
	if err != nil {
		l.fail(key, "ожидается true или false")
		return def
	}
	return parsed
}

func (l *loader) duration(key string, def time.Duration) time.Duration {
	v, ok := l.raw(key)
	if !ok {
		return def
	}
	parsed, err := time.ParseDuration(v)
	if err != nil {
		l.fail(key, "ожидается длительность, например 5s или 200ms")
		return def
	}
	if parsed <= 0 {
		l.fail(key, "должна быть положительной: таймаут обязателен у каждой операции")
		return def
	}
	return parsed
}

// intInRange разбирает целое в заданных границах.
//
// Разрядность задаётся явно (bitSize), а не приведением после разбора: приведение
// int -> int32 на 64-битной платформе способно молча изменить значение, и такой
// дефект в настройке пула соединений искали бы долго.
func (l *loader) intInRange(key string, def, minValue, maxValue int64, bitSize int) int64 {
	v, ok := l.raw(key)
	if !ok {
		return def
	}
	parsed, err := strconv.ParseInt(v, 10, bitSize)
	if err != nil {
		l.fail(key, "ожидается целое число")
		return def
	}
	if parsed < minValue || parsed > maxValue {
		l.fail(key, fmt.Sprintf("допустимо от %d до %d", minValue, maxValue))
		return def
	}
	return parsed
}

func (l *loader) int32InRange(key string, def, minValue, maxValue int32) int32 {
	v := l.intInRange(key, int64(def), int64(minValue), int64(maxValue), 32)

	// Разбор уже ограничен 32 битами и заданными границами, но проверка стоит
	// явно: приведение без неё нельзя проверить глазами, а молча испорченное
	// значение в настройке пула соединений искали бы долго.
	if v < math.MinInt32 || v > math.MaxInt32 {
		l.fail(key, "значение не помещается в 32 бита")
		return def
	}
	return int32(v)
}

func (l *loader) bytes(key string, def int64) int64 {
	return l.intInRange(key, def, 1024, 64<<20, 64)
}

func (l *loader) level(key string, def slog.Level) slog.Level {
	v, ok := l.raw(key)
	if !ok {
		return def
	}
	var lvl slog.Level
	if err := lvl.UnmarshalText([]byte(v)); err != nil {
		l.fail(key, "ожидается debug, info, warn или error")
		return def
	}
	return lvl
}
