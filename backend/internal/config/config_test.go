package config

import (
	"log/slog"
	"strings"
	"testing"
	"time"
)

// validEnv — минимальный набор, при котором процесс обязан стартовать.
func validEnv() map[string]string {
	return map[string]string{
		"DATABASE_URL":       "postgres://app:secret@localhost:6432/docflow",
		"REDIS_URL":          "redis://localhost:6379/0",
		"STORAGE_ENDPOINT":   "localhost:9000",
		"STORAGE_ACCESS_KEY": "minio",
		"STORAGE_SECRET_KEY": "minio12345",
		"AUTH_JWT_SECRET":    "test-secret-0123456789abcdef-0123456789",
	}
}

func lookupFrom(env map[string]string) LookupFunc {
	return func(key string) (string, bool) {
		v, ok := env[key]
		return v, ok
	}
}

func TestLoadDefaults(t *testing.T) {
	cfg, err := load(lookupFrom(validEnv()))
	if err != nil {
		t.Fatalf("конфигурация должна загружаться: %v", err)
	}

	if cfg.Env != EnvDev {
		t.Errorf("APP_ENV по умолчанию: ожидалось %q, получено %q", EnvDev, cfg.Env)
	}
	if cfg.HTTP.Addr != ":8080" {
		t.Errorf("HTTP_ADDR по умолчанию: получено %q", cfg.HTTP.Addr)
	}
	// Таймауты из docs/architecture.md, п. 13. Если кто-то их поменяет,
	// тест должен об этом сказать: это часть защиты от зависших соединений.
	if cfg.HTTP.ReadHeaderTimeout != 5*time.Second {
		t.Errorf("ReadHeaderTimeout: получено %v", cfg.HTTP.ReadHeaderTimeout)
	}
	if cfg.HTTP.WriteTimeout != 30*time.Second {
		t.Errorf("WriteTimeout: получено %v", cfg.HTTP.WriteTimeout)
	}
	if cfg.HTTP.MaxBodyBytes != 1<<20 {
		t.Errorf("MaxBodyBytes: ожидался 1 МБ, получено %d", cfg.HTTP.MaxBodyBytes)
	}
	if cfg.Database.StatementTimeout != 5*time.Second {
		t.Errorf("StatementTimeout: получено %v", cfg.Database.StatementTimeout)
	}
}

func TestLoadReportsAllMissingVariables(t *testing.T) {
	_, err := load(lookupFrom(map[string]string{}))
	if err == nil {
		t.Fatal("без обязательных переменных загрузка обязана падать")
	}

	// Человек должен увидеть сразу весь список, а не по одной переменной за запуск.
	// Redis и хранилище файлов на этапе 1а не используются и не обязательны.
	for _, key := range []string{"DATABASE_URL", "AUTH_JWT_SECRET"} {
		if !strings.Contains(err.Error(), key) {
			t.Errorf("в тексте ошибки нет %s:\n%v", key, err)
		}
	}
}

func TestLoadRejectsBadValues(t *testing.T) {
	cases := map[string]struct {
		key, value string
		wantInErr  string
	}{
		"неизвестный режим":         {"APP_ENV", "staging", "APP_ENV"},
		"пустая строка как пропуск": {"DATABASE_URL", "   ", "DATABASE_URL"},
		"чужая схема БД":            {"DATABASE_URL", "mysql://localhost/docflow", "DATABASE_URL"},
		"не длительность":           {"HTTP_READ_TIMEOUT", "15 секунд", "HTTP_READ_TIMEOUT"},
		"нулевой таймаут":           {"HTTP_READ_TIMEOUT", "0s", "HTTP_READ_TIMEOUT"},
		"отрицательный таймаут":     {"SHUTDOWN_TIMEOUT", "-5s", "SHUTDOWN_TIMEOUT"},
		"не число":                  {"DATABASE_MAX_CONNS", "много", "DATABASE_MAX_CONNS"},
		"пул вне диапазона":         {"DATABASE_MAX_CONNS", "0", "DATABASE_MAX_CONNS"},
		"не булево":                 {"LOG_JSON", "ага", "LOG_JSON"},
		"неизвестный уровень":       {"LOG_LEVEL", "verbose", "LOG_LEVEL"},
	}

	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			env := validEnv()
			env[tc.key] = tc.value

			_, err := load(lookupFrom(env))
			if err == nil {
				t.Fatalf("%s=%q должно отвергаться", tc.key, tc.value)
			}
			if !strings.Contains(err.Error(), tc.wantInErr) {
				t.Errorf("ошибка не называет проблемную переменную %s:\n%v", tc.wantInErr, err)
			}
		})
	}
}

func TestLoadRequiresJSONLogsInProd(t *testing.T) {
	env := validEnv()
	env["APP_ENV"] = "prod"
	env["LOG_JSON"] = "false"

	if _, err := load(lookupFrom(env)); err == nil {
		t.Fatal("в prod человекочитаемые логи запрещены: их не разберёт сборщик логов")
	}
}

func TestLoadRequiresRequestTimeoutBelowWriteTimeout(t *testing.T) {
	env := validEnv()
	env["HTTP_REQUEST_TIMEOUT"] = "30s"
	env["HTTP_WRITE_TIMEOUT"] = "30s"

	if _, err := load(lookupFrom(env)); err == nil {
		t.Fatal("при RequestTimeout >= WriteTimeout клиент получит обрыв вместо ответа об истечении времени")
	}
}

func TestLogValueHidesCredentials(t *testing.T) {
	cfg, err := load(lookupFrom(validEnv()))
	if err != nil {
		t.Fatalf("конфигурация должна загружаться: %v", err)
	}

	rendered := renderAttrs(cfg.LogValue())

	if strings.Contains(rendered, "secret") {
		t.Errorf("пароль из DATABASE_URL попал в лог: %s", rendered)
	}
	if strings.Contains(rendered, "app:") {
		t.Errorf("логин из DATABASE_URL попал в лог: %s", rendered)
	}
	// При этом разбирать инцидент по логу всё ещё можно.
	if !strings.Contains(rendered, "localhost:6432") {
		t.Errorf("в логе не осталось адреса базы: %s", rendered)
	}
}

func renderAttrs(v slog.Value) string {
	var b strings.Builder
	for _, a := range v.Group() {
		b.WriteString(a.Key)
		b.WriteString("=")
		b.WriteString(a.Value.String())
		b.WriteString(" ")
	}
	return b.String()
}

func TestLoadAuth(t *testing.T) {
	cfg, err := load(lookupFrom(validEnv()))
	if err != nil {
		t.Fatalf("конфигурация должна загружаться: %v", err)
	}
	if cfg.Auth.AccessTTL != 10*time.Minute || !cfg.Auth.CookieSecure || cfg.Auth.MaxAttempts != 5 {
		t.Errorf("значения входа по умолчанию: %+v", cfg.Auth)
	}

	short := validEnv()
	short["AUTH_JWT_SECRET"] = "коротко"
	if _, err := load(lookupFrom(short)); err == nil || !strings.Contains(err.Error(), "AUTH_JWT_SECRET") {
		t.Errorf("короткий ключ подписи должен отклоняться: %v", err)
	}

	insecure := validEnv()
	insecure["APP_ENV"] = "prod"
	insecure["AUTH_COOKIE_SECURE"] = "false"
	if _, err := load(lookupFrom(insecure)); err == nil || !strings.Contains(err.Error(), "AUTH_COOKIE_SECURE") {
		t.Errorf("в prod cookie без HTTPS должна отклоняться: %v", err)
	}

	noRedis := validEnv()
	delete(noRedis, "REDIS_URL")
	delete(noRedis, "STORAGE_ENDPOINT")
	delete(noRedis, "STORAGE_ACCESS_KEY")
	delete(noRedis, "STORAGE_SECRET_KEY")
	if _, err := load(lookupFrom(noRedis)); err != nil {
		t.Errorf("без Redis и хранилища этап 1а должен запускаться: %v", err)
	}
}
