package service

import (
	"context"
	"slices"
	"strings"
	"unicode/utf8"

	"docflow/internal/access"
	"docflow/internal/auth"
	"docflow/internal/db"
	"docflow/internal/domain"
	"docflow/internal/repository"
)

// Персонал компании – её пользователи (docs/plans/phase-01b-personnel.md):
// один человек – одна запись. Имя, падеж для приказа, казахское ФИО и ФИО
// латиницей – одни на человека; должность и подразделение – свои в каждой
// компании. Компания – только из токена (CLAUDE.md, п. 3.1).

// maxCardField – предел поля карточки в знаках; тот же CHECK в базе.
const maxCardField = 200

// PersonCard – что правится в карточке. Пустое – «не заполнено»: документ
// тогда берёт русское значение.
type PersonCard struct {
	FullName         string `json:"fullName"`
	FullNameGenitive string `json:"fullNameGenitive"`
	FullNameKk       string `json:"fullNameKk,omitempty"`
	FullNameKkDative string `json:"fullNameKkDative,omitempty"`
	FullNameEn       string `json:"fullNameEn,omitempty"`
	Position         string `json:"position"`
	PositionKk       string `json:"positionKk,omitempty"`
	PositionEn       string `json:"positionEn,omitempty"`
	Unit             string `json:"unit"`
	UnitKk           string `json:"unitKk,omitempty"`
	UnitEn           string `json:"unitEn,omitempty"`
}

// Person – человек в персонале компании, как EmployeeBrief на сайте. Логина,
// телефона и почты здесь нет: список видят все люди компании.
type Person struct {
	ID        string `json:"id"`
	CompanyID string `json:"companyId"`
	PersonCard
	// LockVersion – версия учётной записи человека: карточка и учётная
	// запись – одна запись.
	LockVersion int32 `json:"lockVersion"`
}

// PersonInput – правка карточки с версией, которую видел человек.
type PersonInput struct {
	PersonCard
	LockVersion int32 `json:"lockVersion"`
}

// NewPersonInput – новый человек в персонале текущей компании. Пароль
// необязателен: без него войти нельзя, пока его не зададут.
type NewPersonInput struct {
	Login    string `json:"login"`
	Password string `json:"password,omitempty"`
	PersonCard
}

func personView(row repository.GetPersonnelCardRow) Person {
	genitive := row.NameGenitive
	if genitive == "" {
		// Падеж не вписан – в приказ идёт имя как есть (латиница не
		// склоняется).
		genitive = row.DisplayName
	}
	return Person{
		ID: row.ID, CompanyID: row.CompanyID, LockVersion: row.LockVersion,
		PersonCard: PersonCard{
			FullName: row.DisplayName, FullNameGenitive: genitive,
			FullNameKk: row.NameKk, FullNameKkDative: row.NameKkDative, FullNameEn: row.NameEn,
			Position: row.Position, PositionKk: row.PositionKk, PositionEn: row.PositionEn,
			Unit: row.Unit, UnitKk: row.UnitKk, UnitEn: row.UnitEn,
		},
	}
}

func truncate(s string, n int) string {
	if utf8.RuneCountInString(s) <= n {
		return s
	}
	return string([]rune(s)[:n])
}

// checkCard – поля без пробелов по краям, имя обязательно, всё – до 200
// знаков.
func checkCard(c *PersonCard) error {
	fields := []struct {
		name  string
		value *string
	}{
		{"fullName", &c.FullName}, {"fullNameGenitive", &c.FullNameGenitive},
		{"fullNameKk", &c.FullNameKk}, {"fullNameKkDative", &c.FullNameKkDative}, {"fullNameEn", &c.FullNameEn},
		{"position", &c.Position}, {"positionKk", &c.PositionKk}, {"positionEn", &c.PositionEn},
		{"unit", &c.Unit}, {"unitKk", &c.UnitKk}, {"unitEn", &c.UnitEn},
	}
	var bad []domain.FieldError
	for _, f := range fields {
		*f.value = strings.TrimSpace(*f.value)
		if utf8.RuneCountInString(*f.value) > maxCardField {
			bad = append(bad, domain.FieldError{Field: f.name, Message: "Не длиннее 200 знаков"})
		}
	}
	if c.FullName == "" {
		bad = append(bad, domain.FieldError{Field: "fullName", Message: "Укажите ФИО"})
	}
	if len(bad) > 0 {
		return domain.NewValidationError(bad...)
	}
	return nil
}

// positionIn – должность человека в компании; не в компании – пусто.
func positionIn(ctx context.Context, q *repository.Queries, companyID, userID string) (string, error) {
	if companyID == "" {
		return "", nil
	}
	row, err := q.GetPersonnelCard(ctx, repository.GetPersonnelCardParams{CompanyID: companyID, UserID: userID})
	if isNoRows(err) {
		return "", nil
	}
	return row.Position, err
}

// setPosition – должность в карточке компании, остальное в ней не меняется.
func setPosition(ctx context.Context, q *repository.Queries, companyID, userID, position string) error {
	if position == "" {
		return nil
	}
	_, err := q.UpdatePersonnelCard(ctx, repository.UpdatePersonnelCardParams{
		CompanyID: companyID, UserID: userID, Position: position,
	})
	return err
}

func cardParams(companyID, userID string, c PersonCard) repository.UpdatePersonnelCardParams {
	return repository.UpdatePersonnelCardParams{
		CompanyID: companyID, UserID: userID,
		Position: c.Position, PositionKk: c.PositionKk, PositionEn: c.PositionEn,
		Unit: c.Unit, UnitKk: c.UnitKk, UnitEn: c.UnitEn,
	}
}

// ListPersonnel – персонал текущей компании: его видят все её люди (выбор
// работника в документе). Администратору платформы – все компании: он
// открывает документы любой из них.
func (s *Service) ListPersonnel(ctx context.Context, p access.Principal) ([]Person, error) {
	filter := text(p.CompanyID)
	if p.Platform {
		filter = text("")
	} else if p.CompanyID == "" {
		return []Person{}, nil
	}
	out := []Person{}
	err := s.inTx(ctx, p, func(q *repository.Queries) error {
		rows, err := q.ListPersonnel(ctx, filter)
		if err != nil {
			return err
		}
		for _, row := range rows {
			out = append(out, personView(repository.GetPersonnelCardRow(row)))
		}
		return nil
	})
	return out, err
}

// CreatePerson заводит человека в персонале текущей компании – это
// учётная запись работника с карточкой.
func (s *Service) CreatePerson(ctx context.Context, p access.Principal, in NewPersonInput) (Person, error) {
	company := p.CompanyID
	if !access.CanEditPersonnel(p, company) || !slices.Contains(access.AssignableRoles(p), "employee") {
		return Person{}, domain.ErrForbidden
	}
	var bad []domain.FieldError
	in.Login = strings.TrimSpace(in.Login)
	if n := utf8.RuneCountInString(in.Login); n < 3 || n > 64 || strings.ContainsAny(in.Login, " \t\r\n") {
		bad = append(bad, domain.FieldError{Field: "login", Message: "Логин – от 3 до 64 знаков без пробелов"})
	}
	if in.Password != "" && auth.CheckPasswordPolicy(in.Password) != nil {
		bad = append(bad, domain.FieldError{Field: "password", Message: "Пароль – не короче 6 знаков"})
	}
	if err := checkCard(&in.PersonCard); err != nil {
		v, _ := domain.AsValidationError(err)
		bad = append(bad, v.Fields...)
	}
	if len(bad) > 0 {
		return Person{}, domain.NewValidationError(bad...)
	}

	hash := ""
	if in.Password != "" {
		var hashErr error
		if hash, hashErr = auth.HashPassword(in.Password); hashErr != nil {
			return Person{}, hashErr
		}
	}
	id, idErr := auth.NewID("u")
	if idErr != nil {
		return Person{}, idErr
	}

	var out Person
	err := s.inTx(ctx, p, func(q *repository.Queries) error {
		if _, err := q.GetCompany(ctx, company); err != nil {
			if isNoRows(err) {
				return domain.ErrNotFound
			}
			return err
		}
		if err := q.InsertUser(ctx, repository.InsertUserParams{
			ID: id, Login: in.Login, DisplayName: in.FullName, PasswordHash: text(hash), RoleID: "employee",
			SectionIds: []string{}, ViewSectionIds: []string{}, GrantedActions: []string{},
			Profile: []byte("{}"), CreatedAt: ts(s.now()),
		}); err != nil {
			if db.IsUniqueViolation(err) {
				return domain.NewValidationError(domain.FieldError{Field: "login", Message: "Такой логин уже есть"})
			}
			return err
		}
		if err := q.SetPersonNames(ctx, repository.SetPersonNamesParams{
			ID: id, NameGenitive: in.FullNameGenitive, NameKk: in.FullNameKk,
			NameKkDative: in.FullNameKkDative, NameEn: in.FullNameEn,
		}); err != nil {
			return err
		}
		if err := q.AddUserCompany(ctx, repository.AddUserCompanyParams{CompanyID: company, UserID: id}); err != nil {
			return err
		}
		if _, err := q.UpdatePersonnelCard(ctx, cardParams(company, id, in.PersonCard)); err != nil {
			return err
		}
		row, err := q.GetPersonnelCard(ctx, repository.GetPersonnelCardParams{CompanyID: company, UserID: id})
		if err != nil {
			return err
		}
		out = personView(row)
		return audit(ctx, q, p, actorName(ctx, q, p), "personnel.create", in.FullName, company, "")
	})
	return out, err
}

// UpdatePerson правит карточку человека в текущей компании: имя и его
// формы (общие для всех его компаний), должность и подразделение (только
// в этой).
func (s *Service) UpdatePerson(ctx context.Context, p access.Principal, id string, in PersonInput) (Person, error) {
	if !p.Can("people.manage") {
		return Person{}, domain.ErrForbidden
	}
	company := p.CompanyID
	if !access.CanEditPersonnel(p, company) {
		return Person{}, domain.ErrNotFound
	}
	if err := checkCard(&in.PersonCard); err != nil {
		return Person{}, err
	}
	var out Person
	err := s.inTx(ctx, p, func(q *repository.Queries) error {
		// Человек не этой компании – «не найдено» (п. 3.2); RLS не отдаст его и так.
		if _, err := q.GetPersonnelCard(ctx, repository.GetPersonnelCardParams{CompanyID: company, UserID: id}); err != nil {
			if isNoRows(err) {
				return domain.ErrNotFound
			}
			return err
		}
		if _, err := q.UpdatePersonName(ctx, repository.UpdatePersonNameParams{
			ID: id, DisplayName: in.FullName, NameGenitive: in.FullNameGenitive, NameKk: in.FullNameKk,
			NameKkDative: in.FullNameKkDative, NameEn: in.FullNameEn, LockVersion: in.LockVersion,
		}); err != nil {
			if isNoRows(err) {
				return domain.ErrConflict
			}
			return err
		}
		if _, err := q.UpdatePersonnelCard(ctx, cardParams(company, id, in.PersonCard)); err != nil {
			return err
		}
		row, err := q.GetPersonnelCard(ctx, repository.GetPersonnelCardParams{CompanyID: company, UserID: id})
		if err != nil {
			return err
		}
		out = personView(row)
		return audit(ctx, q, p, actorName(ctx, q, p), "personnel.update", in.FullName, company, "")
	})
	return out, err
}

// RemovePerson убирает человека из персонала текущей компании – снимает
// доступ к ней, как правка доступа в «Пользователях» (CanManageUser). Если
// других компаний у него нет, учётная запись помечается удалённой.
func (s *Service) RemovePerson(ctx context.Context, p access.Principal, id string, lockVersion int32) error {
	company := p.CompanyID
	if company == "" {
		return domain.ErrNotFound
	}
	return s.inTx(ctx, p, func(q *repository.Queries) error {
		card, err := q.GetPersonnelCard(ctx, repository.GetPersonnelCardParams{CompanyID: company, UserID: id})
		if isNoRows(err) {
			return domain.ErrNotFound
		}
		if err != nil {
			return err
		}
		row, _, err := target(ctx, q, p, id)
		if err != nil {
			return err
		}
		// Число – мимо RLS: директор видит доступы человека только к своим
		// компаниям.
		total, err := q.UserCompanyCount(ctx, id)
		if err != nil {
			return err
		}
		name := actorName(ctx, q, p)
		if err = audit(ctx, q, p, name, "personnel.delete", card.DisplayName, company, ""); err != nil {
			return err
		}

		if total > 1 {
			if _, err = q.BumpUserVersion(ctx, repository.BumpUserVersionParams{ID: id, LockVersion: lockVersion}); err != nil {
				if isNoRows(err) {
					return domain.ErrConflict
				}
				return err
			}
			return q.RemoveUserCompany(ctx, repository.RemoveUserCompanyParams{CompanyID: company, UserID: id})
		}

		// Работать человеку больше негде: учётная запись – как удалённая на
		// вкладке «Пользователи» (доступ к компании остаётся в истории).
		n, err := q.SoftDeleteUser(ctx, repository.SoftDeleteUserParams{ID: id, LockVersion: lockVersion})
		if err != nil {
			return err
		}
		if n == 0 {
			return domain.ErrConflict
		}
		return audit(ctx, q, p, name, "user.delete", row.Login, company, "")
	})
}
