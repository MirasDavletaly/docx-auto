// Команда api — HTTP-интерфейс системы.
//
// Процесс без состояния: масштабируется добавлением копий за балансировщиком
// (docs/architecture.md, п. 2).
package main

import (
	"context"
	"os"

	"docflow/internal/app"
	"docflow/internal/db"
	httpapi "docflow/internal/http"
	"docflow/internal/service"
)

const processName = "api"

func main() {
	a, err := app.Bootstrap(processName)
	if err != nil {
		app.Fail(processName, err)
	}

	pool, err := db.Open(context.Background(), a.Config.Database)
	if err != nil {
		app.Fail(processName, err)
	}
	defer pool.Close()
	// База – обязательная зависимость: без неё /readyz отвечает 503.
	a.Health.Register("database", db.Ping(pool))

	deps := httpapi.Deps{
		Config:  a.Config,
		Metrics: a.Metrics,
		Health:  a.Health,
		Service: service.New(pool, a.Config.Auth, nil),
	}

	public := httpapi.NewServer(
		"public",
		a.Config.HTTP.Addr,
		httpapi.NewRouter(deps),
		a.Config.HTTP,
		a.Logger,
	)

	// Показатели и подробная проверка готовности живут на отдельном адресе:
	// наружу публикуется только первый сервер.
	internal := httpapi.NewServer(
		"metrics",
		a.Config.HTTP.MetricsAddr,
		httpapi.NewMetricsRouter(deps),
		a.Config.HTTP,
		a.Logger,
	)

	// Порядок добавления задаёт порядок остановки: сначала перестаём принимать
	// обращения снаружи, служебный сервер уходит последним — чтобы до конца
	// остановки было видно показатели.
	a.Runner.Add(internal.Component())
	a.Runner.Add(public.Component())

	if err := a.Run(context.Background()); err != nil {
		os.Exit(1)
	}
}
