package httpapi

import (
	"context"

	"io"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"docflow/internal/access"

	"docflow/internal/http/response"
	"docflow/internal/service"
)

// Документы, шаблоны компании и архив (docs/plans/phase-01c-documents.md).
// Компания нового документа, шаблона и файла – из токена; в адресе –
// только идентификатор записи (CLAUDE.md, п. 3.1).

func mountDocuments(r chi.Router, a *api) {
	r.Get("/documents", a.handleListDocuments)
	r.Put("/documents/{id}", a.handleSaveDocument)
	r.Delete("/documents/{id}", a.handleDeleteDocument)
	r.Post("/documents/{id}/restore", a.handleRestoreDocument)
	r.Post("/documents/{id}/purge", a.handlePurgeDocument)
	r.Put("/documents/{id}/grants/{userId}", a.handleGrant)
	r.Delete("/documents/{id}/grants/{userId}", a.handleRevoke)
	r.Put("/images", a.handlePutImage)

	r.Get("/templates", a.handleListTemplates)
	r.Put("/templates/{id}", a.handleSaveTemplate)
	r.Delete("/templates/{id}", a.handleDeleteTemplate)

	r.Get("/archive", a.handleListArchive)
	r.With(a.idempotent).Post("/archive", a.handleStartUpload)
	r.Put("/archive/{id}/parts/{part}", a.handlePutPart)
	r.Post("/archive/{id}/complete", a.handleCompleteUpload)
	r.Get("/archive/{id}/parts/{part}", a.handleGetPart)
	r.Delete("/archive/{id}", a.handleDeleteArchive)
	r.Post("/archive/{id}/restore", a.handleRestoreArchive)
	r.Post("/archive/{id}/purge", a.handlePurgeArchive)
}

// pageParams – курсор и размер страницы из адреса.
func pageParams(r *http.Request) (string, int) {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	return r.URL.Query().Get("cursor"), limit
}

func (a *api) handleListDocuments(w http.ResponseWriter, r *http.Request) {
	cursor, limit := pageParams(r)
	page, err := a.svc.ListDocuments(r.Context(), principalFrom(r), cursor, limit)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, page)
}

func (a *api) handleSaveDocument(w http.ResponseWriter, r *http.Request) {
	var in service.DocumentInput
	if !decode(w, r, &in, false) {
		return
	}
	doc, err := a.svc.SaveDocument(r.Context(), principalFrom(r), chi.URLParam(r, "id"), in)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, doc)
}

func (a *api) handleDeleteDocument(w http.ResponseWriter, r *http.Request) {
	version, ok := lockVersion(w, r)
	if !ok {
		return
	}
	if err := a.svc.DeleteDocument(r.Context(), principalFrom(r), chi.URLParam(r, "id"), version); err != nil {
		response.Error(w, r, err)
		return
	}
	response.NoContent(w)
}

func (a *api) handleRestoreDocument(w http.ResponseWriter, r *http.Request) {
	version, ok := lockVersion(w, r)
	if !ok {
		return
	}
	if err := a.svc.RestoreDocument(r.Context(), principalFrom(r), chi.URLParam(r, "id"), version); err != nil {
		response.Error(w, r, err)
		return
	}
	response.NoContent(w)
}

func (a *api) handlePurgeDocument(w http.ResponseWriter, r *http.Request) {
	version, ok := lockVersion(w, r)
	if !ok {
		return
	}
	if err := a.svc.PurgeDocument(r.Context(), principalFrom(r), chi.URLParam(r, "id"), version); err != nil {
		response.Error(w, r, err)
		return
	}
	response.NoContent(w)
}

type grantInput struct {
	Level string `json:"level"`
}

func (a *api) handleGrant(w http.ResponseWriter, r *http.Request) {
	var in grantInput
	if !decode(w, r, &in, false) {
		return
	}
	if in.Level == "" {
		response.BadRequest(w, r, "Нужен уровень доступа")
		return
	}
	a.setGrant(w, r, in.Level)
}

func (a *api) handleRevoke(w http.ResponseWriter, r *http.Request) {
	a.setGrant(w, r, "")
}

func (a *api) setGrant(w http.ResponseWriter, r *http.Request, level string) {
	doc, err := a.svc.SetDocumentGrant(r.Context(), principalFrom(r), chi.URLParam(r, "id"), chi.URLParam(r, "userId"), level)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, doc)
}

type imageInput struct {
	Data string `json:"data"`
}

func (a *api) handlePutImage(w http.ResponseWriter, r *http.Request) {
	var in imageInput
	if !decode(w, r, &in, false) {
		return
	}
	ref, err := a.svc.PutImage(r.Context(), principalFrom(r), in.Data)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, map[string]string{"ref": ref})
}

// ── Шаблоны ─────────────────────────────────────────────────────────────────

func (a *api) handleListTemplates(w http.ResponseWriter, r *http.Request) {
	list, err := a.svc.ListTemplates(r.Context(), principalFrom(r))
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, map[string]any{"items": list})
}

func (a *api) handleSaveTemplate(w http.ResponseWriter, r *http.Request) {
	var in service.TemplateInput
	if !decode(w, r, &in, false) {
		return
	}
	t, err := a.svc.SaveTemplate(r.Context(), principalFrom(r), chi.URLParam(r, "id"), in)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, t)
}

func (a *api) handleDeleteTemplate(w http.ResponseWriter, r *http.Request) {
	version, ok := lockVersion(w, r)
	if !ok {
		return
	}
	if err := a.svc.DeleteTemplate(r.Context(), principalFrom(r), chi.URLParam(r, "id"), version); err != nil {
		response.Error(w, r, err)
		return
	}
	response.NoContent(w)
}

// ── Архив ───────────────────────────────────────────────────────────────────

func (a *api) handleListArchive(w http.ResponseWriter, r *http.Request) {
	cursor, limit := pageParams(r)
	page, err := a.svc.ListArchive(r.Context(), principalFrom(r), cursor, limit)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, page)
}

func (a *api) handleStartUpload(w http.ResponseWriter, r *http.Request) {
	var in service.ArchiveUploadInput
	if !decode(w, r, &in, false) {
		return
	}
	up, err := a.svc.StartArchiveUpload(r.Context(), principalFrom(r), in)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusCreated, up)
}

func partParam(w http.ResponseWriter, r *http.Request) (int, bool) {
	n, err := strconv.Atoi(chi.URLParam(r, "part"))
	if err != nil || n < 0 {
		response.BadRequest(w, r, "Неверный номер части")
		return 0, false
	}
	return n, true
}

// handlePutPart – тело запроса – сама часть файла, не JSON; предел тела –
// общий (1 МБ), часть – до 768 КБ.
func (a *api) handlePutPart(w http.ResponseWriter, r *http.Request) {
	part, ok := partParam(w, r)
	if !ok {
		return
	}
	data, err := io.ReadAll(r.Body)
	if err != nil {
		bodyError(w, r, err)
		return
	}
	if err := a.svc.PutArchivePart(r.Context(), principalFrom(r), chi.URLParam(r, "id"), part, data); err != nil {
		response.Error(w, r, err)
		return
	}
	response.NoContent(w)
}

func (a *api) handleCompleteUpload(w http.ResponseWriter, r *http.Request) {
	f, err := a.svc.CompleteArchiveUpload(r.Context(), principalFrom(r), chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, f)
}

func (a *api) handleGetPart(w http.ResponseWriter, r *http.Request) {
	part, ok := partParam(w, r)
	if !ok {
		return
	}
	data, err := a.svc.ArchivePart(r.Context(), principalFrom(r), chi.URLParam(r, "id"), part)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Length", strconv.Itoa(len(data)))
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(data) //nolint:gosec // G705: двоичные данные, octet-stream и nosniff (noStore)
}

func (a *api) handleDeleteArchive(w http.ResponseWriter, r *http.Request) {
	a.archiveAction(w, r, a.svc.DeleteArchiveFile)
}

func (a *api) handleRestoreArchive(w http.ResponseWriter, r *http.Request) {
	a.archiveAction(w, r, a.svc.RestoreArchiveFile)
}

func (a *api) handlePurgeArchive(w http.ResponseWriter, r *http.Request) {
	a.archiveAction(w, r, a.svc.PurgeArchiveFile)
}

func (a *api) archiveAction(w http.ResponseWriter, r *http.Request, run func(ctx context.Context, p access.Principal, id string) error) {
	if err := run(r.Context(), principalFrom(r), chi.URLParam(r, "id")); err != nil {
		response.Error(w, r, err)
		return
	}
	response.NoContent(w)
}
