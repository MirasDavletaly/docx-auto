package access

import "slices"

// Правила для документов, шаблонов компании и архива
// (docs/plans/phase-01c-documents.md). Повторяют web/src/access/policy.ts
// слово в слово; списки фильтрует SQL по тем же правилам (queries/*.sql),
// здесь – поштучная проверка (CLAUDE.md, п. 3.2: дважды).

// Doc – что о документе нужно правилам.
type Doc struct {
	CompanyID string
	AuthorID  string
	// Status – draft или saved.
	Status    string
	SectionID string
	Deleted   bool
	// Grant – доступ, выданный тому, кто спрашивает: "", view или edit.
	Grant string
}

// CanUseSection – разрешён ли раздел каталога. Директору и администратору –
// все; работнику – выданные, пустой список – ни одного.
func CanUseSection(p Principal, sectionID string) bool {
	if p.Blocked {
		return false
	}
	if p.RoleID != "employee" {
		return true
	}
	return slices.Contains(p.SectionIDs, sectionID)
}

// CanViewDocument – видит ли документ. Сначала компания: ни раздел, ни
// выданный доступ чужую компанию не открывают. Удалённый – только тот, кто
// может вернуть. Дальше: все документы компании (право), свои, выданные и
// сохранённые документы разделов, открытых для просмотра. Чужой черновик –
// только автору, директору и администратору.
func CanViewDocument(p Principal, d Doc) bool {
	if p.Blocked || !p.HasCompany(d.CompanyID) {
		return false
	}
	if d.Deleted && !p.Can("documents.restore") {
		return false
	}
	if p.Can("documents.viewAll") || d.AuthorID == p.UserID || d.Grant != "" {
		return true
	}
	return d.Status == "saved" && d.SectionID != "" && slices.Contains(p.ViewSectionIDs, d.SectionID)
}

// CanCreateDocument – новый документ в разделе текущей компании.
func CanCreateDocument(p Principal, sectionID string) bool {
	return p.CompanyID != "" && p.HasCompany(p.CompanyID) && CanUseSection(p, sectionID)
}

// CanEditDocument – черновик правит автор; сохранённый – кто правит любые
// документы компании, и тот, кому выдали правку.
func CanEditDocument(p Principal, d Doc) bool {
	if !CanViewDocument(p, d) || d.Deleted {
		return false
	}
	if p.Can("documents.editAny") || d.Grant == "edit" {
		return true
	}
	return d.AuthorID == p.UserID && d.Status == "draft"
}

// CanDeleteDocument – удаление пометкой.
func CanDeleteDocument(p Principal, d Doc) bool {
	return !d.Deleted && CanViewDocument(p, d) && p.Can("documents.delete")
}

// CanRestoreDocument – вернуть из корзины.
func CanRestoreDocument(p Principal, d Doc) bool {
	return d.Deleted && CanViewDocument(p, d) && p.Can("documents.restore")
}

// CanPurgeDocument – стереть навсегда, только из корзины.
func CanPurgeDocument(p Principal, d Doc) bool {
	return d.Deleted && CanViewDocument(p, d) && p.Can("documents.purge")
}

// CanGrantDocument – выдавать доступ к документу.
func CanGrantDocument(p Principal, d Doc) bool {
	return !d.Deleted && CanViewDocument(p, d) && p.Can("documents.grant")
}

// GrantReceiver – кому выдают доступ.
type GrantReceiver struct {
	ID string
	// ViewsAll – его роль и так видит все документы компании.
	ViewsAll bool
	Blocked  bool
	// InCompany – работает в компании документа.
	InCompany bool
}

// CanReceiveGrant – доступ выдаётся только человеку той же компании, не
// себе и не тому, кто и так видит все документы.
func CanReceiveGrant(p Principal, r GrantReceiver) bool {
	return !r.Blocked && r.ID != p.UserID && r.InCompany && !r.ViewsAll
}

// ListFilter – параметры фильтра списков в SQL для этого человека.
type ListFilter struct {
	// CompanyIDs – nil: все видимые компании (администратор платформы).
	CompanyIDs   []string
	WithDeleted  bool
	ViewAll      bool
	UserID       string
	ViewSections []string
}

// DocumentFilter – фильтр списка документов и архива: те же правила, что
// CanViewDocument, в виде параметров запроса.
func DocumentFilter(p Principal) (ListFilter, bool) {
	if p.Blocked {
		return ListFilter{}, false
	}
	f := ListFilter{
		WithDeleted:  p.Can("documents.restore"),
		ViewAll:      p.Can("documents.viewAll"),
		UserID:       p.UserID,
		ViewSections: p.ViewSectionIDs,
	}
	if f.ViewSections == nil {
		f.ViewSections = []string{}
	}
	if !p.Platform {
		if len(p.CompanyIDs) == 0 {
			return ListFilter{}, false
		}
		f.CompanyIDs = p.CompanyIDs
	}
	return f, true
}

// ── Шаблоны из конструктора ─────────────────────────────────────────────────

// Tpl – что о шаблоне нужно правилам.
type Tpl struct {
	CompanyID string
	AuthorID  string
	SectionID string
	Deleted   bool
}

// CanSeeTemplate – шаблон виден только в своей компании (той, где человек
// работает сейчас) и в разрешённом разделе.
func CanSeeTemplate(p Principal, t Tpl) bool {
	if t.Deleted || p.CompanyID == "" || t.CompanyID != p.CompanyID {
		return false
	}
	return p.HasCompany(t.CompanyID) && CanUseSection(p, t.SectionID)
}

// CanCreateTemplate – директор и администратор по роли, работник – если
// право выдали, и только в своих разделах.
func CanCreateTemplate(p Principal, sectionID string) bool {
	return p.CompanyID != "" && p.HasCompany(p.CompanyID) && p.Can("templates.create") && CanUseSection(p, sectionID)
}

// CanEditTemplate – автор, директор и администратор своей компании.
func CanEditTemplate(p Principal, t Tpl) bool {
	if !CanSeeTemplate(p, t) || !p.Can("templates.create") {
		return false
	}
	return t.AuthorID == p.UserID || p.Can("documents.editAny")
}

// ── Архив ───────────────────────────────────────────────────────────────────

// File – что о файле архива нужно правилам.
type File struct {
	CompanyID  string
	UploadedBy string
	SectionID  string
	Deleted    bool
}

// CanViewArchiveFile – как документ: своя компания; все файлы – по праву;
// свои и файлы разделов, открытых для просмотра.
func CanViewArchiveFile(p Principal, f File) bool {
	if p.Blocked || !p.HasCompany(f.CompanyID) {
		return false
	}
	if f.Deleted && !p.Can("documents.restore") {
		return false
	}
	if p.Can("documents.viewAll") || f.UploadedBy == p.UserID {
		return true
	}
	return slices.Contains(p.ViewSectionIDs, f.SectionID)
}

// CanUploadArchive – в раздел, где человек работает, текущей компании.
func CanUploadArchive(p Principal, sectionID string) bool {
	return p.CompanyID != "" && p.HasCompany(p.CompanyID) && CanUseSection(p, sectionID)
}

// CanDeleteArchiveFile – пометкой, как документ.
func CanDeleteArchiveFile(p Principal, f File) bool {
	return !f.Deleted && CanViewArchiveFile(p, f) && p.Can("documents.delete")
}

// CanRestoreArchiveFile – вернуть из корзины.
func CanRestoreArchiveFile(p Principal, f File) bool {
	return f.Deleted && CanViewArchiveFile(p, f) && p.Can("documents.restore")
}

// CanPurgeArchiveFile – стереть навсегда, только из корзины.
func CanPurgeArchiveFile(p Principal, f File) bool {
	return f.Deleted && CanViewArchiveFile(p, f) && p.Can("documents.purge")
}
