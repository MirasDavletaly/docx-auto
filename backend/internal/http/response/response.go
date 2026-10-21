// Package response — единственное место, где доменные ошибки превращаются в коды
// и тела ответов HTTP (CLAUDE.md, п. 6). Если перевод разъедется по обработчикам,
// одна и та же ситуация начнёт отвечать по-разному, и сайт не сможет на это
// полагаться.
package response

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"docflow/internal/domain"
	"docflow/internal/observability"
)

// Code — машиночитаемый код ошибки. Сайт разбирает именно его, а не текст.
type Code string

const (
	CodeNotFound     Code = "not_found"
	CodeUnauthorized Code = "unauthorized"
	CodeBadLogin     Code = "invalid_credentials"
	CodeIdempotency  Code = "idempotency_mismatch"
	CodeForbidden    Code = "forbidden"
	CodeConflict     Code = "conflict"
	// CodeCompanyChanged – реквизиты компании правили, пока документ был открыт.
	CodeCompanyChanged Code = "company_changed"
	CodeValidation     Code = "validation_failed"
	CodeRateLimited    Code = "rate_limited"
	CodeTooLarge       Code = "payload_too_large"
	CodeBadRequest     Code = "bad_request"
	CodeTimeout        Code = "timeout"
	CodeCanceled       Code = "canceled"
	CodeInternal       Code = "internal_error"
)

// statusClientClosedRequest — нестандартный код 499 из nginx. Он нужен, чтобы
// прерванные клиентом обращения не считались ни успешными, ни сбоями сервера.
const statusClientClosedRequest = 499

// FieldError — ошибка по конкретному полю формы.
type FieldError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

// ErrorPayload — тело ответа об ошибке.
type ErrorPayload struct {
	Code Code `json:"code"`
	// Message предназначен для показа пользователю и написан по-русски.
	Message string `json:"message"`
	// RequestID позволяет человеку назвать поддержке номер обращения,
	// по которому в журнале находится вся цепочка.
	RequestID string       `json:"request_id,omitempty"`
	Fields    []FieldError `json:"fields,omitempty"`
}

type errorBody struct {
	Error ErrorPayload `json:"error"`
}

// JSON пишет успешный ответ.
func JSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if payload == nil {
		return
	}
	if err := json.NewEncoder(w).Encode(payload); err != nil {
		// Заголовки уже отправлены, исправить ответ нельзя — остаётся записать
		// это в журнал, чтобы обрыв не выглядел как успешный запрос.
		slog.Default().Error("не удалось записать тело ответа", slog.Any("error", err))
	}
}

// NoContent отвечает без тела.
func NoContent(w http.ResponseWriter) {
	w.WriteHeader(http.StatusNoContent)
}

// Error переводит ошибку в ответ HTTP.
//
// Наружу уходит только то, что можно показать пользователю: подробности
// внутренних сбоев остаются в журнале, иначе в ответе окажется текст ошибки
// базы данных вместе с именами таблиц и параметрами запроса.
func Error(w http.ResponseWriter, r *http.Request, err error) {
	requestID := RequestIDFrom(r)
	status, payload := translate(err)
	payload.RequestID = requestID

	logger := observability.LoggerFrom(r.Context())
	if status >= http.StatusInternalServerError {
		logger.Error("запрос завершился сбоем",
			slog.Any("error", err),
			slog.Int("status", status),
		)
	} else {
		logger.Debug("запрос отклонён",
			slog.String("code", string(payload.Code)),
			slog.Int("status", status),
		)
	}

	JSON(w, status, errorBody{Error: payload})
}

func translate(err error) (int, ErrorPayload) {
	switch {
	case errors.Is(err, domain.ErrNotFound):
		return http.StatusNotFound, ErrorPayload{
			Code:    CodeNotFound,
			Message: "Документ или запись не найдены",
		}

	case errors.Is(err, domain.ErrInvalidCredentials):
		return http.StatusUnauthorized, ErrorPayload{
			Code:    CodeBadLogin,
			Message: "Неверный логин или пароль",
		}

	case errors.Is(err, domain.ErrIdempotencyMismatch):
		return http.StatusUnprocessableEntity, ErrorPayload{
			Code:    CodeIdempotency,
			Message: "Запрос уже отправлялся с другими данными. Обновите страницу и повторите",
		}

	case errors.Is(err, domain.ErrUnauthorized):
		return http.StatusUnauthorized, ErrorPayload{
			Code:    CodeUnauthorized,
			Message: "Нужно войти в систему",
		}

	case errors.Is(err, domain.ErrForbidden):
		return http.StatusForbidden, ErrorPayload{
			Code:    CodeForbidden,
			Message: "Действие недоступно",
		}

	case errors.Is(err, domain.ErrCompanyChanged):
		return http.StatusConflict, ErrorPayload{
			Code:    CodeCompanyChanged,
			Message: "Реквизиты компании изменились. Проверьте документ и сохраните ещё раз",
		}

	case errors.Is(err, domain.ErrConflict):
		return http.StatusConflict, ErrorPayload{
			Code:    CodeConflict,
			Message: "Данные изменились, обновите страницу и повторите",
		}

	case errors.Is(err, domain.ErrRateLimited):
		return http.StatusTooManyRequests, ErrorPayload{
			Code:    CodeRateLimited,
			Message: "Слишком много обращений, повторите позже",
		}

	case errors.Is(err, context.DeadlineExceeded):
		// Обработка не уложилась в отведённое время. Для клиента это не его
		// ошибка, поэтому код 504, а не 400.
		return http.StatusGatewayTimeout, ErrorPayload{
			Code:    CodeTimeout,
			Message: "Обработка заняла слишком много времени, повторите позже",
		}

	case errors.Is(err, context.Canceled):
		// Клиент ушёл. Ответ уже никто не прочитает, но код должен быть
		// непохож на успех, чтобы не портить статистику.
		return statusClientClosedRequest, ErrorPayload{
			Code:    CodeCanceled,
			Message: "Обращение прервано",
		}
	}

	if v, ok := domain.AsValidationError(err); ok {
		fields := make([]FieldError, 0, len(v.Fields))
		for _, f := range v.Fields {
			fields = append(fields, FieldError{Field: f.Field, Message: f.Message})
		}
		return http.StatusUnprocessableEntity, ErrorPayload{
			Code:    CodeValidation,
			Message: "Проверьте заполнение полей",
			Fields:  fields,
		}
	}

	return http.StatusInternalServerError, ErrorPayload{
		Code:    CodeInternal,
		Message: "Внутренняя ошибка. Попробуйте позже или сообщите номер обращения в поддержку",
	}
}

// BadRequest отвечает на запрос, который не удалось даже разобрать.
func BadRequest(w http.ResponseWriter, r *http.Request, message string) {
	JSON(w, http.StatusBadRequest, errorBody{Error: ErrorPayload{
		Code:      CodeBadRequest,
		Message:   message,
		RequestID: RequestIDFrom(r),
	}})
}

// TooLarge отвечает на превышение предела размера тела запроса.
func TooLarge(w http.ResponseWriter, r *http.Request) {
	JSON(w, http.StatusRequestEntityTooLarge, errorBody{Error: ErrorPayload{
		Code:      CodeTooLarge,
		Message:   "Запрос слишком большой",
		RequestID: RequestIDFrom(r),
	}})
}
