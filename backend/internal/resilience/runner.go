// Package resilience содержит то, что удерживает систему от развала при сбоях:
// согласованный запуск и остановку составных частей процесса.
package resilience

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"sync"
	"time"
)

var (
	// ErrNothingToRun — процесс собран неправильно: запускать нечего.
	ErrNothingToRun = errors.New("нечего запускать: не добавлено ни одной части процесса")
	// ErrShutdownTimeout — части процесса не завершились за отведённое время.
	// По нему отличают «остановились сами» от «пришлось бросить как есть».
	ErrShutdownTimeout = errors.New("остановка не уложилась в отведённое время")
)

// Component — часть процесса, которую надо запустить и корректно остановить:
// HTTP-сервер, потребитель очереди, планировщик.
type Component struct {
	Name string
	// Start работает, пока часть жива. Возврат nil означает плановое завершение.
	Start func(ctx context.Context) error
	// Stop просит завершиться и ждёт этого не дольше переданного контекста.
	// Может быть nil, если останавливать нечего.
	Stop func(ctx context.Context) error
}

// Runner запускает части процесса вместе и вместе же их останавливает.
//
// Правило простое: процесс живёт, пока живы все его части. Отказ любой из них
// или сигнал извне останавливает остальные — так не остаётся наполовину живого
// процесса, который проверки считают исправным, а он уже ничего не делает.
type Runner struct {
	logger     *slog.Logger
	components []Component
}

// NewRunner создаёт пустой набор.
func NewRunner(logger *slog.Logger) *Runner {
	return &Runner{logger: logger}
}

// Add добавляет часть процесса. Останавливаются они в обратном порядке.
func (r *Runner) Add(c Component) {
	r.components = append(r.components, c)
}

// Run запускает все части и ждёт либо сигнала об остановке через контекст,
// либо отказа любой из них. Возвращается после того, как всё остановлено.
func (r *Runner) Run(ctx context.Context, shutdownTimeout time.Duration) error {
	if len(r.components) == 0 {
		return ErrNothingToRun
	}

	var (
		wg      sync.WaitGroup
		mu      sync.Mutex
		failure error
	)

	// Контекст, который получают Start: он закрывается первым, чтобы части
	// процесса узнали об остановке до того, как их попросят завершиться.
	runCtx, cancelRun := context.WithCancel(ctx)
	defer cancelRun()

	stopped := make(chan struct{})
	var once sync.Once
	triggerStop := func() { once.Do(func() { close(stopped) }) }

	for _, c := range r.components {
		wg.Add(1)
		go func(c Component) {
			defer wg.Done()

			r.logger.Info("запуск", slog.String("component", c.Name))

			if err := c.Start(runCtx); err != nil {
				mu.Lock()
				if failure == nil {
					failure = fmt.Errorf("%s: %w", c.Name, err)
				}
				mu.Unlock()

				r.logger.Error("часть процесса завершилась с ошибкой",
					slog.String("component", c.Name),
					slog.Any("error", err),
				)
			}
			// Завершение любой части — повод остановить процесс целиком,
			// даже если она завершилась без ошибки.
			triggerStop()
		}(c)
	}

	select {
	case <-ctx.Done():
		r.logger.Info("получен сигнал остановки, завершаем начатое")
	case <-stopped:
	}

	// Останавливаем в обратном порядке: сначала то, что принимает обращения,
	// потом то, на что оно опирается.
	stopCtx, cancelStop := context.WithTimeout(context.Background(), shutdownTimeout)
	defer cancelStop()

	for i := len(r.components) - 1; i >= 0; i-- {
		c := r.components[i]
		if c.Stop == nil {
			continue
		}
		// Контекст остановки намеренно отвязан от ctx: к этому моменту ctx уже
		// отменён сигналом, и унаследованный от него контекст не дал бы частям
		// процесса ни секунды на завершение начатых обращений.
		if err := c.Stop(stopCtx); err != nil { //nolint:contextcheck // см. комментарий выше
			r.logger.Error("не удалось остановить часть процесса",
				slog.String("component", c.Name),
				slog.Any("error", err),
			)
			mu.Lock()
			if failure == nil {
				failure = fmt.Errorf("остановка %s: %w", c.Name, err)
			}
			mu.Unlock()
		}
	}

	cancelRun()

	// Ждём, пока вернутся все Start. Без ожидания процесс может выйти раньше,
	// чем горутины допишут свои данные, а это и есть утечка горутин, которую
	// запрещает чек-лист качества.
	done := make(chan struct{})
	go func() {
		wg.Wait()
		close(done)
	}()

	select {
	case <-done:
	case <-stopCtx.Done():
		r.logger.Error("части процесса не завершились за отведённое время",
			slog.Duration("timeout", shutdownTimeout),
		)
		mu.Lock()
		if failure == nil {
			failure = ErrShutdownTimeout
		}
		mu.Unlock()
	}

	mu.Lock()
	defer mu.Unlock()
	return failure
}
