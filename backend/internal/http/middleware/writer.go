package middleware

import (
	"net/http"
)

// recorder запоминает код ответа и объём тела: без этого ни журнал обращений,
// ни метрики не смогут отличить успешный ответ от ошибки.
type recorder struct {
	http.ResponseWriter

	status int
	bytes  int64
	wrote  bool
}

func newRecorder(w http.ResponseWriter) *recorder {
	return &recorder{ResponseWriter: w, status: http.StatusOK}
}

func (r *recorder) WriteHeader(status int) {
	if r.wrote {
		return
	}
	r.status = status
	r.wrote = true
	r.ResponseWriter.WriteHeader(status)
}

func (r *recorder) Write(b []byte) (int, error) {
	if !r.wrote {
		// net/http подразумевает 200, если обработчик сразу начал писать тело.
		r.WriteHeader(http.StatusOK)
	}
	n, err := r.ResponseWriter.Write(b)
	r.bytes += int64(n)
	return n, err
}

// Unwrap открывает доступ к исходному ResponseWriter для http.ResponseController:
// без него перестанут работать сброс буфера и установка сроков на соединение.
func (r *recorder) Unwrap() http.ResponseWriter { return r.ResponseWriter }

// Written сообщает, ушёл ли клиенту хоть какой-то ответ. По нему видно, можно ли
// ещё заменить ответ на сообщение об ошибке.
func (r *recorder) Written() bool { return r.wrote }
