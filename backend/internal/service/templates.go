package service

import (
	"context"
	"encoding/json"
	"strings"
	"time"

	"docflow/internal/access"
	"docflow/internal/domain"
	"docflow/internal/repository"
)

// Шаблоны из конструктора (docs/plans/phase-01c-documents.md). Шаблон
// принадлежит компании, в которой его создали, и виден только в ней.
// Содержимое (поля, текст на языках, заголовок) хранится как прислал сайт –
// собирает лист из него сайт (toDocumentTemplate); сервер проверяет вид,
// размер, компанию, раздел и права.

// Template – шаблон в ответе API, как CustomTemplate на сайте.
type Template map[string]any

// TemplateInput – запись шаблона: содержимое и версия, которую видел человек
// (0 – новый).
type TemplateInput struct {
	Template    map[string]json.RawMessage `json:"template"`
	LockVersion int32                      `json:"lockVersion"`
}

// Поля, которые ставит сервер: из запроса они не берутся.
var serverTemplateKeys = []string{
	"id", "companyId", "authorId", "authorName", "createdAt", "updatedAt", "deletedAt", "deletedBy", "lockVersion",
}

func templateView(r repository.CustomTemplate) (Template, error) {
	t := Template{}
	if err := json.Unmarshal(r.Body, &t); err != nil {
		return nil, err
	}
	t["id"], t["companyId"], t["sectionId"], t["title"] = r.ID, r.CompanyID, r.SectionID, r.Title
	t["authorId"], t["authorName"], t["lockVersion"] = r.AuthorID, r.AuthorName, r.LockVersion
	t["createdAt"], t["updatedAt"] = timeOf(r.CreatedAt).Format(time.RFC3339Nano), timeOf(r.UpdatedAt).Format(time.RFC3339Nano)
	if r.DeletedAt.Valid {
		t["deletedAt"], t["deletedBy"] = timeOf(r.DeletedAt).Format(time.RFC3339Nano), r.DeletedBy
	}
	return t, nil
}

// checkTemplate – название, раздел и что содержимое похоже на шаблон
// конструктора; размер ограничен телом запроса (1 МБ).
func checkTemplate(in TemplateInput) (sectionID, title string, body []byte, err error) {
	var bad []domain.FieldError
	str := func(key string) string {
		var v string
		if raw, ok := in.Template[key]; ok && json.Unmarshal(raw, &v) == nil {
			return strings.TrimSpace(v)
		}
		return ""
	}
	sectionID, title = str("sectionId"), str("title")
	if title == "" || runes(title) > maxTitle {
		bad = append(bad, domain.FieldError{Field: "title", Message: "Название – от 1 до 500 знаков"})
	}
	if sectionID == "" || runes(sectionID) > 100 {
		bad = append(bad, domain.FieldError{Field: "sectionId", Message: "Выберите раздел"})
	}
	for _, key := range []string{"fields", "langs"} {
		var list []json.RawMessage
		if json.Unmarshal(in.Template[key], &list) != nil {
			bad = append(bad, domain.FieldError{Field: key, Message: "Шаблон неверного вида"})
		}
	}
	var text map[string]json.RawMessage
	if json.Unmarshal(in.Template["body"], &text) != nil {
		bad = append(bad, domain.FieldError{Field: "body", Message: "Шаблон неверного вида"})
	}
	if len(bad) > 0 {
		return "", "", nil, domain.NewValidationError(bad...)
	}
	content := make(map[string]json.RawMessage, len(in.Template))
	for k, v := range in.Template {
		content[k] = v
	}
	for _, k := range serverTemplateKeys {
		delete(content, k)
	}
	content["title"], _ = json.Marshal(title)
	body, err = json.Marshal(content)
	return sectionID, title, body, err
}

// ListTemplates – шаблоны текущей компании в разрешённых человеку разделах.
func (s *Service) ListTemplates(ctx context.Context, p access.Principal) ([]Template, error) {
	out := []Template{}
	if p.CompanyID == "" || !p.HasCompany(p.CompanyID) || p.Blocked {
		return out, nil
	}
	sections := p.SectionIDs
	if sections == nil {
		sections = []string{}
	}
	err := s.inTx(ctx, p, func(q *repository.Queries) error {
		rows, err := q.ListTemplates(ctx, repository.ListTemplatesParams{
			CompanyID: p.CompanyID, AllSections: p.RoleID != "employee", Sections: sections,
		})
		if err != nil {
			return err
		}
		for _, r := range rows {
			t, err := templateView(r)
			if err != nil {
				return err
			}
			out = append(out, t)
		}
		return nil
	})
	return out, err
}

func tplRef(r repository.CustomTemplate) access.Tpl {
	return access.Tpl{CompanyID: r.CompanyID, AuthorID: r.AuthorID, SectionID: r.SectionID, Deleted: r.DeletedAt.Valid}
}

// SaveTemplate создаёт шаблон в текущей компании или правит свой.
func (s *Service) SaveTemplate(ctx context.Context, p access.Principal, id string, in TemplateInput) (Template, error) {
	if !recordID.MatchString(id) {
		return nil, domain.ErrNotFound
	}
	sectionID, title, body, checkErr := checkTemplate(in)
	if checkErr != nil {
		return nil, checkErr
	}
	var out Template
	err := s.inTx(ctx, p, func(q *repository.Queries) error {
		name := actorName(ctx, q, p)
		row, getErr := q.GetTemplate(ctx, id)
		event := "template.update"
		switch {
		case isNoRows(getErr):
			if in.LockVersion != 0 {
				return domain.ErrNotFound
			}
			if !access.CanCreateTemplate(p, sectionID) {
				return domain.ErrForbidden
			}
			err := q.InsertTemplate(ctx, repository.InsertTemplateParams{
				CompanyID: p.CompanyID, ID: id, SectionID: sectionID, Title: title,
				AuthorID: p.UserID, AuthorName: name, Body: body, CreatedAt: ts(s.now()),
			})
			if constraintOf(err) == "custom_templates_id_key" || constraintOf(err) == "custom_templates_pkey" {
				return domain.ErrNotFound
			}
			if err != nil {
				return err
			}
			event = "template.create"
		case getErr != nil:
			return getErr
		default:
			if !access.CanSeeTemplate(p, tplRef(row)) {
				return domain.ErrNotFound
			}
			// Повтор создания, ответ на который не дошёл (как у документа).
			if in.LockVersion == 0 && row.AuthorID == p.UserID && row.LockVersion == 1 {
				in.LockVersion = 1
			}
			if !access.CanEditTemplate(p, tplRef(row)) || !access.CanCreateTemplate(p, sectionID) {
				return domain.ErrForbidden
			}
			n, err := q.UpdateTemplate(ctx, repository.UpdateTemplateParams{
				CompanyID: row.CompanyID, ID: id, SectionID: sectionID, Title: title, Body: body,
				UpdatedAt: ts(s.now()), LockVersion: in.LockVersion,
			})
			if err != nil {
				return err
			}
			if n == 0 {
				return domain.ErrConflict
			}
		}
		fresh, err := q.GetTemplate(ctx, id)
		if err != nil {
			return err
		}
		if out, err = templateView(fresh); err != nil {
			return err
		}
		return audit(ctx, q, p, name, event, title, fresh.CompanyID, "")
	})
	return out, err
}

// DeleteTemplate убирает шаблон из каталога; созданные по нему документы
// остаются со своим снимком.
func (s *Service) DeleteTemplate(ctx context.Context, p access.Principal, id string, lockVersion int32) error {
	return s.inTx(ctx, p, func(q *repository.Queries) error {
		row, err := q.GetTemplate(ctx, id)
		if isNoRows(err) {
			return domain.ErrNotFound
		}
		if err != nil {
			return err
		}
		if !access.CanSeeTemplate(p, tplRef(row)) {
			return domain.ErrNotFound
		}
		if !access.CanEditTemplate(p, tplRef(row)) {
			return domain.ErrForbidden
		}
		name := actorName(ctx, q, p)
		n, err := q.SoftDeleteTemplate(ctx, repository.SoftDeleteTemplateParams{
			CompanyID: row.CompanyID, ID: id, DeletedAt: ts(s.now()), DeletedBy: name, LockVersion: lockVersion,
		})
		if err != nil {
			return err
		}
		if n == 0 {
			return domain.ErrConflict
		}
		return audit(ctx, q, p, name, "template.delete", row.Title, row.CompanyID, "")
	})
}
