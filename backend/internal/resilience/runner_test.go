package resilience

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"sync"
	"testing"
	"time"
)

func testLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

// blocking описывает часть процесса, которая работает, пока её не остановят, —
// как HTTP-сервер или потребитель очереди.
func blocking(name string, log *record) Component {
	release := make(chan struct{})
	var once sync.Once

	return Component{
		Name: name,
		Start: func(ctx context.Context) error {
			log.add("start:" + name)
			select {
			case <-release:
			case <-ctx.Done():
			}
			return nil
		},
		Stop: func(context.Context) error {
			log.add("stop:" + name)
			once.Do(func() { close(release) })
			return nil
		},
	}
}

type record struct {
	mu     sync.Mutex
	events []string
}

func (r *record) add(e string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.events = append(r.events, e)
}

func (r *record) snapshot() []string {
	r.mu.Lock()
	defer r.mu.Unlock()
	return append([]string(nil), r.events...)
}

func TestRunnerStopsEverythingOnSignal(t *testing.T) {
	log := &record{}
	runner := NewRunner(testLogger())
	runner.Add(blocking("database", log))
	runner.Add(blocking("http", log))

	ctx, cancel := context.WithCancel(context.Background())

	done := make(chan error, 1)
	go func() { done <- runner.Run(ctx, 2*time.Second) }()

	// Сигнал остановки процесса.
	cancel()

	select {
	case err := <-done:
		if err != nil {
			t.Fatalf("штатная остановка не должна возвращать ошибку: %v", err)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("процесс не остановился: похоже, остались висящие горутины")
	}

	events := log.snapshot()
	stopOrder := filter(events, "stop:")
	// Останавливаемся в обратном порядке: сначала то, что принимает обращения,
	// потом то, на что оно опирается. Иначе последние обращения не смогут
	// сходить в базу.
	want := []string{"stop:http", "stop:database"}
	if len(stopOrder) != len(want) {
		t.Fatalf("порядок остановки: ожидалось %v, получено %v (все события: %v)", want, stopOrder, events)
	}
	for i := range want {
		if stopOrder[i] != want[i] {
			t.Fatalf("порядок остановки: ожидалось %v, получено %v", want, stopOrder)
		}
	}
}

func TestRunnerStopsEverythingWhenOnePartFails(t *testing.T) {
	log := &record{}
	failure := errors.New("порт занят")

	runner := NewRunner(testLogger())
	runner.Add(blocking("database", log))
	runner.Add(Component{
		Name:  "http",
		Start: func(context.Context) error { return failure },
	})

	done := make(chan error, 1)
	go func() { done <- runner.Run(context.Background(), 2*time.Second) }()

	select {
	case err := <-done:
		if !errors.Is(err, failure) {
			t.Fatalf("причина остановки должна дойти до вызывающего: %v", err)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("отказ одной части не остановил процесс")
	}

	// Исправная часть тоже должна быть остановлена: иначе остаётся процесс,
	// который проверки считают живым, хотя обращения он уже не принимает.
	if len(filter(log.snapshot(), "stop:database")) == 0 {
		t.Fatal("исправная часть процесса не была остановлена")
	}
}

func TestRunnerRefusesEmptySet(t *testing.T) {
	if err := NewRunner(testLogger()).Run(context.Background(), time.Second); err == nil {
		t.Fatal("запуск без единой части процесса — это ошибка сборки процесса")
	}
}

func filter(events []string, prefix string) []string {
	out := make([]string, 0, len(events))
	for _, e := range events {
		if len(e) >= len(prefix) && e[:len(prefix)] == prefix {
			out = append(out, e)
		}
	}
	return out
}
