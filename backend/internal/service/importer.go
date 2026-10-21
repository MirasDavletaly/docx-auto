package service

import (
	"context"
	"fmt"
	"slices"
	"strings"
	"time"
	"unicode/utf8"

	"docflow/internal/access"
	"docflow/internal/db"
	"docflow/internal/domain"
	"docflow/internal/repository"
)

// ImportUser – учётная запись из выгрузки браузера. Пароля в выгрузке нет:
// хеши браузера сервер не принимает, пароли задаются заново.
type ImportUser struct {
	ID             string   `json:"id"`
	Login          string   `json:"login"`
	DisplayName    string   `json:"displayName"`
	Role           string   `json:"role"`
	CompanyIDs     []string `json:"companyIds"`
	SectionIDs     []string `json:"sectionIds"`
	ViewSectionIDs []string `json:"viewSectionIds"`
	GrantedActions []string `json:"grantedActions"`
	Blocked        bool     `json:"blocked"`
	CreatedAt      string   `json:"createdAt"`
	// Position – должность из браузера: уходит в карточку персонала каждой
	// компании человека.
	Position string `json:"position,omitempty"`
	Profile
}

// ImportData – выгрузка из браузера (этап 1а: компании и учётные записи).
type ImportData struct {
	Companies []Company    `json:"companies"`
	Users     []ImportUser `json:"users"`
}

// ImportResult – что перенесено.
type ImportResult struct {
	Companies int `json:"companies"`
	Users     int `json:"users"`
	// Skipped – логины, которые на сервере уже есть (например,
	// администратор, заведённый при установке): их не трогаем.
	Skipped []string `json:"skipped"`
}

const maxImportItems = 1000

// Import переносит компании и учётные записи из браузера. Разово: только
// администратор платформы и только пока на сервере нет ни одной компании.
// Всё в одной транзакции – либо перенесено целиком, либо ничего.
//
// Идентификаторы сохраняются: документы, которые до этапа 1б остаются в
// браузере, ссылаются на них.
func (s *Service) Import(ctx context.Context, p access.Principal, in ImportData) (ImportResult, error) {
	if !p.Platform || !p.Can("company.create") || !p.Can("people.manage") {
		return ImportResult{}, domain.ErrForbidden
	}
	if err := checkImport(in); err != nil {
		return ImportResult{}, err
	}

	res := ImportResult{Skipped: []string{}}
	err := s.inTx(ctx, p, func(q *repository.Queries) error {
		count, err := q.CountCompanies(ctx)
		if err != nil {
			return err
		}
		if count > 0 {
			return domain.ErrConflict
		}

		for i, c := range in.Companies {
			name, bin, requisites, _, invalid := companyFields(c)
			if invalid != nil {
				return prefixed(invalid, fmt.Sprintf("companies[%d].", i))
			}
			id, _ := c["id"].(string)
			if err = q.InsertCompany(ctx, repository.InsertCompanyParams{ID: id, Name: name, Bin: bin, Requisites: requisites}); err != nil {
				return fmt.Errorf("компания %s: %w", id, err)
			}
			res.Companies++
		}

		existing, err := q.ListUsers(ctx)
		if err != nil {
			return err
		}
		taken := make(map[string]bool, len(existing))
		for _, u := range existing {
			taken[strings.ToLower(u.Login)] = true
		}

		for i, u := range in.Users {
			if taken[strings.ToLower(u.Login)] {
				res.Skipped = append(res.Skipped, u.Login)
				continue
			}
			if _, err := q.GetRole(ctx, u.Role); err != nil {
				if isNoRows(err) {
					return domain.NewValidationError(domain.FieldError{Field: fmt.Sprintf("users[%d].role", i), Message: "Неизвестная роль"})
				}
				return err
			}
			profile, err := profileJSON(u.Profile)
			if err != nil {
				return err
			}
			created := s.now()
			if t, err := time.Parse(time.RFC3339Nano, u.CreatedAt); err == nil {
				created = t
			}
			granted := []string{}
			for _, a := range u.GrantedActions {
				if slices.Contains(access.GrantablePermissions, a) {
					granted = append(granted, a)
				}
			}
			if err := q.InsertUser(ctx, repository.InsertUserParams{
				ID: u.ID, Login: strings.TrimSpace(u.Login), DisplayName: strings.TrimSpace(u.DisplayName),
				RoleID: u.Role, SectionIds: orEmpty(u.SectionIDs), ViewSectionIds: orEmpty(u.ViewSectionIDs),
				GrantedActions: granted, Profile: profile, Blocked: u.Blocked, CreatedAt: ts(created),
			}); err != nil {
				if db.IsUniqueViolation(err) {
					return domain.NewValidationError(domain.FieldError{Field: fmt.Sprintf("users[%d].id", i), Message: "Такая учётная запись уже есть"})
				}
				return fmt.Errorf("учётная запись %s: %w", u.ID, err)
			}
			if u.Role != "platform-admin" {
				for _, c := range u.CompanyIDs {
					if err := q.AddUserCompany(ctx, repository.AddUserCompanyParams{CompanyID: c, UserID: u.ID}); err != nil {
						return fmt.Errorf("доступ %s к %s: %w", u.ID, c, err)
					}
					if err := setPosition(ctx, q, c, u.ID, truncate(strings.TrimSpace(u.Position), maxCardField)); err != nil {
						return err
					}
				}
			}
			res.Users++
		}
		return audit(ctx, q, p, actorName(ctx, q, p), "admin.import",
			fmt.Sprintf("компаний: %d, учётных записей: %d", res.Companies, res.Users), "", "")
	})
	return res, err
}

// checkImport – всё, что можно проверить до базы: размеры, идентификаторы,
// повторы, ссылки на компании.
func checkImport(in ImportData) error {
	var fields []domain.FieldError
	add := func(field, msg string) { fields = append(fields, domain.FieldError{Field: field, Message: msg}) }

	if len(in.Companies) == 0 {
		add("companies", "В выгрузке нет компаний")
	}
	if len(in.Companies) > maxImportItems || len(in.Users) > maxImportItems {
		add("users", "Слишком большая выгрузка")
		return domain.NewValidationError(fields...)
	}
	companies := make(map[string]bool, len(in.Companies))
	for i, c := range in.Companies {
		id, _ := c["id"].(string)
		if !validID(id) || companies[id] {
			add(fmt.Sprintf("companies[%d].id", i), "Пустой или повторяющийся идентификатор")
		}
		companies[id] = true
	}
	ids := make(map[string]bool, len(in.Users))
	logins := make(map[string]bool, len(in.Users))
	for i, u := range in.Users {
		f := fmt.Sprintf("users[%d].", i)
		if !validID(u.ID) || ids[u.ID] {
			add(f+"id", "Пустой или повторяющийся идентификатор")
		}
		ids[u.ID] = true
		login := strings.ToLower(strings.TrimSpace(u.Login))
		if n := utf8.RuneCountInString(login); n < 3 || n > 64 || logins[login] {
			add(f+"login", "Логин – от 3 до 64 знаков, без повторов")
		}
		logins[login] = true
		if name := strings.TrimSpace(u.DisplayName); name == "" || utf8.RuneCountInString(name) > 200 {
			add(f+"displayName", "Укажите имя – до 200 знаков")
		}
		for _, c := range u.CompanyIDs {
			if !companies[c] {
				add(f+"companyIds", "Компании нет в выгрузке")
				break
			}
		}
		if u.Role != "platform-admin" && len(u.CompanyIDs) == 0 {
			add(f+"companyIds", "Нет ни одной компании")
		}
	}
	if len(fields) > 0 {
		return domain.NewValidationError(fields...)
	}
	return nil
}

func validID(id string) bool {
	return id != "" && len(id) <= 64 && !strings.ContainsAny(id, " \t\r\n")
}

// prefixed добавляет к полям ошибки проверки путь в выгрузке.
func prefixed(err error, prefix string) error {
	v, ok := domain.AsValidationError(err)
	if !ok {
		return err
	}
	fields := make([]domain.FieldError, 0, len(v.Fields))
	for _, f := range v.Fields {
		fields = append(fields, domain.FieldError{Field: prefix + f.Field, Message: f.Message})
	}
	return domain.NewValidationError(fields...)
}
