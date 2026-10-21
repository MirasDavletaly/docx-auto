package service

import (
	"context"
	"encoding/json"
	"fmt"
	"slices"
	"strings"
	"unicode/utf8"

	"docflow/internal/access"
	"docflow/internal/auth"
	"docflow/internal/db"
	"docflow/internal/domain"
	"docflow/internal/repository"
)

// UserInput – учётная запись из формы админ-панели.
type UserInput struct {
	Login          string   `json:"login"`
	DisplayName    string   `json:"displayName"`
	Role           string   `json:"role"`
	CompanyIDs     []string `json:"companyIds"`
	SectionIDs     []string `json:"sectionIds"`
	ViewSectionIDs []string `json:"viewSectionIds"`
	GrantedActions []string `json:"grantedActions"`
	Blocked        bool     `json:"blocked"`
	// Password – только при создании.
	Password string `json:"password,omitempty"`
	// Position – только при создании: должность в карточке персонала
	// каждой выбранной компании. Дальше она правится в персонале.
	Position string `json:"position,omitempty"`
	// LockVersion – только при правке: версия, которую видел человек.
	LockVersion int32 `json:"lockVersion"`
	Profile
}

// ListUsers – учётные записи, которые видит человек. Кто управляет людьми –
// люди текущей компании (фильтр – RLS в SQL); остальные – только себя.
func (s *Service) ListUsers(ctx context.Context, p access.Principal) ([]User, error) {
	var out []User
	err := s.inTx(ctx, p, func(q *repository.Queries) error {
		if !p.Can("people.manage") {
			row, err := q.GetUser(ctx, p.UserID)
			if err != nil {
				return err
			}
			u, err := userView(row, p.CompanyIDs)
			if err != nil {
				return err
			}
			u.Position, err = positionIn(ctx, q, p.CompanyID, p.UserID)
			out = []User{u}
			return err
		}
		rows, err := q.ListUsers(ctx)
		if err != nil {
			return err
		}
		pairs, err := q.ListUserCompanyPairs(ctx)
		if err != nil {
			return err
		}
		companies := make(map[string][]string, len(rows))
		for _, pair := range pairs {
			companies[pair.UserID] = append(companies[pair.UserID], pair.CompanyID)
		}
		positions := map[string]string{}
		if p.CompanyID != "" {
			list, err := q.CompanyPositions(ctx, p.CompanyID)
			if err != nil {
				return err
			}
			for _, pos := range list {
				positions[pos.UserID] = pos.Position
			}
		}
		out = make([]User, 0, len(rows))
		for _, row := range rows {
			u, err := userView(repository.GetUserRow(row), companies[row.ID])
			if err != nil {
				return err
			}
			u.Position = positions[row.ID]
			// Директору не видны администраторы платформы (п. 3.2); RLS их
			// и так не отдаёт – у администратора нет компаний.
			if access.CanSeeUser(p, access.Target{ID: u.ID, RoleID: u.Role, CompanyIDs: u.CompanyIDs}) {
				out = append(out, u)
			}
		}
		return nil
	})
	return out, err
}

// target – учётная запись, над которой действие, с доступами, видимыми
// человеку. Невидимая или не своя – «не найдено» (CLAUDE.md, п. 3.2).
func target(ctx context.Context, q *repository.Queries, p access.Principal, id string) (repository.GetUserRow, []string, error) {
	row, err := q.GetUser(ctx, id)
	if isNoRows(err) {
		return row, nil, domain.ErrNotFound
	}
	if err != nil {
		return row, nil, err
	}
	companies, err := q.UserCompanyIDs(ctx, id)
	if err != nil {
		return row, nil, err
	}
	t := access.Target{ID: id, RoleID: row.RoleID, CompanyIDs: companies}
	if !access.CanSeeUser(p, t) || !access.CanManageUser(p, t) {
		return row, nil, domain.ErrNotFound
	}
	return row, companies, nil
}

// loginProblem – логин той формы, что принимает вход: 3–64 знака без
// пробелов. nil – годится.
func loginProblem(login string) *domain.FieldError {
	if n := utf8.RuneCountInString(login); n < 3 || n > 64 || strings.ContainsAny(login, " \t\r\n") {
		return &domain.FieldError{Field: "login", Message: "Логин – от 3 до 64 знаков без пробелов"}
	}
	return nil
}

// changeLogin – новый логин учётной записи и запись в журнал «старый →
// новый». Право проверяет вызывающий (access.CanChangeLogin). Токены не
// отзываются: вход привязан к учётной записи, а не к логину.
func changeLogin(ctx context.Context, q *repository.Queries, p access.Principal, actor, id, from, to, companyID string) error {
	if err := q.UpdateUserLogin(ctx, repository.UpdateUserLoginParams{ID: id, Login: to}); err != nil {
		if db.IsUniqueViolation(err) {
			return domain.NewValidationError(domain.FieldError{Field: "login", Message: "Такой логин уже есть"})
		}
		return err
	}
	return audit(ctx, q, p, actor, "user.login", from+" → "+to, companyID, "")
}

func checkUser(in *UserInput, creating bool) error {
	var fields []domain.FieldError
	in.Login = strings.TrimSpace(in.Login)
	in.DisplayName = strings.TrimSpace(in.DisplayName)
	// При правке пустой логин – «не менять»: прежние клиенты его не шлют.
	if creating || in.Login != "" {
		if f := loginProblem(in.Login); f != nil {
			fields = append(fields, *f)
		}
	}
	if creating {
		if err := auth.CheckPasswordPolicy(in.Password); err != nil {
			fields = append(fields, domain.FieldError{Field: "password", Message: "Пароль – не короче 6 знаков"})
		}
	}
	if in.DisplayName == "" || utf8.RuneCountInString(in.DisplayName) > 200 {
		fields = append(fields, domain.FieldError{Field: "displayName", Message: "Укажите имя – до 200 знаков"})
	}
	in.Position = strings.TrimSpace(in.Position)
	if utf8.RuneCountInString(in.Position) > maxCardField {
		fields = append(fields, domain.FieldError{Field: "position", Message: "Должность – до 200 знаков"})
	}
	for _, list := range [][]string{in.CompanyIDs, in.SectionIDs, in.ViewSectionIDs, in.GrantedActions} {
		if len(list) > 100 {
			fields = append(fields, domain.FieldError{Field: "companyIds", Message: "Слишком длинный список"})
			break
		}
	}
	if len(fields) > 0 {
		return domain.NewValidationError(fields...)
	}
	return nil
}

func profileJSON(pr Profile) ([]byte, error) {
	b, err := json.Marshal(pr)
	if err != nil {
		return nil, fmt.Errorf("профиль: %w", err)
	}
	return b, nil
}

func orEmpty(v []string) []string {
	if v == nil {
		return []string{}
	}
	return v
}

// CreateUser заводит учётную запись. Директор – только работника и только в
// свои компании.
func (s *Service) CreateUser(ctx context.Context, p access.Principal, in UserInput) (User, error) {
	if !slices.Contains(access.AssignableRoles(p), in.Role) {
		return User{}, domain.ErrForbidden
	}
	if err := checkUser(&in, true); err != nil {
		return User{}, err
	}
	companies := []string{}
	if in.Role != "platform-admin" {
		companies = access.AllowedCompanies(p, in.CompanyIDs)
		if len(companies) == 0 {
			return User{}, domain.NewValidationError(domain.FieldError{Field: "companyIds", Message: "Выберите компанию"})
		}
	}
	hash, hashErr := auth.HashPassword(in.Password)
	if hashErr != nil {
		return User{}, hashErr
	}
	id, idErr := auth.NewID("u")
	if idErr != nil {
		return User{}, idErr
	}
	profile, profileErr := profileJSON(in.Profile)
	if profileErr != nil {
		return User{}, profileErr
	}

	var out User
	err := s.inTx(ctx, p, func(q *repository.Queries) error {
		if err := q.InsertUser(ctx, repository.InsertUserParams{
			ID: id, Login: in.Login, DisplayName: in.DisplayName, PasswordHash: text(hash),
			RoleID: in.Role, SectionIds: orEmpty(in.SectionIDs), ViewSectionIds: orEmpty(in.ViewSectionIDs),
			GrantedActions: orEmpty(access.GrantableActions(p, in.GrantedActions)),
			Profile:        profile, Blocked: in.Blocked, CreatedAt: ts(s.now()),
		}); err != nil {
			if db.IsUniqueViolation(err) {
				return domain.NewValidationError(domain.FieldError{Field: "login", Message: "Такой логин уже есть"})
			}
			return err
		}
		for _, c := range companies {
			// Компания должна существовать и быть видна человеку (RLS).
			if _, err := q.GetCompany(ctx, c); err != nil {
				if isNoRows(err) {
					return domain.NewValidationError(domain.FieldError{Field: "companyIds", Message: "Нет такой компании"})
				}
				return err
			}
			if err := q.AddUserCompany(ctx, repository.AddUserCompanyParams{CompanyID: c, UserID: id}); err != nil {
				return err
			}
			if err := setPosition(ctx, q, c, id, in.Position); err != nil {
				return err
			}
		}
		row, err := q.GetUser(ctx, id)
		if err != nil {
			return err
		}
		if out, err = userView(row, companies); err != nil {
			return err
		}
		if out.Position, err = positionIn(ctx, q, p.CompanyID, id); err != nil {
			return err
		}
		return audit(ctx, q, p, actorName(ctx, q, p), "user.create", in.Login, first(companies), "")
	})
	return out, err
}

// UpdateUser правит учётную запись: имя, роль, доступы, блокировку.
// Директор меняет доступ только к своим компаниям; остальные доступы
// человека остаются как были.
func (s *Service) UpdateUser(ctx context.Context, p access.Principal, id string, in UserInput) (User, error) {
	if err := checkUser(&in, false); err != nil {
		return User{}, err
	}
	profile, profileErr := profileJSON(in.Profile)
	if profileErr != nil {
		return User{}, profileErr
	}
	var out User
	err := s.inTx(ctx, p, func(q *repository.Queries) error {
		row, have, err := target(ctx, q, p, id)
		if err != nil {
			return err
		}
		if in.Role != row.RoleID && !slices.Contains(access.AssignableRoles(p), in.Role) {
			return domain.ErrForbidden
		}
		// Тот же логин в запросе – не смена: так шлёт форма того, кто
		// логины не меняет.
		newLogin := in.Login != "" && in.Login != row.Login
		if newLogin && !access.CanChangeLogin(p) {
			return domain.ErrForbidden
		}
		// Права поверх роли: выдаёт и снимает только то, что может выдать сам.
		allowed := access.GrantableActions(p, access.GrantablePermissions)
		granted := []string{}
		for _, a := range row.GrantedActions {
			if !slices.Contains(allowed, a) {
				granted = append(granted, a)
			}
		}
		granted = append(granted, access.GrantableActions(p, in.GrantedActions)...)

		updated, err := q.UpdateUser(ctx, repository.UpdateUserParams{
			ID: id, DisplayName: in.DisplayName, RoleID: in.Role,
			SectionIds: orEmpty(in.SectionIDs), ViewSectionIds: orEmpty(in.ViewSectionIDs),
			GrantedActions: granted, Profile: profile, Blocked: in.Blocked, LockVersion: in.LockVersion,
		})
		if isNoRows(err) {
			return domain.ErrConflict
		}
		if err != nil {
			return err
		}

		// Доступ к компаниям – только в пределах своих компаний.
		want := []string{}
		if in.Role != "platform-admin" {
			want = access.AllowedCompanies(p, in.CompanyIDs)
		}
		for _, c := range have {
			if !slices.Contains(want, c) && len(access.AllowedCompanies(p, []string{c})) == 1 {
				if err = q.RemoveUserCompany(ctx, repository.RemoveUserCompanyParams{CompanyID: c, UserID: id}); err != nil {
					return err
				}
			}
		}
		for _, c := range want {
			if slices.Contains(have, c) {
				continue
			}
			if _, err = q.GetCompany(ctx, c); err != nil {
				if isNoRows(err) {
					return domain.NewValidationError(domain.FieldError{Field: "companyIds", Message: "Нет такой компании"})
				}
				return err
			}
			if err = q.AddUserCompany(ctx, repository.AddUserCompanyParams{CompanyID: c, UserID: id}); err != nil {
				return err
			}
		}
		// Доступы – как их видит сам человек (RLS): директор не узнаёт о
		// доступах к чужим компаниям.
		companies, err := q.UserCompanyIDs(ctx, id)
		if err != nil {
			return err
		}
		// Без компании может остаться только администратор платформы. Это
		// проверяется лишь у того, кто видит все доступы: директор, снявший
		// доступ к своим компаниям, просто убирает человека из них.
		if p.Platform && in.Role != "platform-admin" && len(companies) == 0 {
			return domain.NewValidationError(domain.FieldError{Field: "companyIds", Message: "Выберите компанию"})
		}
		// Запись – из ответа UPDATE: после снятия доступа к текущей компании
		// директор её уже не прочтёт.
		if out, err = userView(repository.GetUserRow(updated), companies); err != nil {
			return err
		}
		if out.Position, err = positionIn(ctx, q, p.CompanyID, id); err != nil {
			return err
		}
		actor, company := actorName(ctx, q, p), first(access.AllowedCompanies(p, slices.Concat(have, want)))
		if newLogin {
			if err = changeLogin(ctx, q, p, actor, id, row.Login, in.Login, company); err != nil {
				return err
			}
			out.Login = in.Login
		}
		event := "user.update"
		if in.Blocked != row.Blocked {
			event = map[bool]string{true: "user.block", false: "user.unblock"}[in.Blocked]
		}
		return audit(ctx, q, p, actor, event, out.Login, company, "")
	})
	return out, err
}

// SetUserPassword – пароль, заданный администратором или директором.
// Старые токены человека перестают действовать, блокировка входа снимается.
func (s *Service) SetUserPassword(ctx context.Context, p access.Principal, id, password string) error {
	if err := auth.CheckPasswordPolicy(password); err != nil {
		return domain.NewValidationError(domain.FieldError{Field: "password", Message: "Пароль – не короче 6 знаков"})
	}
	hash, err := auth.HashPassword(password)
	if err != nil {
		return err
	}
	return s.inTx(ctx, p, func(q *repository.Queries) error {
		row, companies, err := target(ctx, q, p, id)
		if err != nil {
			return err
		}
		if err := q.SetPassword(ctx, repository.SetPasswordParams{ID: id, PasswordHash: text(hash)}); err != nil {
			return err
		}
		return audit(ctx, q, p, actorName(ctx, q, p), "user.password-reset", row.Login, first(access.AllowedCompanies(p, companies)), "")
	})
}

// DeleteUser помечает учётную запись удалённой. Себя удалить нельзя –
// поэтому последний администратор платформы всегда остаётся.
func (s *Service) DeleteUser(ctx context.Context, p access.Principal, id string, lockVersion int32) error {
	return s.inTx(ctx, p, func(q *repository.Queries) error {
		row, companies, err := target(ctx, q, p, id)
		if err != nil {
			return err
		}
		n, err := q.SoftDeleteUser(ctx, repository.SoftDeleteUserParams{ID: id, LockVersion: lockVersion})
		if err != nil {
			return err
		}
		if n == 0 {
			return domain.ErrConflict
		}
		return audit(ctx, q, p, actorName(ctx, q, p), "user.delete", row.Login, first(access.AllowedCompanies(p, companies)), "")
	})
}

// ProfileInput – что человек правит о себе сам.
type ProfileInput struct {
	DisplayName string `json:"displayName"`
	// Login – свой новый логин; пусто или тот же – не менять. Меняет только
	// тот, у кого право users.login (access.CanChangeLogin).
	Login       string `json:"login,omitempty"`
	LockVersion int32  `json:"lockVersion"`
	Profile
}

// UpdateOwnProfile – своё имя, должность, телефон, почта, фотография;
// логин – с правом users.login.
func (s *Service) UpdateOwnProfile(ctx context.Context, p access.Principal, in ProfileInput) (Me, error) {
	in.DisplayName = strings.TrimSpace(in.DisplayName)
	if in.DisplayName == "" || utf8.RuneCountInString(in.DisplayName) > 200 {
		return Me{}, domain.NewValidationError(domain.FieldError{Field: "displayName", Message: "Укажите имя – до 200 знаков"})
	}
	in.Login = strings.TrimSpace(in.Login)
	if in.Login != "" {
		if f := loginProblem(in.Login); f != nil {
			return Me{}, domain.NewValidationError(*f)
		}
	}
	profile, profileErr := profileJSON(in.Profile)
	if profileErr != nil {
		return Me{}, profileErr
	}
	var me Me
	err := s.inTx(ctx, p, func(q *repository.Queries) error {
		row, err := q.GetUser(ctx, p.UserID)
		if err != nil {
			return err
		}
		newLogin := in.Login != "" && in.Login != row.Login
		if newLogin && !access.CanChangeLogin(p) {
			return domain.ErrForbidden
		}
		_, err = q.UpdateOwnProfile(ctx, repository.UpdateOwnProfileParams{
			ID: p.UserID, DisplayName: in.DisplayName, Profile: profile, LockVersion: in.LockVersion,
		})
		if isNoRows(err) {
			return domain.ErrConflict
		}
		if err != nil {
			return err
		}
		if newLogin {
			if err = changeLogin(ctx, q, p, in.DisplayName, p.UserID, row.Login, in.Login, p.CompanyID); err != nil {
				return err
			}
		}
		me, err = meOf(ctx, q, p)
		return err
	})
	return me, err
}

// ChangeOwnPassword – смена своего пароля. Все прежние сессии закрываются,
// текущая продолжается с новыми токенами.
func (s *Service) ChangeOwnPassword(ctx context.Context, p access.Principal, current, next string) (Session, error) {
	if err := auth.CheckPasswordPolicy(next); err != nil {
		return Session{}, domain.NewValidationError(domain.FieldError{Field: "password", Message: "Пароль – не короче 6 знаков"})
	}
	hash, hashErr := auth.HashPassword(next)
	if hashErr != nil {
		return Session{}, hashErr
	}
	var session Session
	err := s.inTx(ctx, p, func(q *repository.Queries) error {
		old, err := q.GetPasswordHash(ctx, p.UserID)
		if err != nil {
			return err
		}
		if !old.Valid || !auth.VerifyPassword(current, old.String) {
			return domain.NewValidationError(domain.FieldError{Field: "currentPassword", Message: "Текущий пароль неверный"})
		}
		if err = q.SetPassword(ctx, repository.SetPasswordParams{ID: p.UserID, PasswordHash: text(hash)}); err != nil {
			return err
		}
		state, err := q.GetUserState(ctx, p.UserID)
		if err != nil {
			return err
		}
		family, err := auth.NewID("rf")
		if err != nil {
			return err
		}
		if session, err = s.issue(ctx, q, p.UserID, int(state.TokenVersion), family, p.CompanyID); err != nil {
			return err
		}
		return audit(ctx, q, p, session.Me.User.DisplayName, "auth.password-change", session.Me.User.Login, "", "")
	})
	return session, err
}

// actorName – имя для журнала. Ошибка чтения не мешает действию: в журнале
// останется идентификатор.
func actorName(ctx context.Context, q *repository.Queries, p access.Principal) string {
	row, err := q.GetUser(ctx, p.UserID)
	if err != nil {
		return ""
	}
	return row.DisplayName
}

func first(v []string) string {
	if len(v) == 0 {
		return ""
	}
	return v[0]
}
