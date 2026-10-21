package service

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"

	"docflow/internal/access"
	"docflow/internal/domain"
	"docflow/internal/repository"
)

// Документы в базе (docs/plans/phase-01c-documents.md). Идентификатор
// заводит сайт: PUT /api/documents/{id} создаёт или правит, и повтор того
// же запроса ничего не удваивает. Компания нового документа – только из
// токена (CLAUDE.md, п. 3.1); кто что видит и правит – internal/access.

// PageSize – предел страницы списков (CLAUDE.md, п. 3.11).
const PageSize = 100

// Пределы полей документа – те же CHECK в базе.
const (
	maxTitle       = 500
	maxNumber      = 100
	maxSubject     = 500
	maxDescription = 2000
	maxValues      = 500
	maxValueKey    = 200
	maxValueLen    = 20000
	maxPeople      = 300
	maxImageData   = 1000000
)

var (
	recordID = regexp.MustCompile(`^[A-Za-z0-9_-]{3,80}$`)
	imageRef = regexp.MustCompile(`^image:s[0-9a-f]{64}$`)
	// Файл картинки из сборки сайта – если браузер не смог прочитать его,
	// чтобы прислать картинкой.
	assetPath = regexp.MustCompile(`^/[A-Za-z0-9/._-]{1,200}\.(png|jpe?g|gif|webp)$`)
	// Картинка снимка – data:URL растровой картинки в base64. SVG не
	// принимается: в нём бывает скрипт.
	imageData = regexp.MustCompile(`^data:image/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+$`)
)

// Grant – доступ к документу, выданный человеку поверх роли.
type Grant struct {
	UserID    string    `json:"userId"`
	Level     string    `json:"level"`
	GrantedBy string    `json:"grantedBy"`
	GrantedAt time.Time `json:"grantedAt"`
}

// Document – документ в ответе API, как DocumentRecord на сайте.
type Document struct {
	ID               string            `json:"id"`
	CompanyID        string            `json:"companyId"`
	TemplateID       string            `json:"templateId"`
	SectionID        string            `json:"sectionId"`
	Title            string            `json:"title"`
	TitleEn          string            `json:"titleEn,omitempty"`
	Description      string            `json:"description"`
	Subject          string            `json:"subject"`
	Status           string            `json:"status"`
	Number           *string           `json:"number"`
	Values           map[string]string `json:"values"`
	CompanySnapshot  json.RawMessage   `json:"companySnapshot,omitempty"`
	PeopleSnapshot   json.RawMessage   `json:"peopleSnapshot,omitempty"`
	TemplateSnapshot json.RawMessage   `json:"templateSnapshot,omitempty"`
	AuthorID         string            `json:"authorId"`
	AuthorName       string            `json:"authorName"`
	CreatedAt        time.Time         `json:"createdAt"`
	UpdatedAt        time.Time         `json:"updatedAt"`
	DeletedAt        *time.Time        `json:"deletedAt,omitempty"`
	DeletedBy        string            `json:"deletedBy,omitempty"`
	Grants           []Grant           `json:"grants"`
	LockVersion      int32             `json:"lockVersion"`
}

// DocumentInput – что сайт присылает при записи документа. LockVersion 0 –
// новый документ.
type DocumentInput struct {
	TemplateID       string            `json:"templateId"`
	SectionID        string            `json:"sectionId"`
	Title            string            `json:"title"`
	TitleEn          string            `json:"titleEn,omitempty"`
	Description      string            `json:"description"`
	Subject          string            `json:"subject"`
	Status           string            `json:"status"`
	Number           string            `json:"number"`
	Values           map[string]string `json:"values"`
	CompanySnapshot  json.RawMessage   `json:"companySnapshot,omitempty"`
	PeopleSnapshot   json.RawMessage   `json:"peopleSnapshot,omitempty"`
	TemplateSnapshot json.RawMessage   `json:"templateSnapshot,omitempty"`
	LockVersion      int32             `json:"lockVersion"`
}

// DocumentPage – страница списка и картинки снимков этой страницы.
type DocumentPage struct {
	Items  []Document        `json:"items"`
	Images map[string]string `json:"images"`
	Next   string            `json:"next,omitempty"`
}

// documentBody – то, что лежит в колонке body.
type documentBody struct {
	TitleEn          string            `json:"titleEn,omitempty"`
	Description      string            `json:"description"`
	Values           map[string]string `json:"values"`
	CompanySnapshot  json.RawMessage   `json:"companySnapshot,omitempty"`
	PeopleSnapshot   json.RawMessage   `json:"peopleSnapshot,omitempty"`
	TemplateSnapshot json.RawMessage   `json:"templateSnapshot,omitempty"`
}

// NormalizeNumber – номер для сравнения: «№ 12-К/2026» и «12-к/2026» – один
// номер (web/src/store/documentNumber.ts).
func NormalizeNumber(raw string) string {
	s := strings.TrimSpace(raw)
	if rest, ok := strings.CutPrefix(s, "№"); ok {
		s = strings.TrimSpace(rest)
	}
	return strings.ToLower(strings.Join(strings.Fields(s), " "))
}

func timeOf(t pgtype.Timestamptz) time.Time { return t.Time.UTC() }

func docRow(r repository.ListDocumentsRow) repository.GetDocumentRow {
	return repository.GetDocumentRow(r)
}

func documentView(r repository.GetDocumentRow, grants []Grant) (Document, error) {
	var body documentBody
	if err := json.Unmarshal(r.Body, &body); err != nil {
		return Document{}, err
	}
	if body.Values == nil {
		body.Values = map[string]string{}
	}
	if grants == nil {
		grants = []Grant{}
	}
	d := Document{
		ID: r.ID, CompanyID: r.CompanyID, TemplateID: r.TemplateID, SectionID: r.SectionID,
		Title: r.Title, TitleEn: body.TitleEn, Description: body.Description, Subject: r.Subject,
		Status: r.Status, Values: body.Values,
		CompanySnapshot: body.CompanySnapshot, PeopleSnapshot: body.PeopleSnapshot,
		TemplateSnapshot: body.TemplateSnapshot,
		AuthorID:         r.AuthorID, AuthorName: r.AuthorName,
		CreatedAt: timeOf(r.CreatedAt), UpdatedAt: timeOf(r.UpdatedAt),
		DeletedBy: r.DeletedBy, Grants: grants, LockVersion: r.LockVersion,
	}
	if r.Number.Valid {
		n := r.Number.String
		d.Number = &n
	}
	if r.DeletedAt.Valid {
		t := timeOf(r.DeletedAt)
		d.DeletedAt = &t
	}
	return d, nil
}

// docRef – документ глазами правил доступа для этого человека.
func docRef(ctx context.Context, q *repository.Queries, p access.Principal, r repository.GetDocumentRow) (access.Doc, error) {
	level, err := q.GetGrant(ctx, repository.GetGrantParams{CompanyID: r.CompanyID, DocumentID: r.ID, UserID: p.UserID})
	if err != nil && !isNoRows(err) {
		return access.Doc{}, err
	}
	return access.Doc{
		CompanyID: r.CompanyID, AuthorID: r.AuthorID, Status: r.Status, SectionID: r.SectionID,
		Deleted: r.DeletedAt.Valid, Grant: level,
	}, nil
}

func grantsOf(ctx context.Context, q *repository.Queries, ids []string) (map[string][]Grant, error) {
	out := map[string][]Grant{}
	if len(ids) == 0 {
		return out, nil
	}
	rows, err := q.ListGrants(ctx, ids)
	if err != nil {
		return nil, err
	}
	for _, g := range rows {
		out[g.DocumentID] = append(out[g.DocumentID], Grant{
			UserID: g.UserID, Level: g.Level, GrantedBy: g.GrantedBy, GrantedAt: timeOf(g.GrantedAt),
		})
	}
	return out, nil
}

// ── Курсор ──────────────────────────────────────────────────────────────────

func encodeCursor(at, id string) string {
	return base64.RawURLEncoding.EncodeToString([]byte(at + "|" + id))
}

func decodeCursor(raw string) (at, id string, err error) {
	b, err := base64.RawURLEncoding.DecodeString(raw)
	if err != nil {
		return "", "", domain.NewValidationError(domain.FieldError{Field: "cursor", Message: "Неверный курсор"})
	}
	at, id, ok := strings.Cut(string(b), "|")
	if !ok || !recordID.MatchString(id) {
		return "", "", domain.NewValidationError(domain.FieldError{Field: "cursor", Message: "Неверный курсор"})
	}
	return at, id, nil
}

func pageLimit(limit int) int32 {
	if limit <= 0 || limit > PageSize {
		return PageSize
	}
	return int32(limit) //nolint:gosec // G115: не больше PageSize
}

// ── Список ──────────────────────────────────────────────────────────────────

// ListDocuments – видимые документы всех доступных компаний (удалённые –
// тому, кто может вернуть) страницами по курсору. Фильтр – в SQL.
func (s *Service) ListDocuments(ctx context.Context, p access.Principal, cursor string, limit int) (DocumentPage, error) {
	page := DocumentPage{Items: []Document{}, Images: map[string]string{}}
	f, ok := access.DocumentFilter(p)
	if !ok {
		return page, nil
	}
	params := repository.ListDocumentsParams{
		CompanyIds: f.CompanyIDs, WithDeleted: f.WithDeleted, ViewAll: f.ViewAll,
		UserID: f.UserID, ViewSections: f.ViewSections, Lim: pageLimit(limit),
	}
	if cursor != "" {
		at, id, err := decodeCursor(cursor)
		if err != nil {
			return page, err
		}
		t, err := time.Parse(time.RFC3339Nano, at)
		if err != nil {
			return page, domain.NewValidationError(domain.FieldError{Field: "cursor", Message: "Неверный курсор"})
		}
		params.CursorAt, params.CursorID = ts(t), id
	}

	err := s.inTx(ctx, p, func(q *repository.Queries) error {
		rows, err := q.ListDocuments(ctx, params)
		if err != nil {
			return err
		}
		ids := make([]string, 0, len(rows))
		for _, r := range rows {
			ids = append(ids, r.ID)
		}
		grants, err := grantsOf(ctx, q, ids)
		if err != nil {
			return err
		}
		refs := map[string]bool{}
		companies := map[string]bool{}
		for _, r := range rows {
			d, viewErr := documentView(docRow(r), grants[r.ID])
			if viewErr != nil {
				return viewErr
			}
			page.Items = append(page.Items, d)
			if ref := logoRef(d.CompanySnapshot); ref != "" {
				refs[ref], companies[d.CompanyID] = true, true
			}
		}
		if len(rows) == int(params.Lim) {
			last := rows[len(rows)-1]
			page.Next = encodeCursor(timeOf(last.UpdatedAt).Format(time.RFC3339Nano), last.ID)
		}
		if len(refs) == 0 {
			return nil
		}
		images, err := q.ListImages(ctx, repository.ListImagesParams{CompanyIds: keys(companies), Refs: keys(refs)})
		if err != nil {
			return err
		}
		for _, img := range images {
			page.Images[img.Ref] = img.Data
		}
		return nil
	})
	return page, err
}

func keys(m map[string]bool) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	return out
}

// logoRef – ссылка на картинку логотипа в снимке реквизитов, если она там.
func logoRef(snapshot json.RawMessage) string {
	if len(snapshot) == 0 {
		return ""
	}
	var c struct {
		Logo string `json:"logo"`
	}
	if json.Unmarshal(snapshot, &c) != nil || !imageRef.MatchString(c.Logo) {
		return ""
	}
	return c.Logo
}

// ── Запись ──────────────────────────────────────────────────────────────────

func runes(s string) int { return utf8.RuneCountInString(s) }

// checkDocument – вид и размеры полей; компания снимка – компания документа.
func checkDocument(in *DocumentInput, companyID string) error {
	var bad []domain.FieldError
	add := func(field, msg string) { bad = append(bad, domain.FieldError{Field: field, Message: msg}) }

	in.Title = strings.TrimSpace(in.Title)
	in.Number = strings.TrimSpace(in.Number)
	in.Subject = strings.TrimSpace(in.Subject)
	in.Description = strings.TrimSpace(in.Description)

	if in.Status != "draft" && in.Status != "saved" {
		add("status", "Состояние – черновик или сохранён")
	}
	if in.TemplateID == "" || runes(in.TemplateID) > 200 {
		add("templateId", "Нет шаблона")
	}
	if runes(in.SectionID) > 100 {
		add("sectionId", "Неверный раздел")
	}
	if in.Title == "" || runes(in.Title) > maxTitle || runes(in.TitleEn) > maxTitle {
		add("title", "Название – от 1 до 500 знаков")
	}
	if runes(in.Number) > maxNumber {
		add("number", "Номер – не длиннее 100 знаков")
	}
	if runes(in.Subject) > maxSubject {
		add("subject", "Не длиннее 500 знаков")
	}
	if runes(in.Description) > maxDescription {
		add("description", "Не длиннее 2000 знаков")
	}
	if len(in.Values) > maxValues {
		add("values", "Слишком много полей")
	}
	for k, v := range in.Values {
		if k == "" || runes(k) > maxValueKey || runes(v) > maxValueLen {
			add("values", "Поле документа слишком длинное")
			break
		}
	}
	if err := checkSnapshots(in, companyID); err != nil {
		add("snapshot", "Снимок документа неверного вида")
	}
	if len(bad) > 0 {
		return domain.NewValidationError(bad...)
	}
	return nil
}

var errSnapshot = errors.New("снимок документа неверного вида")

func checkSnapshots(in *DocumentInput, companyID string) error {
	if len(in.CompanySnapshot) > 0 {
		var c map[string]json.RawMessage
		if json.Unmarshal(in.CompanySnapshot, &c) != nil {
			return errSnapshot
		}
		var id string
		if json.Unmarshal(c["id"], &id) != nil || id != companyID {
			return errSnapshot
		}
		if raw, ok := c["logo"]; ok {
			var logo string
			// Логотип – ссылкой на картинку, загруженную PUT /api/images, или
			// адресом файла сборки сайта.
			if json.Unmarshal(raw, &logo) != nil || (!imageRef.MatchString(logo) && !assetPath.MatchString(logo)) {
				return errSnapshot
			}
		}
	}
	if len(in.PeopleSnapshot) > 0 {
		var people map[string]json.RawMessage
		if json.Unmarshal(in.PeopleSnapshot, &people) != nil || len(people) > maxPeople {
			return errSnapshot
		}
	}
	if len(in.TemplateSnapshot) > 0 {
		var t map[string]json.RawMessage
		if json.Unmarshal(in.TemplateSnapshot, &t) != nil {
			return errSnapshot
		}
	}
	// Выпущенный документ держит снимок реквизитов (CLAUDE.md, п. 3.4).
	if in.Status == "saved" && len(in.CompanySnapshot) == 0 {
		return errSnapshot
	}
	return nil
}

func numberParam(n string) pgtype.Text { return pgtype.Text{String: n, Valid: n != ""} }

func constraintOf(err error) string {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.ConstraintName
	}
	return ""
}

var errNumberTaken = domain.NewValidationError(domain.FieldError{
	Field: "number", Message: "Этот номер уже стоит на другом документе компании. Укажите другой.",
})

// SaveDocument создаёт документ в текущей компании или правит видимый.
func (s *Service) SaveDocument(ctx context.Context, p access.Principal, id string, in DocumentInput) (Document, error) {
	if !recordID.MatchString(id) {
		return Document{}, domain.ErrNotFound
	}
	var out Document
	err := s.inTx(ctx, p, func(q *repository.Queries) error {
		row, err := q.GetDocument(ctx, id)
		switch {
		case isNoRows(err):
			return s.createDocument(ctx, q, p, id, in, &out)
		case err != nil:
			return err
		}
		ref, err := docRef(ctx, q, p, row)
		if err != nil {
			return err
		}
		if !access.CanViewDocument(p, ref) {
			return domain.ErrNotFound
		}
		// Повтор запроса создания, ответ на который не дошёл: тот же автор,
		// версия ещё первая – это та же запись, а не чужая правка.
		if in.LockVersion == 0 && row.AuthorID == p.UserID && row.LockVersion == 1 {
			in.LockVersion = 1
		}
		return s.updateDocument(ctx, q, p, row, ref, in, &out)
	})
	return out, err
}

func (s *Service) createDocument(ctx context.Context, q *repository.Queries, p access.Principal, id string, in DocumentInput, out *Document) error {
	company := p.CompanyID
	if in.LockVersion != 0 {
		// Документ правили, а его нет: стёрт или не виден.
		return domain.ErrNotFound
	}
	if !access.CanCreateDocument(p, in.SectionID) {
		return domain.ErrForbidden
	}
	if err := checkDocument(&in, company); err != nil {
		return err
	}
	if err := withCompanySnapshot(ctx, q, company, &in); err != nil {
		return err
	}
	if err := s.checkImages(ctx, q, company, in.CompanySnapshot); err != nil {
		return err
	}
	key := NormalizeNumber(in.Number)
	if in.Status == "saved" && key != "" {
		taken, err := q.NumberHolder(ctx, repository.NumberHolderParams{CompanyID: company, NumberKey: key, ID: id})
		if err != nil {
			return err
		}
		if taken {
			return errNumberTaken
		}
	}
	body, err := json.Marshal(bodyOf(in))
	if err != nil {
		return err
	}
	name := actorName(ctx, q, p)
	now := ts(s.now())
	if err = q.InsertDocument(ctx, repository.InsertDocumentParams{
		CompanyID: company, ID: id, TemplateID: in.TemplateID, SectionID: in.SectionID, Title: in.Title,
		Status: in.Status, Number: numberParam(in.Number), NumberKey: key, Subject: in.Subject,
		AuthorID: p.UserID, AuthorName: name, Body: body, CreatedAt: now,
	}); err != nil {
		switch constraintOf(err) {
		case "documents_number_key":
			return errNumberTaken
		case "documents_id_key", "documents_pkey":
			// Такой идентификатор уже занят документом, которого человек не
			// видит, – о его существовании не говорим (п. 3.2).
			return domain.ErrNotFound
		}
		return err
	}
	row, err := q.GetDocument(ctx, id)
	if err != nil {
		return err
	}
	if *out, err = documentView(row, nil); err != nil {
		return err
	}
	return audit(ctx, q, p, name, "document.create", in.Title, company, "")
}

func (s *Service) updateDocument(ctx context.Context, q *repository.Queries, p access.Principal, row repository.GetDocumentRow, ref access.Doc, in DocumentInput, out *Document) error {
	if !access.CanEditDocument(p, ref) {
		return domain.ErrForbidden
	}
	if row.LockVersion != in.LockVersion {
		return domain.ErrConflict
	}
	if err := checkDocument(&in, row.CompanyID); err != nil {
		return err
	}
	// Выпущенный документ обратно в черновик не превращается.
	if row.Status == "saved" && in.Status == "draft" {
		return domain.NewValidationError(domain.FieldError{Field: "status", Message: "Сохранённый документ не становится черновиком"})
	}
	if err := withCompanySnapshot(ctx, q, row.CompanyID, &in); err != nil {
		return err
	}
	if err := s.checkImages(ctx, q, row.CompanyID, in.CompanySnapshot); err != nil {
		return err
	}
	key := NormalizeNumber(in.Number)
	if in.Status == "saved" && key != "" {
		taken, err := q.NumberHolder(ctx, repository.NumberHolderParams{CompanyID: row.CompanyID, NumberKey: key, ID: row.ID})
		if err != nil {
			return err
		}
		if taken {
			return errNumberTaken
		}
	}
	body, err := json.Marshal(bodyOf(in))
	if err != nil {
		return err
	}
	n, err := q.UpdateDocument(ctx, repository.UpdateDocumentParams{
		CompanyID: row.CompanyID, ID: row.ID, TemplateID: in.TemplateID, SectionID: in.SectionID,
		Title: in.Title, Status: in.Status, Number: numberParam(in.Number), NumberKey: key,
		Subject: in.Subject, Body: body, UpdatedAt: ts(s.now()), LockVersion: in.LockVersion,
	})
	if err != nil {
		if constraintOf(err) == "documents_number_key" {
			return errNumberTaken
		}
		return err
	}
	if n == 0 {
		return domain.ErrConflict
	}
	fresh, err := q.GetDocument(ctx, row.ID)
	if err != nil {
		return err
	}
	grants, err := grantsOf(ctx, q, []string{row.ID})
	if err != nil {
		return err
	}
	if *out, err = documentView(fresh, grants[row.ID]); err != nil {
		return err
	}
	// Автосохранение черновика в журнал не пишется – иначе журнал станет
	// нечитаемым (как на сайте).
	if in.Status == "draft" {
		return nil
	}
	return audit(ctx, q, p, actorName(ctx, q, p), "document.update", in.Title, row.CompanyID, "")
}

func bodyOf(in DocumentInput) documentBody {
	values := in.Values
	if values == nil {
		values = map[string]string{}
	}
	return documentBody{
		TitleEn: in.TitleEn, Description: in.Description, Values: values,
		CompanySnapshot: in.CompanySnapshot, PeopleSnapshot: in.PeopleSnapshot, TemplateSnapshot: in.TemplateSnapshot,
	}
}

// withCompanySnapshot – снимок реквизитов выпускаемого документа. Реквизиты
// сервер берёт из карточки компании в той же транзакции, а не из браузера
// (CLAUDE.md, п. 3.3, 3.4). Из присланного снимка – только версия карточки,
// которую человек видел на листе, и ссылка на логотип (её проверяет
// checkImages: картинка этой компании; логотип из сборки сайта сервер сам
// в картинку не превратит). Карточку с тех пор правили или версии нет –
// ErrCompanyChanged: новые реквизиты человек должен увидеть до того, как
// они лягут в документ навсегда. Черновик снимка не держит.
func withCompanySnapshot(ctx context.Context, q *repository.Queries, companyID string, in *DocumentInput) error {
	if in.Status != "saved" {
		return nil
	}
	var seen struct {
		LockVersion *int32 `json:"lockVersion"`
		Logo        string `json:"logo"`
	}
	if json.Unmarshal(in.CompanySnapshot, &seen) != nil {
		return errSnapshot
	}
	r, err := q.GetCompany(ctx, companyID)
	if isNoRows(err) {
		return domain.ErrNotFound
	}
	if err != nil {
		return err
	}
	if seen.LockVersion == nil || *seen.LockVersion != r.LockVersion {
		return domain.ErrCompanyChanged
	}
	card, err := companyView(r.ID, r.Name, r.Bin, r.Requisites, r.LockVersion)
	if err != nil {
		return err
	}
	delete(card, "logo")
	if seen.Logo != "" {
		card["logo"] = seen.Logo
	}
	if in.CompanySnapshot, err = json.Marshal(card); err != nil {
		return fmt.Errorf("снимок реквизитов: %w", err)
	}
	return nil
}

// checkImages – логотип снимка ссылается на картинку этой компании.
func (s *Service) checkImages(ctx context.Context, q *repository.Queries, companyID string, snapshot json.RawMessage) error {
	ref := logoRef(snapshot)
	if ref == "" {
		return nil
	}
	found, err := q.ImageExists(ctx, repository.ImageExistsParams{CompanyID: companyID, Ref: ref})
	if err != nil {
		return err
	}
	if !found {
		return domain.NewValidationError(domain.FieldError{Field: "snapshot", Message: "Картинка снимка не загружена"})
	}
	return nil
}

// PutImage кладёт картинку снимка в текущую компанию и отдаёт ссылку на неё.
// Та же картинка второй раз не копируется.
func (s *Service) PutImage(ctx context.Context, p access.Principal, data string) (string, error) {
	if p.CompanyID == "" || !p.HasCompany(p.CompanyID) || p.Blocked {
		return "", domain.ErrForbidden
	}
	if len(data) > maxImageData || !imageData.MatchString(data) {
		return "", domain.NewValidationError(domain.FieldError{Field: "data", Message: "Картинка – PNG, JPEG, GIF или WebP до 700 КБ"})
	}
	sum := sha256.Sum256([]byte(data))
	ref := "image:s" + hex.EncodeToString(sum[:])
	err := s.inTx(ctx, p, func(q *repository.Queries) error {
		return q.InsertImage(ctx, repository.InsertImageParams{CompanyID: p.CompanyID, Ref: ref, Data: data})
	})
	return ref, err
}

// ── Корзина ─────────────────────────────────────────────────────────────────

// documentAction – общая часть удаления, возврата и стирания: строка под
// блокировкой, правило, запрос с версией, журнал.
func (s *Service) documentAction(
	ctx context.Context, p access.Principal, id string, lockVersion int32, event string,
	allowed func(access.Principal, access.Doc) bool,
	run func(*repository.Queries, repository.GetDocumentRow) (int64, error),
) error {
	return s.inTx(ctx, p, func(q *repository.Queries) error {
		row, err := q.GetDocument(ctx, id)
		if isNoRows(err) {
			return domain.ErrNotFound
		}
		if err != nil {
			return err
		}
		ref, err := docRef(ctx, q, p, row)
		if err != nil {
			return err
		}
		if !access.CanViewDocument(p, ref) {
			return domain.ErrNotFound
		}
		if !allowed(p, ref) {
			return domain.ErrForbidden
		}
		if row.LockVersion != lockVersion {
			return domain.ErrConflict
		}
		n, err := run(q, row)
		if err != nil {
			return err
		}
		if n == 0 {
			return domain.ErrConflict
		}
		target := row.Title
		if event == "document.purge" && row.Number.Valid {
			target = row.Title + " № " + row.Number.String
		}
		return audit(ctx, q, p, actorName(ctx, q, p), event, target, row.CompanyID, "")
	})
}

// DeleteDocument – в корзину.
func (s *Service) DeleteDocument(ctx context.Context, p access.Principal, id string, lockVersion int32) error {
	return s.documentAction(ctx, p, id, lockVersion, "document.delete", access.CanDeleteDocument,
		func(q *repository.Queries, row repository.GetDocumentRow) (int64, error) {
			return q.SoftDeleteDocument(ctx, repository.SoftDeleteDocumentParams{
				CompanyID: row.CompanyID, ID: row.ID, DeletedAt: ts(s.now()),
				DeletedBy: actorName(ctx, q, p), LockVersion: lockVersion,
			})
		})
}

// RestoreDocument – из корзины в реестр. Номер, занятый за это время другим
// документом, – ошибка поля номера.
func (s *Service) RestoreDocument(ctx context.Context, p access.Principal, id string, lockVersion int32) error {
	err := s.documentAction(ctx, p, id, lockVersion, "document.restore", access.CanRestoreDocument,
		func(q *repository.Queries, row repository.GetDocumentRow) (int64, error) {
			return q.RestoreDocument(ctx, repository.RestoreDocumentParams{
				CompanyID: row.CompanyID, ID: row.ID, LockVersion: lockVersion,
			})
		})
	if constraintOf(err) == "documents_number_key" {
		return errNumberTaken
	}
	return err
}

// PurgeDocument – стереть навсегда, только из корзины. В журнале остаётся,
// что это было.
func (s *Service) PurgeDocument(ctx context.Context, p access.Principal, id string, lockVersion int32) error {
	return s.documentAction(ctx, p, id, lockVersion, "document.purge", access.CanPurgeDocument,
		func(q *repository.Queries, row repository.GetDocumentRow) (int64, error) {
			return q.PurgeDocument(ctx, repository.PurgeDocumentParams{
				CompanyID: row.CompanyID, ID: row.ID, LockVersion: lockVersion,
			})
		})
}

// ── Выданный доступ ─────────────────────────────────────────────────────────

// SetDocumentGrant выдаёт (view, edit) или снимает ("") доступ человека к
// документу. Только людям компании документа (п. 3.1).
func (s *Service) SetDocumentGrant(ctx context.Context, p access.Principal, docID, userID, level string) (Document, error) {
	if level != "" && level != "view" && level != "edit" {
		return Document{}, domain.NewValidationError(domain.FieldError{Field: "level", Message: "Доступ – view или edit"})
	}
	var out Document
	err := s.inTx(ctx, p, func(q *repository.Queries) error {
		row, err := q.GetDocument(ctx, docID)
		if isNoRows(err) {
			return domain.ErrNotFound
		}
		if err != nil {
			return err
		}
		ref, err := docRef(ctx, q, p, row)
		if err != nil {
			return err
		}
		if !access.CanViewDocument(p, ref) {
			return domain.ErrNotFound
		}
		if !access.CanGrantDocument(p, ref) {
			return domain.ErrForbidden
		}
		name := actorName(ctx, q, p)
		target, err := q.GrantTarget(ctx, repository.GrantTargetParams{CompanyID: row.CompanyID, ID: userID})
		if isNoRows(err) {
			return domain.ErrNotFound
		}
		if err != nil {
			return err
		}
		if level == "" {
			if _, err = q.DeleteGrant(ctx, repository.DeleteGrantParams{CompanyID: row.CompanyID, DocumentID: row.ID, UserID: userID}); err != nil {
				return err
			}
		} else {
			perms, permErr := q.RolePermissions(ctx, target.RoleID)
			if permErr != nil {
				return permErr
			}
			receiver := access.GrantReceiver{
				ID: target.ID, Blocked: target.Blocked, InCompany: true,
				ViewsAll: containsString(perms, "documents.viewAll"),
			}
			if !access.CanReceiveGrant(p, receiver) {
				return domain.NewValidationError(domain.FieldError{Field: "userId", Message: "Этому человеку доступ не выдаётся"})
			}
			if err = q.UpsertGrant(ctx, repository.UpsertGrantParams{
				CompanyID: row.CompanyID, DocumentID: row.ID, UserID: userID, Level: level,
				GrantedBy: name, GrantedAt: ts(s.now()),
			}); err != nil {
				return err
			}
		}
		grants, err := grantsOf(ctx, q, []string{row.ID})
		if err != nil {
			return err
		}
		if out, err = documentView(row, grants[row.ID]); err != nil {
			return err
		}
		event := "document.revoke"
		if level != "" {
			event = "document.grant." + level
		}
		return audit(ctx, q, p, name, event, row.Title+" – "+target.DisplayName, row.CompanyID, "")
	})
	return out, err
}

func containsString(list []string, v string) bool {
	for _, x := range list {
		if x == v {
			return true
		}
	}
	return false
}
