package observability

import (
	"net/http"
	"strconv"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/collectors"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// Metrics — набор показателей процесса.
//
// Собственный регистр вместо стандартного: так видно, что именно процесс
// публикует, и случайная библиотека не добавит своих метрик молча.
type Metrics struct {
	registry *prometheus.Registry

	requests *prometheus.CounterVec
	duration *prometheus.HistogramVec
	inFlight prometheus.Gauge
}

// NewMetrics создаёт набор показателей и регистрирует стандартные сборщики
// среды выполнения Go и процесса операционной системы.
func NewMetrics(process string) *Metrics {
	registry := prometheus.NewRegistry()
	labels := prometheus.Labels{"process": process}

	m := &Metrics{
		registry: registry,
		requests: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name:        "http_requests_total",
				Help:        "Число обращений по методу, маршруту и коду ответа.",
				ConstLabels: labels,
			},
			// Маршрут берётся шаблоном ("/documents/{id}"), а не фактическим
			// путём: иначе каждый идентификатор документа создаст свой ряд
			// показателей и хранилище метрик захлебнётся.
			[]string{"method", "route", "status"},
		),
		duration: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:        "http_request_duration_seconds",
				Help:        "Время обработки обращения.",
				ConstLabels: labels,
				// Границы подобраны под цель этапа 9: p95 API меньше 300 мс.
				Buckets: []float64{0.005, 0.01, 0.025, 0.05, 0.1, 0.2, 0.3, 0.5, 1, 2, 5, 10},
			},
			[]string{"method", "route"},
		),
		inFlight: prometheus.NewGauge(prometheus.GaugeOpts{
			Name:        "http_requests_in_flight",
			Help:        "Число обращений, обрабатываемых прямо сейчас.",
			ConstLabels: labels,
		}),
	}

	registry.MustRegister(
		m.requests,
		m.duration,
		m.inFlight,
		collectors.NewGoCollector(),
		collectors.NewProcessCollector(collectors.ProcessCollectorOpts{}),
	)
	return m
}

// ObserveRequest записывает завершённое обращение.
func (m *Metrics) ObserveRequest(method, route string, status int, took time.Duration) {
	if route == "" {
		// Обращение не попало ни в один маршрут. Отдельная метка вместо
		// пустой строки: иначе неизвестные пути сольются с известными.
		route = "unmatched"
	}
	m.requests.WithLabelValues(method, route, strconv.Itoa(status)).Inc()
	m.duration.WithLabelValues(method, route).Observe(took.Seconds())
}

// StartRequest отмечает начало обработки и возвращает функцию завершения.
func (m *Metrics) StartRequest() func() {
	m.inFlight.Inc()
	return m.inFlight.Dec
}

// Registry открывает регистр для процессов, которым нужно добавить свои
// показатели (очереди, задачи, outbox).
func (m *Metrics) Registry() *prometheus.Registry { return m.registry }

// Handler отдаёт показатели.
//
// Он вешается на отдельный адрес, а не на публичный API: показатели раскрывают
// внутреннее устройство системы, и снаружи им делать нечего.
func (m *Metrics) Handler() http.Handler {
	return promhttp.HandlerFor(m.registry, promhttp.HandlerOpts{
		ErrorHandling: promhttp.ContinueOnError,
	})
}
