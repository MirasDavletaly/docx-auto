package service

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"regexp"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgtype"

	"docflow/internal/access"
	"docflow/internal/auth"
	"docflow/internal/domain"
	"docflow/internal/repository"
)

// Архив загруженных PDF (docs/plans/phase-01c-documents.md). Файл идёт
// частями до 768 КБ: так не меняются ни предел тела запроса 1 МБ, ни сроки
// чтения запроса, а файл 20 МБ доходит и по медленному каналу. Завершая
// загрузку, сервер сверяет число частей, размер, SHA-256 и что это PDF
// (CLAUDE.md, п. 3.7); до этого файл не виден никому.

const (
	// ArchivePartSize – размер части файла; последняя может быть меньше.
	ArchivePartSize = 768 * 1024
	// MaxArchiveBytes – предел файла, как MAX_PDF_BYTES на сайте.
	MaxArchiveBytes = 20 * 1024 * 1024
	// staleUpload – через сколько брошенная загрузка удаляется.
	staleUpload = 24 * time.Hour
)

var sha256Hex = regexp.MustCompile(`^[0-9a-f]{64}$`)

// ArchiveFile – файл архива в ответе API, как ArchiveFile на сайте.
type ArchiveFile struct {
	ID             string     `json:"id"`
	CompanyID      string     `json:"companyId"`
	Title          string     `json:"title"`
	Number         *string    `json:"number"`
	DocumentDate   string     `json:"documentDate"`
	SectionID      string     `json:"sectionId"`
	Description    string     `json:"description"`
	FileName       string     `json:"fileName"`
	Size           int64      `json:"size"`
	SHA256         string     `json:"sha256"`
	UploadedBy     string     `json:"uploadedBy"`
	UploadedByName string     `json:"uploadedByName"`
	UploadedAt     time.Time  `json:"uploadedAt"`
	DeletedAt      *time.Time `json:"deletedAt,omitempty"`
	DeletedBy      string     `json:"deletedBy,omitempty"`
	// Parts – сколько частей у файла (для скачивания).
	Parts int `json:"parts"`
}

// ArchivePage – страница архива.
type ArchivePage struct {
	Items []ArchiveFile `json:"items"`
	Next  string        `json:"next,omitempty"`
}

// ArchiveUploadInput – описание файла перед загрузкой частей.
type ArchiveUploadInput struct {
	Title        string `json:"title"`
	Number       string `json:"number"`
	DocumentDate string `json:"documentDate"`
	SectionID    string `json:"sectionId"`
	Description  string `json:"description"`
	FileName     string `json:"fileName"`
	Size         int64  `json:"size"`
	SHA256       string `json:"sha256"`
}

// ArchiveUpload – куда слать части.
type ArchiveUpload struct {
	ID       string `json:"id"`
	Parts    int    `json:"parts"`
	PartSize int    `json:"partSize"`
}

func partsOf(size int64) int {
	return int((size + ArchivePartSize - 1) / ArchivePartSize)
}

func archiveView(r repository.ArchiveFile) ArchiveFile {
	f := ArchiveFile{
		ID: r.ID, CompanyID: r.CompanyID, Title: r.Title, DocumentDate: r.DocumentDate.Time.Format(time.DateOnly),
		SectionID: r.SectionID, Description: r.Description, FileName: r.FileName, Size: r.Size,
		SHA256: r.Sha256, UploadedBy: r.UploadedBy, UploadedByName: r.UploadedByName,
		UploadedAt: timeOf(r.UploadedAt), DeletedBy: r.DeletedBy, Parts: partsOf(r.Size),
	}
	if r.Number.Valid {
		n := r.Number.String
		f.Number = &n
	}
	if r.DeletedAt.Valid {
		t := timeOf(r.DeletedAt)
		f.DeletedAt = &t
	}
	return f
}

func fileRef(r repository.ArchiveFile) access.File {
	return access.File{CompanyID: r.CompanyID, UploadedBy: r.UploadedBy, SectionID: r.SectionID, Deleted: r.DeletedAt.Valid}
}

// ListArchive – видимые файлы всех доступных компаний, фильтр – в SQL.
func (s *Service) ListArchive(ctx context.Context, p access.Principal, cursor string, limit int) (ArchivePage, error) {
	page := ArchivePage{Items: []ArchiveFile{}}
	f, ok := access.DocumentFilter(p)
	if !ok {
		return page, nil
	}
	params := repository.ListArchiveParams{
		CompanyIds: f.CompanyIDs, WithDeleted: f.WithDeleted, ViewAll: f.ViewAll,
		UserID: f.UserID, ViewSections: f.ViewSections, Lim: pageLimit(limit),
	}
	if cursor != "" {
		at, id, err := decodeCursor(cursor)
		if err != nil {
			return page, err
		}
		d, err := time.Parse(time.DateOnly, at)
		if err != nil {
			return page, domain.NewValidationError(domain.FieldError{Field: "cursor", Message: "Неверный курсор"})
		}
		params.CursorDate, params.CursorID = pgtype.Date{Time: d, Valid: true}, id
	}
	err := s.inTx(ctx, p, func(q *repository.Queries) error {
		rows, err := q.ListArchive(ctx, params)
		if err != nil {
			return err
		}
		for _, r := range rows {
			page.Items = append(page.Items, archiveView(repository.ArchiveFile{
				CompanyID: r.CompanyID, ID: r.ID, SectionID: r.SectionID, Title: r.Title, Number: r.Number,
				DocumentDate: r.DocumentDate, Description: r.Description, FileName: r.FileName, Size: r.Size,
				Sha256: r.Sha256, UploadedBy: r.UploadedBy, UploadedByName: r.UploadedByName,
				UploadedAt: r.UploadedAt, DeletedAt: r.DeletedAt, DeletedBy: r.DeletedBy,
			}))
		}
		if len(rows) == int(params.Lim) {
			last := rows[len(rows)-1]
			page.Next = encodeCursor(last.DocumentDate.Time.Format(time.DateOnly), last.ID)
		}
		return nil
	})
	return page, err
}

func checkUpload(in *ArchiveUploadInput) (time.Time, error) {
	var bad []domain.FieldError
	add := func(field, msg string) { bad = append(bad, domain.FieldError{Field: field, Message: msg}) }
	in.Title = strings.TrimSpace(in.Title)
	in.Number = strings.TrimSpace(in.Number)
	in.Description = strings.TrimSpace(in.Description)
	in.FileName = strings.TrimSpace(in.FileName)
	if in.Title == "" || runes(in.Title) > maxTitle {
		add("title", "Название – от 1 до 500 знаков")
	}
	if runes(in.Number) > maxNumber {
		add("number", "Номер – не длиннее 100 знаков")
	}
	if runes(in.Description) > maxDescription {
		add("description", "Не длиннее 2000 знаков")
	}
	if in.SectionID == "" || runes(in.SectionID) > 100 {
		add("sectionId", "Выберите раздел")
	}
	if in.FileName == "" || runes(in.FileName) > 255 {
		add("fileName", "Нет имени файла")
	}
	if in.Size <= 0 || in.Size > MaxArchiveBytes {
		add("file", "Файл – до 20 МБ")
	}
	if !sha256Hex.MatchString(in.SHA256) {
		add("sha256", "Неверная сумма файла")
	}
	date, err := time.Parse(time.DateOnly, in.DocumentDate)
	if err != nil {
		add("documentDate", "Укажите дату документа")
	}
	if len(bad) > 0 {
		return time.Time{}, domain.NewValidationError(bad...)
	}
	return date, nil
}

// StartArchiveUpload заводит загрузку файла в архив текущей компании. Тот же
// файл уже в архиве – конфликт.
func (s *Service) StartArchiveUpload(ctx context.Context, p access.Principal, in ArchiveUploadInput) (ArchiveUpload, error) {
	if !access.CanUploadArchive(p, in.SectionID) {
		return ArchiveUpload{}, domain.ErrForbidden
	}
	date, err := checkUpload(&in)
	if err != nil {
		return ArchiveUpload{}, err
	}
	id, err := auth.NewID("f")
	if err != nil {
		return ArchiveUpload{}, err
	}
	company := p.CompanyID
	err = s.inTx(ctx, p, func(q *repository.Queries) error {
		if cleanErr := q.DeleteStaleUploads(ctx, repository.DeleteStaleUploadsParams{
			CompanyID: company, UploadedAt: ts(s.now().Add(-staleUpload)),
		}); cleanErr != nil {
			return cleanErr
		}
		dup, dupErr := q.ArchiveDuplicate(ctx, repository.ArchiveDuplicateParams{CompanyID: company, Sha256: in.SHA256})
		if dupErr != nil {
			return dupErr
		}
		if dup {
			return domain.ErrConflict
		}
		return q.InsertArchiveFile(ctx, repository.InsertArchiveFileParams{
			CompanyID: company, ID: id, SectionID: in.SectionID, Title: in.Title, Number: numberParam(in.Number),
			DocumentDate: pgtype.Date{Time: date, Valid: true}, Description: in.Description,
			FileName: in.FileName, Size: in.Size, Sha256: in.SHA256,
			UploadedBy: p.UserID, UploadedByName: actorName(ctx, q, p), UploadedAt: ts(s.now()),
		})
	})
	return ArchiveUpload{ID: id, Parts: partsOf(in.Size), PartSize: ArchivePartSize}, err
}

// uploading – незавершённая загрузка этого человека в текущей компании.
func uploading(ctx context.Context, q *repository.Queries, p access.Principal, id string) (repository.ArchiveFile, error) {
	row, err := q.GetArchiveFile(ctx, repository.GetArchiveFileParams{CompanyID: p.CompanyID, ID: id})
	if isNoRows(err) {
		return row, domain.ErrNotFound
	}
	if err != nil {
		return row, err
	}
	if row.State != "uploading" || row.UploadedBy != p.UserID {
		return row, domain.ErrNotFound
	}
	return row, nil
}

// PutArchivePart принимает часть файла. Повтор той же части её заменяет.
func (s *Service) PutArchivePart(ctx context.Context, p access.Principal, id string, part int, data []byte) error {
	if p.CompanyID == "" {
		return domain.ErrNotFound
	}
	return s.inTx(ctx, p, func(q *repository.Queries) error {
		row, err := uploading(ctx, q, p, id)
		if err != nil {
			return err
		}
		n := partsOf(row.Size)
		want := ArchivePartSize
		if part == n-1 {
			want = int(row.Size - int64(n-1)*ArchivePartSize)
		}
		if part < 0 || part >= n || len(data) != want {
			return domain.NewValidationError(domain.FieldError{Field: "part", Message: "Часть файла не того размера"})
		}
		return q.PutArchivePart(ctx, repository.PutArchivePartParams{
			CompanyID: p.CompanyID, FileID: id, Part: int32(part), Data: data, //nolint:gosec // G115: part < 64
		})
	})
}

var errBadUpload = domain.NewValidationError(domain.FieldError{
	Field: "file", Message: "Файл дошёл не целиком или это не PDF. Загрузите его ещё раз",
})

// CompleteArchiveUpload сверяет части с описанием (число, размер, SHA-256,
// PDF по содержимому) и открывает файл. Не сошлось – загрузка удаляется.
func (s *Service) CompleteArchiveUpload(ctx context.Context, p access.Principal, id string) (ArchiveFile, error) {
	if p.CompanyID == "" {
		return ArchiveFile{}, domain.ErrNotFound
	}
	var out ArchiveFile
	bad := false
	err := s.inTx(ctx, p, func(q *repository.Queries) error {
		row, err := uploading(ctx, q, p, id)
		if err != nil {
			return err
		}
		parts, err := q.ArchiveParts(ctx, repository.ArchivePartsParams{CompanyID: p.CompanyID, FileID: id})
		if err != nil {
			return err
		}
		h := sha256.New()
		var size int64
		ok := len(parts) == partsOf(row.Size)
		for i, part := range parts {
			if !ok || int(part.Part) != i {
				ok = false
				break
			}
			if i == 0 && !bytes.HasPrefix(part.Data, []byte("%PDF-")) {
				ok = false
				break
			}
			h.Write(part.Data)
			size += int64(len(part.Data))
		}
		if !ok || size != row.Size || hex.EncodeToString(h.Sum(nil)) != row.Sha256 {
			bad = true
			return q.DeleteArchiveUpload(ctx, repository.DeleteArchiveUploadParams{CompanyID: p.CompanyID, ID: id})
		}
		dup, err := q.ArchiveDuplicate(ctx, repository.ArchiveDuplicateParams{CompanyID: p.CompanyID, Sha256: row.Sha256})
		if err != nil {
			return err
		}
		if dup {
			// Тот же файл загрузили за это время ещё раз; брошенную загрузку
			// уберёт следующая (DeleteStaleUploads).
			return domain.ErrConflict
		}
		if err := q.MarkArchiveReady(ctx, repository.MarkArchiveReadyParams{CompanyID: p.CompanyID, ID: id}); err != nil {
			return err
		}
		out = archiveView(row)
		return audit(ctx, q, p, row.UploadedByName, "archive.upload", row.Title, p.CompanyID, "")
	})
	// Не сошлось: удаление загрузки зафиксировано, человеку – отказ.
	if err == nil && bad {
		return ArchiveFile{}, errBadUpload
	}
	return out, err
}

// archiveFile – файл по идентификатору в любой доступной компании (корзина
// админ-панели), под блокировкой строки.
func archiveFile(ctx context.Context, q *repository.Queries, id string) (repository.ArchiveFile, error) {
	company, err := q.FindArchiveFile(ctx, id)
	if isNoRows(err) {
		return repository.ArchiveFile{}, domain.ErrNotFound
	}
	if err != nil {
		return repository.ArchiveFile{}, err
	}
	row, err := q.GetArchiveFile(ctx, repository.GetArchiveFileParams{CompanyID: company, ID: id})
	if isNoRows(err) || (err == nil && row.State != "ready") {
		return row, domain.ErrNotFound
	}
	return row, err
}

// ArchivePart отдаёт часть готового файла тому, кто его видит.
func (s *Service) ArchivePart(ctx context.Context, p access.Principal, id string, part int) ([]byte, error) {
	var data []byte
	err := s.inTx(ctx, p, func(q *repository.Queries) error {
		row, err := archiveFile(ctx, q, id)
		if err != nil {
			return err
		}
		if !access.CanViewArchiveFile(p, fileRef(row)) {
			return domain.ErrNotFound
		}
		if part < 0 || part >= partsOf(row.Size) {
			return domain.ErrNotFound
		}
		data, err = q.GetArchivePart(ctx, repository.GetArchivePartParams{CompanyID: row.CompanyID, FileID: id, Part: int32(part)}) //nolint:gosec // G115: part < 64
		if isNoRows(err) {
			return domain.ErrNotFound
		}
		return err
	})
	return data, err
}

func (s *Service) archiveAction(
	ctx context.Context, p access.Principal, id, event string,
	allowed func(access.Principal, access.File) bool,
	run func(*repository.Queries, repository.ArchiveFile, string) (int64, error),
) error {
	return s.inTx(ctx, p, func(q *repository.Queries) error {
		row, err := archiveFile(ctx, q, id)
		if err != nil {
			return err
		}
		ref := fileRef(row)
		if !access.CanViewArchiveFile(p, ref) {
			return domain.ErrNotFound
		}
		if !allowed(p, ref) {
			return domain.ErrForbidden
		}
		name := actorName(ctx, q, p)
		n, err := run(q, row, name)
		if err != nil {
			if constraintOf(err) == "archive_files_sha" {
				// Возвращают файл, который за это время загрузили ещё раз.
				return domain.ErrConflict
			}
			return err
		}
		if n == 0 {
			return domain.ErrConflict
		}
		return audit(ctx, q, p, name, event, row.Title, row.CompanyID, "")
	})
}

// DeleteArchiveFile – в корзину.
func (s *Service) DeleteArchiveFile(ctx context.Context, p access.Principal, id string) error {
	return s.archiveAction(ctx, p, id, "archive.delete", access.CanDeleteArchiveFile,
		func(q *repository.Queries, row repository.ArchiveFile, name string) (int64, error) {
			return q.SoftDeleteArchiveFile(ctx, repository.SoftDeleteArchiveFileParams{
				CompanyID: row.CompanyID, ID: row.ID, DeletedAt: ts(s.now()), DeletedBy: name,
			})
		})
}

// RestoreArchiveFile – из корзины в архив.
func (s *Service) RestoreArchiveFile(ctx context.Context, p access.Principal, id string) error {
	return s.archiveAction(ctx, p, id, "archive.restore", access.CanRestoreArchiveFile,
		func(q *repository.Queries, row repository.ArchiveFile, _ string) (int64, error) {
			return q.RestoreArchiveFile(ctx, repository.RestoreArchiveFileParams{CompanyID: row.CompanyID, ID: row.ID})
		})
}

// PurgeArchiveFile – стереть навсегда вместе с содержимым.
func (s *Service) PurgeArchiveFile(ctx context.Context, p access.Principal, id string) error {
	return s.archiveAction(ctx, p, id, "archive.purge", access.CanPurgeArchiveFile,
		func(q *repository.Queries, row repository.ArchiveFile, _ string) (int64, error) {
			return q.PurgeArchiveFile(ctx, repository.PurgeArchiveFileParams{CompanyID: row.CompanyID, ID: row.ID})
		})
}
