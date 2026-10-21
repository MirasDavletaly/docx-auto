package middleware

import (
	"testing"
	"time"
)

func TestLimiter(t *testing.T) {
	now := time.Date(2026, 10, 2, 10, 0, 0, 0, time.UTC)
	l := NewLimiter(3, time.Minute, func() time.Time { return now })

	for i := 0; i < 3; i++ {
		if ok, _ := l.Allow("a"); !ok {
			t.Fatalf("обращение %d отклонено", i+1)
		}
	}
	ok, retry := l.Allow("a")
	if ok || retry != time.Minute {
		t.Fatalf("четвёртое: ok=%v retry=%v", ok, retry)
	}
	// Другой ключ – свой счёт.
	if ok, _ := l.Allow("b"); !ok {
		t.Fatal("ключ b отклонён")
	}

	now = now.Add(40 * time.Second)
	if _, retry := l.Allow("a"); retry != 20*time.Second {
		t.Fatalf("до нового окна: %v", retry)
	}
	now = now.Add(20 * time.Second)
	if ok, _ := l.Allow("a"); !ok {
		t.Fatal("новое окно не открылось")
	}
}
