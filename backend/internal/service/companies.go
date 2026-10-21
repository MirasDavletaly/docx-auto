package service

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"unicode/utf8"

	"docflow/internal/access"
	"docflow/internal/auth"
	"docflow/internal/db"
	"docflow/internal/domain"
	"docflow/internal/repository"
)

// ListCompanies – компании, к которым у человека есть доступ (RLS);
// администратору платформы – все.
func (s *Service) ListCompanies(ctx context.Context, p access.Principal) ([]Company, error) {
	var out []Company
	err := s.inTx(ctx, p, func(q *repository.Queries) error {
		rows, err := q.ListCompanies(ctx)
		if err != nil {
			return err
		}
		out = make([]Company, 0, len(rows))
		for _, r := range rows {
			c, err := companyView(r.ID, r.Name, r.Bin, r.Requisites, r.LockVersion)
			if err != nil {
				return err
			}
			out = append(out, c)
		}
		return nil
	})
	return out, err
}

// companyFields разбирает карточку компании из формы: наименование и БИН –
// в свои столбцы (по ним проверка), остальное – реквизитами целиком.
func companyFields(in Company) (name, bin string, requisites []byte, lockVersion int32, err error) {
	str := func(key string) string {
		v, _ := in[key].(string)
		return strings.TrimSpace(v)
	}
	name, bin = str("name"), str("bin")
	if n, ok := in["lockVersion"].(float64); ok {
		lockVersion = int32(n)
	}

	var fields []domain.FieldError
	if name == "" || utf8.RuneCountInString(name) > 200 {
		fields = append(fields, domain.FieldError{Field: "name", Message: "Укажите наименование – до 200 знаков"})
	}
	if !domain.ValidIINBIN(bin) {
		fields = append(fields, domain.FieldError{Field: "bin", Message: "БИН – 12 цифр с верной контрольной цифрой"})
	}
	if len(fields) > 0 {
		return "", "", nil, 0, domain.NewValidationError(fields...)
	}

	rest := make(map[string]any, len(in))
	for k, v := range in {
		switch k {
		case "id", "name", "bin", "lockVersion":
		default:
			rest[k] = v
		}
	}
	requisites, err = json.Marshal(rest)
	if err != nil {
		return "", "", nil, 0, fmt.Errorf("реквизиты: %w", err)
	}
	return name, bin, requisites, lockVersion, nil
}

// UpdateCompany правит реквизиты. Чужая компания – «не найдено»; своя без
// права правки – «запрещено».
func (s *Service) UpdateCompany(ctx context.Context, p access.Principal, id string, in Company) (Company, error) {
	if !p.HasCompany(id) {
		return nil, domain.ErrNotFound
	}
	if !p.Can("company.edit") {
		return nil, domain.ErrForbidden
	}
	name, bin, requisites, lockVersion, invalid := companyFields(in)
	if invalid != nil {
		return nil, invalid
	}
	var out Company
	err := s.inTx(ctx, p, func(q *repository.Queries) error {
		if _, err := q.GetCompany(ctx, id); err != nil {
			if isNoRows(err) {
				return domain.ErrNotFound
			}
			return err
		}
		r, err := q.UpdateCompany(ctx, repository.UpdateCompanyParams{
			ID: id, Name: name, Bin: bin, Requisites: requisites, LockVersion: lockVersion,
		})
		if isNoRows(err) {
			return domain.ErrConflict
		}
		if err != nil {
			return err
		}
		if out, err = companyView(r.ID, r.Name, r.Bin, r.Requisites, r.LockVersion); err != nil {
			return err
		}
		return audit(ctx, q, p, actorName(ctx, q, p), "company.edit", name, id, "")
	})
	return out, err
}

// CreateCompany заводит компанию. Только администратор платформы: у
// директора доступа к новой компании ещё нет, и он её бы не увидел.
func (s *Service) CreateCompany(ctx context.Context, p access.Principal, in Company) (Company, error) {
	if !p.Can("company.create") || !p.Platform {
		return nil, domain.ErrForbidden
	}
	name, bin, requisites, _, invalid := companyFields(in)
	if invalid != nil {
		return nil, invalid
	}
	id, idErr := auth.NewID("c")
	if idErr != nil {
		return nil, idErr
	}
	var out Company
	err := s.inTx(ctx, p, func(q *repository.Queries) error {
		if err := q.InsertCompany(ctx, repository.InsertCompanyParams{ID: id, Name: name, Bin: bin, Requisites: requisites}); err != nil {
			if db.IsUniqueViolation(err) {
				return domain.ErrConflict
			}
			return err
		}
		r, err := q.GetCompany(ctx, id)
		if err != nil {
			return err
		}
		if out, err = companyView(r.ID, r.Name, r.Bin, r.Requisites, r.LockVersion); err != nil {
			return err
		}
		return audit(ctx, q, p, actorName(ctx, q, p), "company.create", name, id, "")
	})
	return out, err
}

// DeleteCompany помечает компанию удалённой. Только администратор
// платформы; доступы людей к ней перестают действовать.
func (s *Service) DeleteCompany(ctx context.Context, p access.Principal, id string, lockVersion int32) error {
	if !p.HasCompany(id) {
		return domain.ErrNotFound
	}
	if !p.Can("company.create") || !p.Platform {
		return domain.ErrForbidden
	}
	return s.inTx(ctx, p, func(q *repository.Queries) error {
		c, err := q.GetCompany(ctx, id)
		if isNoRows(err) {
			return domain.ErrNotFound
		}
		if err != nil {
			return err
		}
		n, err := q.SoftDeleteCompany(ctx, repository.SoftDeleteCompanyParams{ID: id, LockVersion: lockVersion})
		if err != nil {
			return err
		}
		if n == 0 {
			return domain.ErrConflict
		}
		return audit(ctx, q, p, actorName(ctx, q, p), "company.delete", c.Name, id, "")
	})
}
