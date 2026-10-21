// Package buildinfo хранит сведения о сборке.
// Значения подставляются линковщиком: -ldflags "-X docflow/internal/buildinfo.Version=...".
package buildinfo

// Значения по умолчанию используются при сборке без ldflags (например, go run).
var (
	Version = "dev"
	Commit  = "unknown"
	Date    = "unknown"
)

// Info описывает сборку в виде, пригодном для ответа /version и для метки в логах.
type Info struct {
	Version string `json:"version"`
	Commit  string `json:"commit"`
	Date    string `json:"date"`
}

// Get возвращает сведения о текущей сборке.
func Get() Info {
	return Info{Version: Version, Commit: Commit, Date: Date}
}
