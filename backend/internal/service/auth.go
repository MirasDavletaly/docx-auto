package service

import (
	"context"
	"encoding/json"
	"fmt"
	"slices"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"docflow/internal/access"
	"docflow/internal/auth"
	"docflow/internal/db"
	"docflow/internal/domain"
	"docflow/internal/repository"
)

// Session – что получает браузер после входа или обновления: access-токен в
// ответе (держится в памяти вкладки), refresh – в httpOnly-cookie.
type Session struct {
	AccessToken    string    `json:"accessToken"`
	AccessExpires  time.Time `json:"accessExpiresAt"`
	Me             Me        `json:"me"`
	RefreshToken   string    `json:"-"`
	RefreshExpires time.Time `json:"-"`
}

// Login – вход по логину и паролю.
//
// Ответ на любую неудачу один – domain.ErrInvalidCredentials, и время
// ответа одно: пароль проверяется и тогда, когда логина нет. Пять неудач
// подряд закрывают вход на cfg.LockFor (CLAUDE.md, п. 3.8).
func (s *Service) Login(ctx context.Context, login, password, ip string) (Session, error) {
	var found repository.AuthFindUserRow
	known := false
	if err := db.NoTenant(ctx, s.pool, func(tx pgx.Tx) error {
		row, err := repository.New(tx).AuthFindUser(ctx, login)
		if isNoRows(err) {
			return nil
		}
		found, known = row, err == nil
		return err
	}); err != nil {
		return Session{}, fmt.Errorf("поиск учётной записи: %w", err)
	}

	fail := func(event string, userID string, record bool) error {
		return db.NoTenant(ctx, s.pool, func(tx pgx.Tx) error {
			q := repository.New(tx)
			if record {
				locked, err := q.AuthRecordFailure(ctx, repository.AuthRecordFailureParams{
					PUserID: userID,
					PMax:    int32(s.cfg.MaxAttempts), //nolint:gosec // от 1 до 100 по настройкам
					PLock:   pgtype.Interval{Microseconds: s.cfg.LockFor.Microseconds(), Valid: true},
				})
				if err != nil {
					return err
				}
				if locked.Valid && locked.Time.After(s.now()) {
					event = "auth.locked"
				}
			}
			return audit(ctx, q, access.Principal{UserID: userID}, "", event, login, "", ip)
		})
	}

	switch {
	case !known:
		auth.BurnPasswordCheck(password)
		if err := fail("auth.failed", "", false); err != nil {
			return Session{}, err
		}
		return Session{}, domain.ErrInvalidCredentials
	case found.LockedUntil.Valid && found.LockedUntil.Time.After(s.now()), found.Blocked, !found.PasswordHash.Valid:
		auth.BurnPasswordCheck(password)
		if err := fail("auth.refused", found.ID, false); err != nil {
			return Session{}, err
		}
		return Session{}, domain.ErrInvalidCredentials
	case !auth.VerifyPassword(password, found.PasswordHash.String):
		if err := fail("auth.failed", found.ID, true); err != nil {
			return Session{}, err
		}
		return Session{}, domain.ErrInvalidCredentials
	}

	var session Session
	err := db.InTx(ctx, s.pool, db.Tenant{UserID: found.ID}, func(tx pgx.Tx) error {
		q := repository.New(tx)
		if err := q.AuthRecordSuccess(ctx, found.ID); err != nil {
			return err
		}
		family, err := auth.NewID("rf")
		if err != nil {
			return err
		}
		session, err = s.issue(ctx, q, found.ID, int(found.TokenVersion), family, "")
		if err != nil {
			return err
		}
		return audit(ctx, q, access.Principal{UserID: found.ID}, session.Me.User.DisplayName, "auth.signin", login, "", ip)
	})
	if err != nil {
		return Session{}, fmt.Errorf("вход: %w", err)
	}
	return session, nil
}

// issue – новый refresh в цепочке family и access-токен. Компания: wanted,
// если к ней есть доступ; иначе единственная компания человека; иначе –
// не выбрана (человек выберет на экране).
func (s *Service) issue(ctx context.Context, q *repository.Queries, userID string, version int, family, wanted string) (Session, error) {
	p, err := principal(ctx, q, userID)
	if err != nil {
		return Session{}, err
	}
	switch {
	case wanted != "" && p.HasCompany(wanted):
		p.CompanyID = wanted
	case !p.Platform && len(p.CompanyIDs) == 1:
		p.CompanyID = p.CompanyIDs[0]
	}

	refresh, hash, err := auth.NewRefreshToken()
	if err != nil {
		return Session{}, err
	}
	id, err := auth.NewID("rt")
	if err != nil {
		return Session{}, err
	}
	now := s.now()
	refreshExpires := now.Add(s.cfg.RefreshTTL)
	if err = q.InsertRefresh(ctx, repository.InsertRefreshParams{
		ID: id, UserID: userID, FamilyID: family, TokenHash: hash,
		TokenVersion: int32(version), //nolint:gosec // версия – небольшое число из базы
		ExpiresAt:    ts(refreshExpires),
	}); err != nil {
		return Session{}, fmt.Errorf("refresh-токен: %w", err)
	}
	access, err := s.tokens.Issue(auth.Claims{UserID: userID, CompanyID: p.CompanyID, TokenVersion: version})
	if err != nil {
		return Session{}, err
	}
	me, err := meOf(ctx, q, p)
	if err != nil {
		return Session{}, err
	}
	return Session{
		AccessToken: access, AccessExpires: now.Add(s.tokens.TTL()), Me: me,
		RefreshToken: refresh, RefreshExpires: refreshExpires,
	}, nil
}

// Refresh – новый access по refresh-токену; старый refresh тратится, выдаётся
// следующий в той же цепочке. Повторное использование потраченного –
// признак кражи: цепочка отзывается целиком (CLAUDE.md, п. 3.8).
func (s *Service) Refresh(ctx context.Context, token, wantedCompany string) (Session, error) {
	var row repository.AuthFindRefreshRow
	if err := db.NoTenant(ctx, s.pool, func(tx pgx.Tx) error {
		var err error
		row, err = repository.New(tx).AuthFindRefresh(ctx, auth.HashRefreshToken(token))
		return err
	}); err != nil {
		if isNoRows(err) {
			return Session{}, domain.ErrUnauthorized
		}
		return Session{}, fmt.Errorf("поиск refresh-токена: %w", err)
	}
	if row.RevokedAt.Valid || !row.ExpiresAt.Time.After(s.now()) {
		return Session{}, domain.ErrUnauthorized
	}

	var session Session
	var stolen bool
	err := db.InTx(ctx, s.pool, db.Tenant{UserID: row.UserID}, func(tx pgx.Tx) error {
		q := repository.New(tx)
		revoke := func(event string) error {
			stolen = true
			if err := q.RevokeRefreshFamily(ctx, row.FamilyID); err != nil {
				return err
			}
			return audit(ctx, q, access.Principal{UserID: row.UserID}, "", event, row.FamilyID, "", "")
		}
		if row.UsedAt.Valid {
			return revoke("auth.refresh_reuse")
		}
		used, err := q.MarkRefreshUsed(ctx, row.ID)
		if err != nil {
			return err
		}
		if used == 0 {
			// Одновременно с другим запросом: тоже повторное использование.
			return revoke("auth.refresh_reuse")
		}
		state, err := q.GetUserState(ctx, row.UserID)
		if err != nil || state.Blocked || state.DeletedAt.Valid || state.TokenVersion != row.TokenVersion {
			return revoke("auth.refresh_revoked")
		}
		session, err = s.issue(ctx, q, row.UserID, int(state.TokenVersion), row.FamilyID, wantedCompany)
		return err
	})
	if err != nil {
		return Session{}, fmt.Errorf("обновление токена: %w", err)
	}
	if stolen {
		return Session{}, domain.ErrUnauthorized
	}
	return session, nil
}

// Logout отзывает цепочку refresh-токена. Неизвестный токен – не ошибка:
// выход и так состоялся.
func (s *Service) Logout(ctx context.Context, token string) error {
	if token == "" {
		return nil
	}
	var row repository.AuthFindRefreshRow
	if err := db.NoTenant(ctx, s.pool, func(tx pgx.Tx) error {
		var err error
		row, err = repository.New(tx).AuthFindRefresh(ctx, auth.HashRefreshToken(token))
		return err
	}); err != nil {
		if isNoRows(err) {
			return nil
		}
		return fmt.Errorf("выход: %w", err)
	}
	return db.InTx(ctx, s.pool, db.Tenant{UserID: row.UserID}, func(tx pgx.Tx) error {
		q := repository.New(tx)
		if err := q.RevokeRefreshFamily(ctx, row.FamilyID); err != nil {
			return err
		}
		return audit(ctx, q, access.Principal{UserID: row.UserID}, "", "auth.signout", "", "", "")
	})
}

// Authenticate – кто выполняет запрос по access-токену. Токен проверяется
// не только подписью и сроком: версия токенов человека в базе должна
// совпадать – блокировка и смена роли действуют сразу.
func (s *Service) Authenticate(ctx context.Context, raw string) (access.Principal, error) {
	claims, parseErr := s.tokens.Parse(raw)
	if parseErr != nil {
		return access.Principal{}, domain.ErrUnauthorized
	}
	var p access.Principal
	err := db.InTx(ctx, s.pool, db.Tenant{UserID: claims.UserID}, func(tx pgx.Tx) error {
		q := repository.New(tx)
		state, err := q.GetUserState(ctx, claims.UserID)
		if isNoRows(err) {
			return domain.ErrUnauthorized
		}
		if err != nil {
			return err
		}
		if state.Blocked || state.DeletedAt.Valid || int(state.TokenVersion) != claims.TokenVersion {
			return domain.ErrUnauthorized
		}
		p, err = principal(ctx, q, claims.UserID)
		return err
	})
	if err != nil {
		return access.Principal{}, err
	}
	if claims.CompanyID != "" {
		if !p.HasCompany(claims.CompanyID) {
			return access.Principal{}, domain.ErrUnauthorized
		}
		p.CompanyID = claims.CompanyID
	}
	return p, nil
}

// SelectCompany – access-токен для работы в выбранной компании. Чужая
// компания – «не найдено» (CLAUDE.md, п. 3.2).
func (s *Service) SelectCompany(ctx context.Context, p access.Principal, companyID string) (Session, error) {
	if !p.HasCompany(companyID) {
		return Session{}, domain.ErrNotFound
	}
	var session Session
	err := s.inTx(ctx, p, func(q *repository.Queries) error {
		// Компания должна существовать и быть видна (RLS), даже администратору.
		if _, err := q.GetCompany(ctx, companyID); err != nil {
			if isNoRows(err) {
				return domain.ErrNotFound
			}
			return err
		}
		state, err := q.GetUserState(ctx, p.UserID)
		if err != nil {
			return err
		}
		p.CompanyID = companyID
		token, err := s.tokens.Issue(auth.Claims{UserID: p.UserID, CompanyID: companyID, TokenVersion: int(state.TokenVersion)})
		if err != nil {
			return err
		}
		me, err := meOf(ctx, q, p)
		if err != nil {
			return err
		}
		session = Session{AccessToken: token, AccessExpires: s.now().Add(s.tokens.TTL()), Me: me}
		return audit(ctx, q, p, me.User.DisplayName, "auth.company", companyID, companyID, "")
	})
	return session, err
}

// Me – кто вошёл.
func (s *Service) Me(ctx context.Context, p access.Principal) (Me, error) {
	var me Me
	err := s.inTx(ctx, p, func(q *repository.Queries) error {
		var err error
		me, err = meOf(ctx, q, p)
		return err
	})
	return me, err
}

// principal собирает права человека из базы: роль – данные (CLAUDE.md, п. 3.2).
func principal(ctx context.Context, q *repository.Queries, userID string) (access.Principal, error) {
	state, err := q.GetUserState(ctx, userID)
	if err != nil {
		return access.Principal{}, fmt.Errorf("учётная запись: %w", err)
	}
	user, err := q.GetUser(ctx, userID)
	if err != nil {
		return access.Principal{}, fmt.Errorf("учётная запись: %w", err)
	}
	perms, err := q.RolePermissions(ctx, state.RoleID)
	if err != nil {
		return access.Principal{}, fmt.Errorf("права роли: %w", err)
	}
	companies, err := q.UserCompanyIDs(ctx, userID)
	if err != nil {
		return access.Principal{}, fmt.Errorf("компании: %w", err)
	}
	set := make(map[string]bool, len(perms)+len(user.GrantedActions))
	for _, perm := range perms {
		set[perm] = true
	}
	for _, perm := range user.GrantedActions {
		if slices.Contains(access.GrantablePermissions, perm) {
			set[perm] = true
		}
	}
	return access.Principal{
		UserID: userID, RoleID: state.RoleID, Platform: state.Scope == "platform",
		CompanyIDs: companies, Permissions: set, Blocked: state.Blocked,
		SectionIDs: user.SectionIds, ViewSectionIDs: user.ViewSectionIds,
	}, nil
}

func meOf(ctx context.Context, q *repository.Queries, p access.Principal) (Me, error) {
	row, err := q.GetUser(ctx, p.UserID)
	if err != nil {
		return Me{}, fmt.Errorf("учётная запись: %w", err)
	}
	user, err := userView(row, p.CompanyIDs)
	if err != nil {
		return Me{}, err
	}
	if user.Position, err = positionIn(ctx, q, p.CompanyID, p.UserID); err != nil {
		return Me{}, err
	}
	perms := make([]string, 0, len(p.Permissions))
	for perm, ok := range p.Permissions {
		if ok {
			perms = append(perms, perm)
		}
	}
	slices.Sort(perms)
	return Me{User: user, Permissions: perms, CompanyID: p.CompanyID, Platform: p.Platform}, nil
}

func userView(row repository.GetUserRow, companies []string) (User, error) {
	var profile Profile
	if len(row.Profile) > 0 {
		if err := json.Unmarshal(row.Profile, &profile); err != nil {
			return User{}, fmt.Errorf("профиль %s: %w", row.ID, err)
		}
	}
	if companies == nil {
		companies = []string{}
	}
	return User{
		ID: row.ID, Login: row.Login, DisplayName: row.DisplayName, Role: row.RoleID,
		CompanyIDs: companies, SectionIDs: row.SectionIds, ViewSectionIDs: row.ViewSectionIds,
		GrantedActions: row.GrantedActions, Blocked: row.Blocked, HasPassword: row.HasPassword,
		CreatedAt: row.CreatedAt.Time, LockVersion: row.LockVersion, Profile: profile,
	}, nil
}

// ConfirmPassword – повторный ввод пароля перед входом в админ-панель.
// Неверный пароль считается неудачной попыткой входа: подбирать пароль
// здесь так же бесполезно, как на странице входа.
func (s *Service) ConfirmPassword(ctx context.Context, p access.Principal, password string) error {
	wrong := domain.NewValidationError(domain.FieldError{Field: "password", Message: "Неверный пароль"})
	var found repository.AuthFindUserRow
	if err := s.inTx(ctx, p, func(q *repository.Queries) error {
		u, err := q.GetUser(ctx, p.UserID)
		if err != nil {
			return err
		}
		found, err = q.AuthFindUser(ctx, u.Login)
		return err
	}); err != nil {
		return err
	}
	// Пока вход закрыт после неудач, не подходит и верный пароль.
	locked := found.LockedUntil.Valid && found.LockedUntil.Time.After(s.now())
	if !locked && found.PasswordHash.Valid && auth.VerifyPassword(password, found.PasswordHash.String) {
		return nil
	}
	if locked {
		return wrong
	}
	if err := db.NoTenant(ctx, s.pool, func(tx pgx.Tx) error {
		q := repository.New(tx)
		if _, err := q.AuthRecordFailure(ctx, repository.AuthRecordFailureParams{
			PUserID: p.UserID,
			PMax:    int32(s.cfg.MaxAttempts), //nolint:gosec // от 1 до 100 по настройкам
			PLock:   pgtype.Interval{Microseconds: s.cfg.LockFor.Microseconds(), Valid: true},
		}); err != nil {
			return err
		}
		return audit(ctx, q, p, "", "auth.confirm_failed", "", p.CompanyID, "")
	}); err != nil {
		return err
	}
	return wrong
}
