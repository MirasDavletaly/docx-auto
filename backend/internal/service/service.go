// Package service – бизнес-логика этапа 1а: вход, учётные записи, компании,
// перенос данных из браузера (docs/plans/phase-01a-users-db.md).
//
// Слои (CLAUDE.md, п. 3.3): здесь транзакции и решения доступа
// (internal/access), SQL – только через сгенерированный репозиторий, HTTP
// сюда не заходит. Каждая транзакция с данными идёт с контекстом человека и
// компании из токена (db.InTx) – Row-Level Security в базе пропускает только
// их строки, это вторая линия защиты после проверок здесь (п. 3.2).
package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"docflow/internal/access"
	"docflow/internal/auth"
	"docflow/internal/config"
	"docflow/internal/db"
	"docflow/internal/repository"
)

// Service – общая точка для обработчиков HTTP.
type Service struct {
	pool   *pgxpool.Pool
	tokens *auth.Tokens
	cfg    config.Auth
	// now – часы через интерфейс (CLAUDE.md, п. 6): сроки токенов и
	// блокировок проверяются тестами без ожидания.
	now func() time.Time
}

// New собирает сервис. now == nil – системные часы.
func New(pool *pgxpool.Pool, cfg config.Auth, now func() time.Time) *Service {
	if now == nil {
		now = time.Now
	}
	return &Service{pool: pool, tokens: auth.NewTokens(cfg.JWTSecret, cfg.AccessTTL, now), cfg: cfg, now: now}
}

// Tokens – для разбора access-токена в промежуточном слое HTTP.
func (s *Service) Tokens() *auth.Tokens { return s.tokens }

// tenant – контекст транзакции из того, кто выполняет запрос.
func tenant(p access.Principal) db.Tenant {
	return db.Tenant{UserID: p.UserID, CompanyID: p.CompanyID, PlatformAdmin: p.Platform}
}

func (s *Service) inTx(ctx context.Context, p access.Principal, fn func(*repository.Queries) error) error {
	return db.InTx(ctx, s.pool, tenant(p), func(tx pgx.Tx) error { return fn(repository.New(tx)) })
}

// ── Что отдаётся наружу ─────────────────────────────────────────────────────

// Profile – личное в учётной записи: хранится одним полем jsonb. Должности
// здесь нет: она в карточке персонала, своя в каждой компании.
type Profile struct {
	EmployeeID string `json:"employeeId,omitempty"`
	Phone      string `json:"phone,omitempty"`
	Email      string `json:"email,omitempty"`
	Avatar     string `json:"avatar,omitempty"`
}

// User – учётная запись в ответе API, как тип User на сайте.
type User struct {
	ID             string    `json:"id"`
	Login          string    `json:"login"`
	DisplayName    string    `json:"displayName"`
	Role           string    `json:"role"`
	CompanyIDs     []string  `json:"companyIds"`
	SectionIDs     []string  `json:"sectionIds"`
	ViewSectionIDs []string  `json:"viewSectionIds"`
	GrantedActions []string  `json:"grantedActions"`
	Blocked        bool      `json:"blocked"`
	HasPassword    bool      `json:"hasPassword"`
	CreatedAt      time.Time `json:"createdAt"`
	LockVersion    int32     `json:"lockVersion"`
	// Position – должность в карточке персонала текущей компании того, кто
	// смотрит; только для чтения, правится в персонале.
	Position string `json:"position,omitempty"`
	Profile
}

// Company – компания в ответе API: реквизиты целиком, как тип Company на
// сайте, плюс версия для оптимистичной блокировки.
type Company map[string]any

func companyView(id, name, bin string, requisites []byte, lockVersion int32) (Company, error) {
	c := Company{}
	if len(requisites) > 0 {
		if err := json.Unmarshal(requisites, &c); err != nil {
			return nil, fmt.Errorf("реквизиты компании %s: %w", id, err)
		}
	}
	c["id"], c["name"], c["bin"], c["lockVersion"] = id, name, bin, lockVersion
	return c, nil
}

// Me – кто вошёл: учётная запись, права, выбранная компания.
type Me struct {
	User        User     `json:"user"`
	Permissions []string `json:"permissions"`
	CompanyID   string   `json:"companyId"`
	Platform    bool     `json:"platform"`
}

// ── Общее ───────────────────────────────────────────────────────────────────

func text(v string) pgtype.Text { return pgtype.Text{String: v, Valid: v != ""} }

func ts(t time.Time) pgtype.Timestamptz { return pgtype.Timestamptz{Time: t, Valid: true} }

func isNoRows(err error) bool { return errors.Is(err, pgx.ErrNoRows) }

func audit(ctx context.Context, q *repository.Queries, p access.Principal, name, event, target, companyID, ip string) error {
	if err := q.InsertAudit(ctx, repository.InsertAuditParams{
		CompanyID: text(companyID),
		UserID:    text(p.UserID),
		UserName:  name,
		Event:     event,
		Target:    target,
		Ip:        ip,
	}); err != nil {
		return fmt.Errorf("журнал %s: %w", event, err)
	}
	return nil
}
