package service_test

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"slices"
	"testing"

	"docflow/internal/access"
	"docflow/internal/domain"
	"docflow/internal/service"
)

// Документы, шаблоны компании и архив в базе
// (docs/plans/phase-01c-documents.md). Изоляция компаний – первой: человек
// компании Б не читает, не правит и не узнаёт о документе компании А.

// sections – разделы работника: где создаёт и где смотрит сохранённые.
func (e *env) sections(userID string, create, view []string) {
	e.t.Helper()
	if _, err := e.db.Owner.Exec(e.ctx,
		`UPDATE users SET section_ids = coalesce($2, '{}'::text[]), view_section_ids = coalesce($3, '{}'::text[]) WHERE id = $1`, userID, create, view); err != nil {
		e.t.Fatal(err)
	}
}

// snapshot – снимок реквизитов, каким его шлёт сайт: с версией карточки,
// которую человек видел (у перенесённых компаний – 0).
func snapshot(companyID string) json.RawMessage {
	return json.RawMessage(`{"id":"` + companyID + `","name":"Компания","lockVersion":0}`)
}

func draft(title string) service.DocumentInput {
	return service.DocumentInput{
		TemplateID: "hr-hire-order", SectionID: "hr", Title: title, Status: "draft",
		Values: map[string]string{"employee": "emp-a"},
	}
}

func saved(companyID, title, number string) service.DocumentInput {
	in := draft(title)
	in.Status, in.Number, in.CompanySnapshot = "saved", number, snapshot(companyID)
	return in
}

func (e *env) save(p access.Principal, id string, in service.DocumentInput) service.Document {
	e.t.Helper()
	d, err := e.svc.SaveDocument(e.ctx, p, id, in)
	if err != nil {
		e.t.Fatalf("документ %s: %v", id, err)
	}
	return d
}

func (e *env) docs(p access.Principal) []string {
	e.t.Helper()
	page, err := e.svc.ListDocuments(e.ctx, p, "", 0)
	if err != nil {
		e.t.Fatal(err)
	}
	out := make([]string, 0, len(page.Items))
	for _, d := range page.Items {
		out = append(out, d.ID)
	}
	slices.Sort(out)
	return out
}

func wantDocs(t *testing.T, got []string, want ...string) {
	t.Helper()
	slices.Sort(want)
	if want == nil {
		want = []string{}
	}
	if !slices.Equal(got, want) {
		t.Fatalf("документы %v, ожидались %v", got, want)
	}
}

func TestDocumentsCompanyIsolation(t *testing.T) {
	e := seeded(t)
	dirA, dirB := e.in("dir-a", "c-a"), e.in("dir-b", "c-b")
	doc := e.save(dirA, "d-isolation-1", saved("c-a", "Приказ А", "1"))
	if doc.CompanyID != "c-a" || doc.AuthorID != "dir-a" || doc.LockVersion != 1 {
		t.Fatalf("документ %+v", doc)
	}

	// Список, поштучные действия и правка – как будто документа нет.
	wantDocs(t, e.docs(dirB))
	in := saved("c-b", "Подмена", "2")
	in.LockVersion = 1
	_, err := e.svc.SaveDocument(e.ctx, dirB, "d-isolation-1", in)
	wantErr(t, err, domain.ErrNotFound)
	wantErr(t, e.svc.DeleteDocument(e.ctx, dirB, "d-isolation-1", 1), domain.ErrNotFound)
	_, err = e.svc.SetDocumentGrant(e.ctx, dirB, "d-isolation-1", "emp-b", "view")
	wantErr(t, err, domain.ErrNotFound)
	// Создать документ с тем же идентификатором в своей компании нельзя, и
	// ответ тот же «не найдено» – о чужом документе не узнать.
	_, err = e.svc.SaveDocument(e.ctx, dirB, "d-isolation-1", saved("c-b", "Тот же id", "3"))
	wantErr(t, err, domain.ErrNotFound)

	// Снимок чужой компании в своём документе не принимается.
	_, err = e.svc.SaveDocument(e.ctx, dirB, "d-isolation-2", saved("c-a", "Чужой снимок", "4"))
	wantValidation(t, err, "snapshot")

	// Работник двух компаний видит документы обеих, администратор – все.
	e.sections("emp-ab", nil, []string{"hr"})
	wantDocs(t, e.docs(e.in("emp-ab", "c-b")), "d-isolation-1")
	wantDocs(t, e.docs(e.as("admin")), "d-isolation-1")
}

func TestDocumentVisibilityForEmployee(t *testing.T) {
	e := seeded(t)
	e.sections("emp-a", []string{"hr"}, nil)
	empA, dirA := e.in("emp-a", "c-a"), e.in("dir-a", "c-a")

	e.save(empA, "d-own-draft", draft("Свой черновик"))
	e.save(dirA, "d-dir-draft", draft("Черновик директора"))
	e.save(dirA, "d-dir-saved", saved("c-a", "Приказ директора", "10"))
	e.save(dirA, "d-dir-granted", saved("c-a", "Выданный", "11"))
	if _, err := e.svc.SetDocumentGrant(e.ctx, dirA, "d-dir-granted", "emp-a", "view"); err != nil {
		t.Fatal(err)
	}

	// Свой и выданный; чужой черновик и сохранённый без раздела – нет.
	wantDocs(t, e.docs(empA), "d-dir-granted", "d-own-draft")
	// Открыли просмотр раздела – видны сохранённые, но не чужой черновик.
	e.sections("emp-a", []string{"hr"}, []string{"hr"})
	empA = e.in("emp-a", "c-a")
	wantDocs(t, e.docs(empA), "d-dir-granted", "d-dir-saved", "d-own-draft")
	// Директор видит всё в своей компании.
	wantDocs(t, e.docs(dirA), "d-dir-draft", "d-dir-granted", "d-dir-saved", "d-own-draft")

	// Без раздела работник документ не создаёт.
	_, err := e.svc.SaveDocument(e.ctx, e.in("emp-b", "c-b"), "d-no-section", draft("Без раздела"))
	wantErr(t, err, domain.ErrForbidden)
}

func TestDocumentEditRules(t *testing.T) {
	e := seeded(t)
	e.sections("emp-a", []string{"hr"}, []string{"hr"})
	empA, dirA := e.in("emp-a", "c-a"), e.in("dir-a", "c-a")

	e.save(empA, "d-edit", draft("Черновик"))
	// Повтор создания с той же версией 0 – та же запись, а не конфликт.
	d := e.save(empA, "d-edit", draft("Черновик"))
	in := saved("c-a", "Приказ", "5")
	in.LockVersion = d.LockVersion
	d = e.save(empA, "d-edit", in)
	if d.Status != "saved" {
		t.Fatalf("состояние %s", d.Status)
	}

	// Сохранённый автор-работник уже не правит; директор – правит.
	in.LockVersion, in.Title = d.LockVersion, "Приказ 2"
	_, err := e.svc.SaveDocument(e.ctx, empA, "d-edit", in)
	wantErr(t, err, domain.ErrForbidden)
	// Выпущенный документ не становится черновиком.
	back := draft("Назад")
	back.LockVersion = d.LockVersion
	_, err = e.svc.SaveDocument(e.ctx, dirA, "d-edit", back)
	wantValidation(t, err, "status")
	d = e.save(dirA, "d-edit", in)
	if d.Title != "Приказ 2" || d.AuthorID != "emp-a" {
		t.Fatalf("правка директора: %+v", d)
	}

	// Старая версия – конфликт.
	in.LockVersion = d.LockVersion - 1
	_, err = e.svc.SaveDocument(e.ctx, dirA, "d-edit", in)
	wantErr(t, err, domain.ErrConflict)

	// Выдали правку – работник правит сохранённый.
	if _, err = e.svc.SetDocumentGrant(e.ctx, dirA, "d-edit", "emp-a", "edit"); err != nil {
		t.Fatal(err)
	}
	in.LockVersion, in.Title = d.LockVersion, "Приказ 3"
	e.save(empA, "d-edit", in)

	// Директору доступ не выдаётся: он и так видит всё.
	_, err = e.svc.SetDocumentGrant(e.ctx, dirA, "d-edit", "dir-a", "view")
	wantValidation(t, err, "userId")
	// Человеку другой компании – «не найдено».
	_, err = e.svc.SetDocumentGrant(e.ctx, dirA, "d-edit", "emp-b", "view")
	wantErr(t, err, domain.ErrNotFound)
	// Работник выдавать доступ не может.
	_, err = e.svc.SetDocumentGrant(e.ctx, empA, "d-edit", "emp-ab", "view")
	wantErr(t, err, domain.ErrForbidden)
}

func TestDocumentNumberUniqueInCompany(t *testing.T) {
	e := seeded(t)
	dirA, dirB := e.in("dir-a", "c-a"), e.in("dir-b", "c-b")

	e.save(dirA, "d-num-1", saved("c-a", "Первый", "№ 12-К/2026"))
	// Тот же номер в другом написании – занят.
	_, err := e.svc.SaveDocument(e.ctx, dirA, "d-num-2", saved("c-a", "Второй", "12-к/2026"))
	wantValidation(t, err, "number")
	// Черновик номер не занимает и о чужом номере не спотыкается.
	d := draft("Черновик с номером")
	d.Number = "12-К/2026"
	e.save(dirA, "d-num-3", d)
	// В другой компании тот же номер свободен.
	e.save(dirB, "d-num-4", saved("c-b", "В Б", "12-К/2026"))

	// Удалённый номер освобождает; вернуть его, когда номер занят, нельзя.
	first := e.save(dirA, "d-num-1", func() service.DocumentInput {
		in := saved("c-a", "Первый", "№ 12-К/2026")
		in.LockVersion = 1
		return in
	}())
	if err = e.svc.DeleteDocument(e.ctx, dirA, "d-num-1", first.LockVersion); err != nil {
		t.Fatal(err)
	}
	e.save(dirA, "d-num-2", saved("c-a", "Второй", "12-к/2026"))
	wantValidation(t, e.svc.RestoreDocument(e.ctx, dirA, "d-num-1", first.LockVersion+1), "number")
}

func TestDocumentTrash(t *testing.T) {
	e := seeded(t)
	e.sections("emp-a", []string{"hr"}, nil)
	empA, dirA := e.in("emp-a", "c-a"), e.in("dir-a", "c-a")
	d := e.save(empA, "d-trash", draft("В корзину"))

	// Работник не удаляет; директор удаляет – у работника документ пропал.
	wantErr(t, e.svc.DeleteDocument(e.ctx, empA, "d-trash", d.LockVersion), domain.ErrForbidden)
	wantErr(t, e.svc.DeleteDocument(e.ctx, dirA, "d-trash", d.LockVersion+5), domain.ErrConflict)
	if err := e.svc.DeleteDocument(e.ctx, dirA, "d-trash", d.LockVersion); err != nil {
		t.Fatal(err)
	}
	wantDocs(t, e.docs(empA))
	// Директор видит его в корзине; стереть живой нельзя – только из корзины.
	wantDocs(t, e.docs(dirA), "d-trash")
	if err := e.svc.RestoreDocument(e.ctx, dirA, "d-trash", d.LockVersion+1); err != nil {
		t.Fatal(err)
	}
	wantErr(t, e.svc.PurgeDocument(e.ctx, dirA, "d-trash", d.LockVersion+2), domain.ErrForbidden)
	if err := e.svc.DeleteDocument(e.ctx, dirA, "d-trash", d.LockVersion+2); err != nil {
		t.Fatal(err)
	}
	if err := e.svc.PurgeDocument(e.ctx, dirA, "d-trash", d.LockVersion+3); err != nil {
		t.Fatal(err)
	}
	wantDocs(t, e.docs(dirA))
	wantErr(t, e.svc.RestoreDocument(e.ctx, dirA, "d-trash", d.LockVersion+4), domain.ErrNotFound)
}

func TestDocumentImagesAndPages(t *testing.T) {
	e := seeded(t)
	dirA, dirB := e.in("dir-a", "c-a"), e.in("dir-b", "c-b")

	_, err := e.svc.PutImage(e.ctx, dirA, "data:image/svg+xml;base64,PHN2Zy8+")
	wantValidation(t, err, "data")
	ref, err := e.svc.PutImage(e.ctx, dirA, "data:image/png;base64,iVBORw0KGgo=")
	if err != nil {
		t.Fatal(err)
	}
	withLogo := func(company string) service.DocumentInput {
		in := saved(company, "С логотипом", "")
		in.CompanySnapshot = json.RawMessage(`{"id":"` + company + `","lockVersion":0,"logo":"` + ref + `"}`)
		return in
	}
	// Картинка компании А в документе компании Б не годится.
	_, err = e.svc.SaveDocument(e.ctx, dirB, "d-logo-b", withLogo("c-b"))
	wantValidation(t, err, "snapshot")

	for i := range 5 {
		e.save(dirA, "d-page-"+string(rune('a'+i)), withLogo("c-a"))
	}
	page, err := e.svc.ListDocuments(e.ctx, dirA, "", 2)
	if err != nil {
		t.Fatal(err)
	}
	if len(page.Items) != 2 || page.Next == "" || page.Images[ref] == "" {
		t.Fatalf("первая страница: %d, курсор %q, картинки %d", len(page.Items), page.Next, len(page.Images))
	}
	seen := map[string]bool{}
	for cursor := ""; ; {
		p, err := e.svc.ListDocuments(e.ctx, dirA, cursor, 2)
		if err != nil {
			t.Fatal(err)
		}
		for _, d := range p.Items {
			if seen[d.ID] {
				t.Fatalf("%s дважды", d.ID)
			}
			seen[d.ID] = true
		}
		if p.Next == "" {
			break
		}
		cursor = p.Next
	}
	if len(seen) != 5 {
		t.Fatalf("по страницам %d документов", len(seen))
	}
}

// snapshotOf – снимок реквизитов документа id из списка, как его видит p.
func (e *env) snapshotOf(p access.Principal, id string) map[string]any {
	e.t.Helper()
	page, err := e.svc.ListDocuments(e.ctx, p, "", 0)
	if err != nil {
		e.t.Fatal(err)
	}
	for _, d := range page.Items {
		if d.ID != id {
			continue
		}
		var c map[string]any
		if err := json.Unmarshal(d.CompanySnapshot, &c); err != nil {
			e.t.Fatalf("снимок %s: %v", id, err)
		}
		return c
	}
	e.t.Fatalf("документа %s нет", id)
	return nil
}

// Снимок реквизитов выпущенного документа собирает сервер из карточки
// компании (docs/plans/phase-01e-company-fresh.md): реквизитам из браузера
// он не верит, а документ, открытый при прежней карточке, не выпускает.
func TestCompanySnapshotFromDatabase(t *testing.T) {
	e := seeded(t)
	dirA := e.in("dir-a", "c-a")

	forged := saved("c-a", "Приказ", "1")
	forged.CompanySnapshot = json.RawMessage(`{"id":"c-a","lockVersion":0,"name":"Подделка","directorName":"Не тот","bin":"000000000000"}`)
	e.save(dirA, "d-snap-1", forged)
	got := e.snapshotOf(dirA, "d-snap-1")
	if got["name"] != "ТОО «А»" || got["directorName"] != "Директор А" || got["bin"] != bin(t, "10014000123") {
		t.Fatalf("снимок не из карточки: %v", got)
	}

	// Директора сменили – карточка стала версии 1.
	if _, err := e.svc.UpdateCompany(e.ctx, dirA, "c-a", service.Company{
		"name": "ТОО «А»", "bin": bin(t, "10014000123"), "directorName": "Новый директор", "lockVersion": float64(0),
	}); err != nil {
		t.Fatal(err)
	}

	// Документ, открытый при прежней карточке, не выпускается; без версии
	// карточки – тоже. Отказ ничего не записал.
	_, err := e.svc.SaveDocument(e.ctx, dirA, "d-snap-2", saved("c-a", "Приказ", "2"))
	if !errors.Is(err, domain.ErrCompanyChanged) {
		t.Fatalf("устаревшая карточка: %v", err)
	}
	unversioned := saved("c-a", "Приказ", "2")
	unversioned.CompanySnapshot = json.RawMessage(`{"id":"c-a"}`)
	_, err = e.svc.SaveDocument(e.ctx, dirA, "d-snap-2", unversioned)
	if !errors.Is(err, domain.ErrCompanyChanged) {
		t.Fatalf("карточка без версии: %v", err)
	}
	wantDocs(t, e.docs(dirA), "d-snap-1")

	// Черновик снимка не держит: карточку не сверяет.
	e.save(dirA, "d-snap-2", draft("Приказ"))

	// С новой карточкой – новый директор; выпущенный раньше – с прежним.
	fresh := saved("c-a", "Приказ", "2")
	fresh.CompanySnapshot = json.RawMessage(`{"id":"c-a","lockVersion":1}`)
	fresh.LockVersion = 1
	e.save(dirA, "d-snap-2", fresh)
	if got := e.snapshotOf(dirA, "d-snap-2"); got["directorName"] != "Новый директор" {
		t.Fatalf("снимок после правки карточки: %v", got)
	}
	if got := e.snapshotOf(dirA, "d-snap-1"); got["directorName"] != "Директор А" {
		t.Fatalf("выпущенный документ сменил директора: %v", got)
	}

	// Правка уже выпущенного документа сверяет карточку так же.
	stale := saved("c-a", "Приказ", "1")
	stale.LockVersion = 1
	_, err = e.svc.SaveDocument(e.ctx, dirA, "d-snap-1", stale)
	if !errors.Is(err, domain.ErrCompanyChanged) {
		t.Fatalf("правка по устаревшей карточке: %v", err)
	}
}

func TestCustomTemplates(t *testing.T) {
	e := seeded(t)
	e.sections("emp-a", []string{"hr"}, nil)
	dirA, dirB, empA := e.in("dir-a", "c-a"), e.in("dir-b", "c-b"), e.in("emp-a", "c-a")
	tpl := func(section string, version int32) service.TemplateInput {
		raw := map[string]json.RawMessage{}
		_ = json.Unmarshal([]byte(`{"title":"Мой приказ","sectionId":"`+section+`","langs":["ru"],"fields":[],"body":{"ru":"Текст"},"companyId":"c-b","authorId":"x"}`), &raw)
		return service.TemplateInput{Template: raw, LockVersion: version}
	}

	got, err := e.svc.SaveTemplate(e.ctx, dirA, "custom-1", tpl("hr", 0))
	if err != nil {
		t.Fatal(err)
	}
	// Компания и автор – из токена, а не из присланного.
	if got["companyId"] != "c-a" || got["authorId"] != "dir-a" {
		t.Fatalf("шаблон %v", got)
	}
	list, _ := e.svc.ListTemplates(e.ctx, dirB)
	if len(list) != 0 {
		t.Fatalf("компания Б видит шаблоны А: %v", list)
	}
	_, err = e.svc.SaveTemplate(e.ctx, dirB, "custom-1", tpl("hr", 1))
	wantErr(t, err, domain.ErrNotFound)
	// Работник без права на шаблоны не создаёт и чужой не правит.
	_, err = e.svc.SaveTemplate(e.ctx, empA, "custom-2", tpl("hr", 0))
	wantErr(t, err, domain.ErrForbidden)
	_, err = e.svc.SaveTemplate(e.ctx, empA, "custom-1", tpl("hr", 1))
	wantErr(t, err, domain.ErrForbidden)
	// Работник видит шаблон своего раздела, но не другого.
	if list, _ = e.svc.ListTemplates(e.ctx, empA); len(list) != 1 {
		t.Fatalf("работник видит %d шаблонов", len(list))
	}
	if _, err = e.svc.SaveTemplate(e.ctx, dirA, "custom-3", tpl("legal", 0)); err != nil {
		t.Fatal(err)
	}
	if list, _ = e.svc.ListTemplates(e.ctx, empA); len(list) != 1 {
		t.Fatalf("работник видит шаблон чужого раздела: %d", len(list))
	}

	wantErr(t, e.svc.DeleteTemplate(e.ctx, dirA, "custom-1", 7), domain.ErrConflict)
	if err = e.svc.DeleteTemplate(e.ctx, dirA, "custom-1", 1); err != nil {
		t.Fatal(err)
	}
	if list, _ = e.svc.ListTemplates(e.ctx, dirA); len(list) != 1 {
		t.Fatalf("после удаления %d шаблонов", len(list))
	}
}

// pdf – содержимое «файла PDF» нужного размера.
func pdf(size int) []byte {
	b := bytes.Repeat([]byte{'x'}, size)
	copy(b, "%PDF-1.7\n")
	return b
}

func (e *env) upload(p access.Principal, data []byte, title string) (service.ArchiveFile, error) {
	e.t.Helper()
	sum := sha256.Sum256(data)
	up, err := e.svc.StartArchiveUpload(e.ctx, p, service.ArchiveUploadInput{
		Title: title, DocumentDate: "2026-01-15", SectionID: "hr", FileName: "scan.pdf",
		Size: int64(len(data)), SHA256: hex.EncodeToString(sum[:]),
	})
	if err != nil {
		return service.ArchiveFile{}, err
	}
	for i := range up.Parts {
		end := min((i+1)*up.PartSize, len(data))
		if err := e.svc.PutArchivePart(e.ctx, p, up.ID, i, data[i*up.PartSize:end]); err != nil {
			return service.ArchiveFile{}, err
		}
	}
	return e.svc.CompleteArchiveUpload(e.ctx, p, up.ID)
}

// Архив – во всех компаниях человека (решение человека 16.10,
// docs/plans/phase-01d-archive-login.md): кто работает в А и Б, видит и
// скачивает файлы и документы обеих, из какой бы ни работал; работник
// только А файлов и документов Б не видит.
func TestArchiveAcrossOwnCompanies(t *testing.T) {
	e := seeded(t)
	dirA, dirB := e.in("dir-a", "c-a"), e.in("dir-b", "c-b")
	fileA, err := e.upload(dirA, pdf(500), "Скан А")
	if err != nil {
		t.Fatal(err)
	}
	fileB, err := e.upload(dirB, pdf(600), "Скан Б")
	if err != nil {
		t.Fatal(err)
	}
	e.save(dirB, "d-saved-b", saved("c-b", "Приказ Б", "1"))

	e.sections("emp-ab", []string{"hr"}, []string{"hr"})
	e.sections("emp-a", []string{"hr"}, []string{"hr"})
	files := func(p access.Principal) []string {
		t.Helper()
		page, listErr := e.svc.ListArchive(e.ctx, p, "", 0)
		if listErr != nil {
			t.Fatal(listErr)
		}
		out := make([]string, 0, len(page.Items))
		for _, f := range page.Items {
			out = append(out, f.Title)
		}
		slices.Sort(out)
		return out
	}

	for _, company := range []string{"c-a", "c-b"} {
		ab := e.in("emp-ab", company)
		if got := files(ab); !slices.Equal(got, []string{"Скан А", "Скан Б"}) {
			t.Fatalf("emp-ab в %s видит %v", company, got)
		}
		if _, partErr := e.svc.ArchivePart(e.ctx, ab, fileB.ID, 0); partErr != nil {
			t.Fatalf("emp-ab в %s не скачал файл Б: %v", company, partErr)
		}
		if _, partErr := e.svc.ArchivePart(e.ctx, ab, fileA.ID, 0); partErr != nil {
			t.Fatalf("emp-ab в %s не скачал файл А: %v", company, partErr)
		}
		if !slices.Contains(e.docs(ab), "d-saved-b") {
			t.Fatalf("emp-ab в %s не видит сохранённый документ Б", company)
		}
	}

	empA := e.in("emp-a", "c-a")
	if got := files(empA); !slices.Equal(got, []string{"Скан А"}) {
		t.Fatalf("emp-a видит %v", got)
	}
	_, err = e.svc.ArchivePart(e.ctx, empA, fileB.ID, 0)
	wantErr(t, err, domain.ErrNotFound)
	if slices.Contains(e.docs(empA), "d-saved-b") {
		t.Fatal("emp-a видит документ Б")
	}
}

func TestArchiveUploadInParts(t *testing.T) {
	e := seeded(t)
	dirA, dirB := e.in("dir-a", "c-a"), e.in("dir-b", "c-b")
	data := pdf(2*service.ArchivePartSize + 1000)

	f, err := e.upload(dirA, data, "Старый приказ")
	if err != nil {
		t.Fatal(err)
	}
	if f.Parts != 3 || f.Size != int64(len(data)) {
		t.Fatalf("файл %+v", f)
	}
	// Тот же файл второй раз – дубль.
	_, err = e.upload(dirA, data, "Ещё раз")
	wantErr(t, err, domain.ErrConflict)

	// Собранный по частям файл совпадает с загруженным.
	var got []byte
	for i := range f.Parts {
		part, partErr := e.svc.ArchivePart(e.ctx, dirA, f.ID, i)
		if partErr != nil {
			t.Fatal(partErr)
		}
		got = append(got, part...)
	}
	if !bytes.Equal(got, data) {
		t.Fatal("скачанный файл не совпадает")
	}

	// Компания Б не видит, не скачивает и не удаляет.
	page, _ := e.svc.ListArchive(e.ctx, dirB, "", 0)
	if len(page.Items) != 0 {
		t.Fatalf("компания Б видит архив А: %d", len(page.Items))
	}
	_, err = e.svc.ArchivePart(e.ctx, dirB, f.ID, 0)
	wantErr(t, err, domain.ErrNotFound)
	wantErr(t, e.svc.DeleteArchiveFile(e.ctx, dirB, f.ID), domain.ErrNotFound)

	// Не PDF и неверная сумма – отказ, файла нет.
	notPDF := bytes.Repeat([]byte{'y'}, 1000)
	_, err = e.upload(dirA, notPDF, "Не PDF")
	wantValidation(t, err, "file")
	sum := sha256.Sum256([]byte("другое"))
	up, err := e.svc.StartArchiveUpload(e.ctx, dirA, service.ArchiveUploadInput{
		Title: "Подмена", DocumentDate: "2026-01-15", SectionID: "hr", FileName: "x.pdf",
		Size: 100, SHA256: hex.EncodeToString(sum[:]),
	})
	if err != nil {
		t.Fatal(err)
	}
	wantValidation(t, e.svc.PutArchivePart(e.ctx, dirA, up.ID, 0, pdf(99)), "part")
	if err = e.svc.PutArchivePart(e.ctx, dirA, up.ID, 0, pdf(100)); err != nil {
		t.Fatal(err)
	}
	_, err = e.svc.CompleteArchiveUpload(e.ctx, dirA, up.ID)
	wantValidation(t, err, "file")
	if page, _ = e.svc.ListArchive(e.ctx, dirA, "", 0); len(page.Items) != 1 {
		t.Fatalf("в архиве %d файлов", len(page.Items))
	}

	// Корзина: удалить, вернуть, удалить, стереть.
	for _, step := range []func() error{
		func() error { return e.svc.DeleteArchiveFile(e.ctx, dirA, f.ID) },
		func() error { return e.svc.RestoreArchiveFile(e.ctx, dirA, f.ID) },
		func() error { return e.svc.DeleteArchiveFile(e.ctx, dirA, f.ID) },
		func() error { return e.svc.PurgeArchiveFile(e.ctx, dirA, f.ID) },
	} {
		if stepErr := step(); stepErr != nil {
			t.Fatal(stepErr)
		}
	}
	_, err = e.svc.ArchivePart(e.ctx, dirA, f.ID, 0)
	wantErr(t, err, domain.ErrNotFound)
}
