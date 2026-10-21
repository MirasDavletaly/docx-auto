package observability

import (
	"bytes"
	"encoding/json"
	"errors"
	"log/slog"
	"strings"
	"testing"

	"docflow/internal/config"
)

func newTestLogger() (*slog.Logger, *bytes.Buffer) {
	var buf bytes.Buffer
	l := NewLogger(config.Log{Level: slog.LevelDebug, JSON: true}, &buf)
	return l, &buf
}

// Значения, которых не должно оказаться в журнале ни при каких обстоятельствах.
const (
	secretPassword = "hunter2-очень-секретно"
	secretToken    = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.s3cr3tS1gnatur3"
	secretIIN      = "870115300123"
	secretSalary   = "450000"
)

func TestLoggerHidesSecretsByFieldName(t *testing.T) {
	cases := []struct {
		name  string
		key   string
		value string
	}{
		{"пароль", "password", secretPassword},
		{"пароль в составном имени", "db_password", secretPassword},
		{"другой регистр и дефис", "Refresh-Token", secretToken},
		{"заголовок авторизации", "authorization", "Bearer " + secretToken},
		{"ИИН", "iin", secretIIN},
		{"оклад", "salary", secretSalary},
		{"адрес", "address", "г. Алматы, ул. Абая, 1"},
		{"строка подключения", "dsn", "postgres://app:" + secretPassword + "@db:5432/docflow"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			logger, buf := newTestLogger()
			logger.Info("операция выполнена", slog.String(tc.key, tc.value))

			out := buf.String()
			if strings.Contains(out, tc.value) {
				t.Fatalf("значение поля %q попало в журнал: %s", tc.key, out)
			}
			if !strings.Contains(out, Placeholder) {
				t.Fatalf("поле %q не помечено как скрытое: %s", tc.key, out)
			}
		})
	}
}

func TestLoggerHidesSecretsByValueShape(t *testing.T) {
	// Даже если имя поля выглядит безобидно, значение может оказаться токеном
	// или ИИН — например, когда в журнал попадает текст ошибки или комментарий.
	cases := []struct {
		name  string
		attr  slog.Attr
		leaks string
	}{
		{"токен внутри примечания", slog.String("note", "прислали заголовок "+secretToken), secretToken},
		{"ИИН внутри примечания", slog.String("note", "работник с ИИН "+secretIIN+" уволен"), secretIIN},
		{"ИИН в ошибке", slog.Any("error", errors.New("не найден сотрудник "+secretIIN)), secretIIN},
		{"ИИН во вложенной группе", slog.Group("employee", slog.String("comment", secretIIN)), secretIIN},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			logger, buf := newTestLogger()
			logger.Info("обработка", tc.attr)

			if out := buf.String(); strings.Contains(out, tc.leaks) {
				t.Fatalf("чувствительное значение попало в журнал: %s", out)
			}
		})
	}
}

func TestLoggerHidesSecretsInMessageAndInheritedAttrs(t *testing.T) {
	logger, buf := newTestLogger()

	// Поля, добавленные через With, проходят ту же чистку: иначе достаточно
	// один раз положить токен в журнал запроса, и он будет в каждой записи.
	child := logger.With(slog.String("access_token", secretToken))
	child.Info("вход выполнен для ИИН " + secretIIN)

	out := buf.String()
	if strings.Contains(out, secretToken) {
		t.Errorf("токен из With попал в журнал: %s", out)
	}
	if strings.Contains(out, secretIIN) {
		t.Errorf("ИИН из текста сообщения попал в журнал: %s", out)
	}
}

func TestLoggerKeepsOrdinaryValues(t *testing.T) {
	logger, buf := newTestLogger()

	logger.Info("запрос обработан",
		slog.String("http_addr", ":8080"),
		slog.String("method", "POST"),
		slog.Int("status", 201),
		slog.String("request_id", "3f2b1c0a"),
	)

	var record map[string]any
	if err := json.Unmarshal(bytes.TrimSpace(buf.Bytes()), &record); err != nil {
		t.Fatalf("журнал должен быть корректным JSON: %v (%s)", err, buf.String())
	}

	// Чистка не должна съедать обычные поля, иначе разбирать инциденты нечем.
	for key, want := range map[string]any{
		"http_addr":  ":8080",
		"method":     "POST",
		"status":     float64(201),
		"request_id": "3f2b1c0a",
		"msg":        "запрос обработан",
	} {
		if got := record[key]; got != want {
			t.Errorf("поле %q: ожидалось %v, получено %v", key, want, got)
		}
	}
}

func TestLoggerWritesTimeInUTC(t *testing.T) {
	logger, buf := newTestLogger()
	logger.Info("проверка времени")

	var record struct {
		Time string `json:"time"`
	}
	if err := json.Unmarshal(bytes.TrimSpace(buf.Bytes()), &record); err != nil {
		t.Fatalf("журнал должен быть корректным JSON: %v", err)
	}
	// Моменты времени хранятся и пишутся в UTC (CLAUDE.md, п. 3.9).
	if !strings.HasSuffix(record.Time, "Z") {
		t.Errorf("время записано не в UTC: %s", record.Time)
	}
}

func TestRedactStringLeavesShortNumbersAlone(t *testing.T) {
	// Двенадцать цифр подряд — ИИН или БИН. Одиннадцать и тринадцать — нет,
	// и портить такие значения не нужно.
	cases := map[string]bool{
		"номер 123":             false,
		"сумма 1234567":         false,
		"11 цифр 12345678901":   false,
		"12 цифр 123456789012":  true,
		"13 цифр 1234567890123": false,
	}

	for input, wantRedacted := range cases {
		got := redactString(input) != input
		if got != wantRedacted {
			t.Errorf("%q: ожидалось скрытие=%v, получено %v (результат %q)", input, wantRedacted, got, redactString(input))
		}
	}
}
