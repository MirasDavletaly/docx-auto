// Package app собирает общий каркас процесса.
//
// Все процессы (api, worker, relay, scheduler, migrate, seed) поднимаются
// одинаково: читают одно и то же окружение, пишут одинаковые логи, публикуют
// одинаковые показатели и одинаково реагируют на сигнал. Общий код здесь нужен
// затем, чтобы эта одинаковость не держалась на дисциплине копирования.
package app

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"docflow/internal/buildinfo"
	"docflow/internal/config"
	"docflow/internal/observability"
	"docflow/internal/resilience"
)

// App — общее окружение процесса.
type App struct {
	Process string
	Config  config.Config
	Logger  *slog.Logger
	Metrics *observability.Metrics
	Health  *observability.Health
	Runner  *resilience.Runner
}

// healthCheckTimeout ограничивает проверку готовности: /readyz обязан отвечать
// быстро, иначе балансировщик посчитает копию зависшей.
const healthCheckTimeout = 3 * time.Second

// Bootstrap читает настройки и готовит журнал, показатели и проверки.
//
// Ошибка настроек возвращается до того, как процесс начнёт что-либо делать:
// упасть при старте с понятным сообщением лучше, чем принимать обращения
// и падать на первом же из них.
func Bootstrap(process string) (*App, error) {
	cfg, err := config.Load()
	if err != nil {
		return nil, err
	}

	logger := observability.NewLogger(cfg.Log, os.Stdout).With(slog.String("process", process))
	// Библиотеки и код, до которого контекст не доходит, пишут в общий журнал.
	// Он тоже должен проходить через фильтр секретов, поэтому назначается здесь.
	slog.SetDefault(logger)

	info := buildinfo.Get()
	logger.Info("процесс запускается",
		slog.String("version", info.Version),
		slog.String("commit", info.Commit),
		slog.Any("config", cfg),
	)

	return &App{
		Process: process,
		Config:  cfg,
		Logger:  logger,
		Metrics: observability.NewMetrics(process),
		Health:  observability.NewHealth(healthCheckTimeout),
		Runner:  resilience.NewRunner(logger),
	}, nil
}

// Run запускает добавленные части процесса и ждёт сигнала остановки.
func (a *App) Run(ctx context.Context) error {
	ctx, stop := signal.NotifyContext(ctx, os.Interrupt, syscall.SIGTERM)
	defer stop()

	err := a.Runner.Run(ctx, a.Config.ShutdownTimeout)

	if err != nil {
		a.Logger.Error("процесс остановлен из-за ошибки", slog.Any("error", err))
		return err
	}
	a.Logger.Info("процесс остановлен штатно")
	return nil
}

// Fail печатает ошибку старта и завершает процесс с ненулевым кодом.
//
// Журнала на этот момент может ещё не быть: настройки не прочитаны, а значит
// неизвестны ни уровень, ни формат. Поэтому пишем прямо в стандартный поток
// ошибок обычным текстом.
func Fail(process string, err error) {
	fmt.Fprintf(os.Stderr, "%s: не удалось запуститься: %v\n", process, err)
	os.Exit(1)
}
