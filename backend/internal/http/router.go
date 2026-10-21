// Package httpapi собирает маршрутизатор и HTTP-серверы процесса.
//
// Имя пакета намеренно отличается от имени каталога: пакет с именем http
// перекрывал бы стандартный net/http в каждом файле, который его импортирует.
package httpapi

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"docflow/internal/buildinfo"
	"docflow/internal/config"
	"docflow/internal/domain"
	"docflow/internal/http/middleware"
	"docflow/internal/http/response"
	"docflow/internal/observability"
	"docflow/internal/service"
)

// Deps — то, без чего маршрутизатор не собрать. Передаём явно, а не через
// глобальные переменные: иначе в тестах пришлось бы поднимать весь процесс.
type Deps struct {
	Config  config.Config
	Metrics *observability.Metrics
	Health  *observability.Health
	// Service – бизнес-логика API. nil – только проверки состояния (тесты
	// каркаса без базы).
	Service *service.Service
}

// NewRouter собирает публичный API.
//
// Порядок обработчиков важен:
//  1. RequestID — чтобы у всего последующего был идентификатор обращения;
//  2. Recover — чтобы паника не миновала журнал и не уронила процесс;
//  3. Metrics и AccessLog — чтобы в них попали и ошибочные ответы;
//  4. Timeout и MaxBody — пределы до того, как обработчик начнёт работу.
func NewRouter(deps Deps) http.Handler {
	r := chi.NewRouter()

	r.Use(middleware.RequestID)
	r.Use(middleware.Recover)
	r.Use(middleware.Metrics(deps.Metrics))
	r.Use(middleware.AccessLog)
	r.Use(middleware.Timeout(deps.Config.HTTP.RequestTimeout))
	r.Use(middleware.MaxBody(deps.Config.HTTP.MaxBodyBytes))

	r.NotFound(notFound)
	r.MethodNotAllowed(methodNotAllowed)

	// Проверки состояния открыты без аутентификации: их опрашивают
	// балансировщик и оркестратор. Поэтому наружу они отдают только «жив»
	// и «готов», без причин отказа — причины видны на служебном адресе.
	r.Get("/healthz", liveHandler)
	r.Get("/readyz", readyHandler(deps.Health, false))
	r.Get("/version", versionHandler)

	if deps.Service != nil {
		r.Route("/api", func(r chi.Router) { mountAPI(r, deps.Service, deps.Config) })
	}

	return r
}

// NewMetricsRouter собирает служебный сервер: показатели и подробная проверка
// готовности. Он слушает отдельный адрес и наружу не публикуется.
func NewMetricsRouter(deps Deps) http.Handler {
	r := chi.NewRouter()

	r.Use(middleware.RequestID)
	r.Use(middleware.Recover)

	r.Handle("/metrics", deps.Metrics.Handler())
	r.Get("/healthz", liveHandler)
	r.Get("/readyz", readyHandler(deps.Health, true))

	return r
}

type statusPayload struct {
	Status string `json:"status"`
}

// liveHandler отвечает «процесс жив» и намеренно ничего не проверяет:
// иначе недоступность базы приведёт к перезапуску исправного процесса.
func liveHandler(w http.ResponseWriter, _ *http.Request) {
	response.JSON(w, http.StatusOK, statusPayload{Status: "ok"})
}

type readyPayload struct {
	Status string                 `json:"status"`
	Checks []observability.Result `json:"checks,omitempty"`
}

// readyHandler отвечает «готов обслуживать». Недоступность зависимости — это 503,
// по которому балансировщик убирает копию из ротации.
func readyHandler(h *observability.Health, withDetails bool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ready, results := h.Check(r.Context())

		payload := readyPayload{Status: "ok"}
		if !ready {
			payload.Status = "unavailable"
		}

		if withDetails {
			payload.Checks = results
		} else {
			// Снаружи причина отказа не показывается: в тексте ошибки
			// подключения бывают имена хостов, логины и строки подключения.
			payload.Checks = hideReasons(results)
		}

		status := http.StatusOK
		if !ready {
			status = http.StatusServiceUnavailable
		}
		response.JSON(w, status, payload)
	}
}

func hideReasons(results []observability.Result) []observability.Result {
	out := make([]observability.Result, 0, len(results))
	for _, r := range results {
		out = append(out, observability.Result{Name: r.Name, Status: r.Status})
	}
	return out
}

func versionHandler(w http.ResponseWriter, _ *http.Request) {
	response.JSON(w, http.StatusOK, buildinfo.Get())
}

func notFound(w http.ResponseWriter, r *http.Request) {
	response.Error(w, r, domain.ErrNotFound)
}

func methodNotAllowed(w http.ResponseWriter, r *http.Request) {
	response.JSON(w, http.StatusMethodNotAllowed, map[string]any{
		"error": map[string]any{
			"code":       "method_not_allowed",
			"message":    "Метод не поддерживается",
			"request_id": response.RequestIDFrom(r),
		},
	})
}
