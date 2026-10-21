package middleware

import (
	"sync"
	"time"
)

// Limiter – ограничение частоты: не больше limit обращений за окно на ключ
// (адрес, человек, компания). CLAUDE.md, п. 3.8 и 3.11.
//
// Счётчики – в памяти процесса: сервер API пока один. Когда копий станет
// несколько, счётчики переедут в Redis (docs/questions.md).
type Limiter struct {
	mu      sync.Mutex
	limit   int
	window  time.Duration
	now     func() time.Time
	buckets map[string]*bucket
	swept   time.Time
}

type bucket struct {
	start time.Time
	n     int
}

// maxBuckets – предел ключей в памяти: поток обращений с разных адресов не
// должен съесть память сервера. При переполнении старые окна вычищаются.
const maxBuckets = 100_000

// NewLimiter – limit обращений за window. now == nil – системные часы.
func NewLimiter(limit int, window time.Duration, now func() time.Time) *Limiter {
	if now == nil {
		now = time.Now
	}
	return &Limiter{limit: limit, window: window, now: now, buckets: make(map[string]*bucket)}
}

// Allow учитывает обращение. false – предел исчерпан; retry – через сколько
// откроется следующее окно.
func (l *Limiter) Allow(key string) (ok bool, retry time.Duration) {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := l.now()

	if now.Sub(l.swept) > l.window || len(l.buckets) >= maxBuckets {
		for k, b := range l.buckets {
			if now.Sub(b.start) >= l.window {
				delete(l.buckets, k)
			}
		}
		l.swept = now
	}

	b, found := l.buckets[key]
	if !found || now.Sub(b.start) >= l.window {
		if len(l.buckets) >= maxBuckets {
			// Все окна свежие и их слишком много – это нападение, а не
			// нагрузка: новые ключи не пропускаются, пока окна не истекут.
			return false, l.window
		}
		l.buckets[key] = &bucket{start: now, n: 1}
		return true, 0
	}
	if b.n >= l.limit {
		return false, b.start.Add(l.window).Sub(now)
	}
	b.n++
	return true, 0
}
