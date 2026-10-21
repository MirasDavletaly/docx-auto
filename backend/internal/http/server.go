package httpapi

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"

	"docflow/internal/config"
	"docflow/internal/observability"
	"docflow/internal/resilience"
)

// Server — HTTP-сервер с обязательными таймаутами.
//
// Таймауты заданы у всех четырёх стадий (CLAUDE.md, п. 3.11): без них медленный
// или забытый клиент удерживает соединение неограниченно долго, и копия api
// исчерпывает лимит дескрипторов, оставаясь при этом «живой» для проверок.
type Server struct {
	name   string
	server *http.Server
}

// NewServer готовит сервер к запуску.
func NewServer(name, addr string, handler http.Handler, cfg config.HTTP, logger *slog.Logger) *Server {
	return &Server{
		name: name,
		server: &http.Server{
			Addr:              addr,
			Handler:           handler,
			ReadHeaderTimeout: cfg.ReadHeaderTimeout,
			ReadTimeout:       cfg.ReadTimeout,
			WriteTimeout:      cfg.WriteTimeout,
			IdleTimeout:       cfg.IdleTimeout,
			ErrorLog:          slog.NewLogLogger(logger.Handler(), slog.LevelWarn),
			BaseContext: func(_ net.Listener) context.Context {
				// Журнал процесса кладётся в основу контекста каждого
				// обращения: middleware добавит к нему идентификатор.
				return observability.WithLogger(context.Background(), logger)
			},
		},
	}
}

// Start принимает обращения до остановки сервера.
func (s *Server) Start(context.Context) error {
	err := s.server.ListenAndServe()
	if errors.Is(err, http.ErrServerClosed) {
		// Плановая остановка — это не сбой.
		return nil
	}
	if err != nil {
		return fmt.Errorf("сервер %s: %w", s.name, err)
	}
	return nil
}

// Stop перестаёт принимать новые обращения и ждёт завершения начатых.
func (s *Server) Stop(ctx context.Context) error {
	if err := s.server.Shutdown(ctx); err != nil {
		return fmt.Errorf("остановка сервера %s: %w", s.name, err)
	}
	return nil
}

// Name возвращает имя сервера для журнала.
func (s *Server) Name() string { return s.name }

// Component описывает сервер в терминах запуска и остановки процесса.
func (s *Server) Component() resilience.Component {
	return resilience.Component{
		Name:  "http:" + s.name,
		Start: s.Start,
		Stop:  s.Stop,
	}
}
