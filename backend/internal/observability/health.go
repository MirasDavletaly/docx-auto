package observability

import (
	"context"
	"sort"
	"sync"
	"time"
)

// CheckFunc проверяет одну зависимость. Возвращает nil, если она доступна.
type CheckFunc func(ctx context.Context) error

// Health хранит проверки зависимостей для /readyz.
//
// Разделение простое и важное: /healthz отвечает «процесс жив» и не ходит никуда,
// иначе временная недоступность базы приведёт к тому, что оркестратор перезапустит
// исправный процесс. /readyz отвечает «готов обслуживать» и проверяет зависимости,
// чтобы балансировщик убрал копию из ротации.
type Health struct {
	timeout time.Duration

	mu     sync.RWMutex
	checks map[string]CheckFunc
}

// NewHealth создаёт набор проверок с общим предельным временем на каждую.
func NewHealth(timeout time.Duration) *Health {
	return &Health{
		timeout: timeout,
		checks:  make(map[string]CheckFunc),
	}
}

// Register добавляет проверку зависимости. Повторная регистрация под тем же
// именем заменяет прежнюю.
func (h *Health) Register(name string, check CheckFunc) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.checks[name] = check
}

// Result — итог проверки одной зависимости.
type Result struct {
	Name   string `json:"name"`
	Status string `json:"status"`
	// Error заполняется только для незавершившихся проверок и содержит
	// техническую причину. Наружу он отдаётся лишь на служебных адресах.
	Error string `json:"error,omitempty"`
}

const (
	StatusUp   = "up"
	StatusDown = "down"
)

// Check запускает все проверки параллельно и ждёт не дольше общего таймаута.
// Возвращает признак готовности и результат по каждой зависимости.
func (h *Health) Check(ctx context.Context) (bool, []Result) {
	h.mu.RLock()
	checks := make(map[string]CheckFunc, len(h.checks))
	for name, fn := range h.checks {
		checks[name] = fn
	}
	h.mu.RUnlock()

	results := make([]Result, 0, len(checks))
	if len(checks) == 0 {
		return true, results
	}

	ctx, cancel := context.WithTimeout(ctx, h.timeout)
	defer cancel()

	var (
		mu sync.Mutex
		wg sync.WaitGroup
	)
	for name, fn := range checks {
		wg.Add(1)
		go func(name string, fn CheckFunc) {
			defer wg.Done()

			res := Result{Name: name, Status: StatusUp}
			if err := fn(ctx); err != nil {
				res.Status = StatusDown
				res.Error = err.Error()
			}

			mu.Lock()
			results = append(results, res)
			mu.Unlock()
		}(name, fn)
	}
	wg.Wait()

	// Порядок делаем устойчивым: иначе ответ /readyz меняется от запроса
	// к запросу и его неудобно сравнивать в тестах и в мониторинге.
	sort.Slice(results, func(i, j int) bool { return results[i].Name < results[j].Name })

	ready := true
	for _, r := range results {
		if r.Status != StatusUp {
			ready = false
			break
		}
	}
	return ready, results
}
