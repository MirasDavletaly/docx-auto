package service_test

import (
	"slices"
	"strings"
	"testing"

	"docflow/internal/access"
	"docflow/internal/domain"
	"docflow/internal/service"
)

// Персонал компании – её пользователи (docs/plans/phase-01b-personnel.md):
// имя и падежи – на человека, должность и подразделение – в каждой компании.

// in – человек, выбравший компанию.
func (e *env) in(login, companyID string) access.Principal {
	e.t.Helper()
	s, err := e.svc.SelectCompany(e.ctx, e.as(login), companyID)
	if err != nil {
		e.t.Fatalf("выбор компании %s для %s: %v", companyID, login, err)
	}
	p, err := e.svc.Authenticate(e.ctx, s.AccessToken)
	if err != nil {
		e.t.Fatal(err)
	}
	return p
}

func (e *env) personnel(p access.Principal) []service.Person {
	e.t.Helper()
	list, err := e.svc.ListPersonnel(e.ctx, p)
	if err != nil {
		e.t.Fatal(err)
	}
	return list
}

// cards – «человек@компания» по списку.
func cards(list []service.Person) []string {
	out := make([]string, 0, len(list))
	for _, c := range list {
		out = append(out, c.ID+"@"+c.CompanyID)
	}
	slices.Sort(out)
	return out
}

func (e *env) card(p access.Principal, id string) service.Person {
	e.t.Helper()
	for _, c := range e.personnel(p) {
		if c.ID == id && c.CompanyID == p.CompanyID {
			return c
		}
	}
	e.t.Fatalf("нет %s в персонале %s", id, p.CompanyID)
	return service.Person{}
}

func edit(c service.Person, change func(*service.PersonCard)) service.PersonInput {
	in := service.PersonInput{PersonCard: c.PersonCard, LockVersion: c.LockVersion}
	change(&in.PersonCard)
	return in
}

func TestPersonnelIsTheCompanyUsers(t *testing.T) {
	e := seeded(t)

	want := []string{"dir-a@c-a", "emp-a@c-a", "emp-ab@c-a"}
	if got := cards(e.personnel(e.as("dir-a"))); !slices.Equal(got, want) {
		t.Fatalf("персонал A у директора: %v", got)
	}
	// Работнику список нужен для выбора людей в документах.
	if got := cards(e.personnel(e.as("emp-a"))); !slices.Equal(got, want) {
		t.Fatalf("персонал A у работника: %v", got)
	}
	// Человек двух компаний видит персонал только выбранной.
	if got := cards(e.personnel(e.in("emp-ab", "c-b"))); !slices.Equal(got, []string{"dir-b@c-b", "emp-ab@c-b", "emp-b@c-b"}) {
		t.Fatalf("персонал B: %v", got)
	}
	// Администратор платформы – все компании; сам он не в персонале.
	all := cards(e.personnel(e.as("admin")))
	if len(all) != 6 || slices.Contains(all, "u-admin@") {
		t.Fatalf("персонал у администратора: %v", all)
	}
	// Имя карточки – имя учётной записи; падеж без заполнения – как имя.
	c := e.card(e.as("dir-a"), "emp-a")
	if c.FullName != "Имя emp-a" || c.FullNameGenitive != "Имя emp-a" {
		t.Fatalf("карточка: %+v", c)
	}
}

func TestPersonnelEditPerCompany(t *testing.T) {
	e := seeded(t)
	dirA, dirB := e.as("dir-a"), e.as("dir-b")

	got, err := e.svc.UpdatePerson(e.ctx, dirA, "emp-ab", edit(e.card(dirA, "emp-ab"), func(c *service.PersonCard) {
		c.FullNameGenitive = "Имени emp-ab"
		c.FullNameKk = "Есім emp-ab"
		c.Position, c.Unit = "Инженер", "Проектный отдел"
	}))
	if err != nil {
		t.Fatal(err)
	}
	if got.Position != "Инженер" || got.FullNameGenitive != "Имени emp-ab" || got.CompanyID != "c-a" {
		t.Fatalf("после правки: %+v", got)
	}
	if _, err = e.svc.UpdatePerson(e.ctx, dirB, "emp-ab", edit(e.card(dirB, "emp-ab"), func(c *service.PersonCard) {
		c.Position = "Бухгалтер"
	})); err != nil {
		t.Fatal(err)
	}

	// Должность своя в каждой компании, имя и падеж – общие.
	inA, inB := e.card(dirA, "emp-ab"), e.card(dirB, "emp-ab")
	if inA.Position != "Инженер" || inA.Unit != "Проектный отдел" || inB.Position != "Бухгалтер" || inB.Unit != "" {
		t.Fatalf("должности: A %+v, B %+v", inA, inB)
	}
	if inB.FullNameGenitive != "Имени emp-ab" || inB.FullNameKk != "Есім emp-ab" {
		t.Fatalf("имя в B не то же: %+v", inB)
	}

	// Должность учётной записи – из карточки в текущей компании.
	if u := e.userIn(dirA, "emp-ab"); u.Position != "Инженер" {
		t.Fatalf("должность в «Пользователях» A: %q", u.Position)
	}
	me, err := e.svc.Me(e.ctx, e.in("emp-ab", "c-b"))
	if err != nil || me.User.Position != "Бухгалтер" {
		t.Fatalf("должность в профиле в B: %q, %v", me.User.Position, err)
	}

	// Директор правит и свою карточку.
	if _, err = e.svc.UpdatePerson(e.ctx, dirA, "dir-a", edit(e.card(dirA, "dir-a"), func(c *service.PersonCard) {
		c.Position = "Генеральный директор"
	})); err != nil {
		t.Fatalf("своя карточка: %v", err)
	}
}

func TestPersonnelEditRules(t *testing.T) {
	e := seeded(t)
	dirA := e.as("dir-a")
	c := e.card(dirA, "emp-a")

	// Чужая компания и несуществующий человек – «не найдено».
	_, err := e.svc.UpdatePerson(e.ctx, dirA, "emp-b", edit(c, func(*service.PersonCard) {}))
	wantErr(t, err, domain.ErrNotFound)
	_, err = e.svc.UpdatePerson(e.ctx, dirA, "u-admin", edit(c, func(*service.PersonCard) {}))
	wantErr(t, err, domain.ErrNotFound)
	_, err = e.svc.UpdatePerson(e.ctx, dirA, "no-such", edit(c, func(*service.PersonCard) {}))
	wantErr(t, err, domain.ErrNotFound)

	// Работник персонал не правит.
	_, err = e.svc.UpdatePerson(e.ctx, e.as("emp-a"), "emp-a", edit(c, func(*service.PersonCard) {}))
	wantErr(t, err, domain.ErrForbidden)

	// Имя обязательно, поля – не длиннее 200 знаков.
	_, err = e.svc.UpdatePerson(e.ctx, dirA, "emp-a", edit(c, func(p *service.PersonCard) { p.FullName = " " }))
	wantValidation(t, err, "fullName")
	_, err = e.svc.UpdatePerson(e.ctx, dirA, "emp-a", edit(c, func(p *service.PersonCard) { p.Unit = strings.Repeat("я", 201) }))
	wantValidation(t, err, "unit")

	// Устаревшая версия – конфликт.
	if _, err = e.svc.UpdatePerson(e.ctx, dirA, "emp-a", edit(c, func(p *service.PersonCard) { p.Position = "Юрист" })); err != nil {
		t.Fatal(err)
	}
	_, err = e.svc.UpdatePerson(e.ctx, dirA, "emp-a", edit(c, func(p *service.PersonCard) { p.Position = "Бухгалтер" }))
	wantErr(t, err, domain.ErrConflict)
}

func TestPersonnelCreate(t *testing.T) {
	e := seeded(t)
	dirA := e.as("dir-a")

	// Без пароля: человек в персонале, но войти не может.
	got, err := e.svc.CreatePerson(e.ctx, dirA, service.NewPersonInput{
		Login: "new-a", PersonCard: service.PersonCard{FullName: "Новый Человек", Position: "Водитель"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if got.CompanyID != "c-a" || got.Position != "Водитель" {
		t.Fatalf("создан: %+v", got)
	}
	if !slices.Contains(cards(e.personnel(dirA)), got.ID+"@c-a") {
		t.Fatal("нового нет в персонале")
	}
	if _, err = e.svc.Login(e.ctx, "new-a", pass, "127.0.0.1"); err == nil {
		t.Fatal("вход без пароля удался")
	}
	if u := e.user(e.as("admin"), got.ID); u.Role != "employee" || u.HasPassword || !slices.Equal(u.CompanyIDs, []string{"c-a"}) {
		t.Fatalf("учётная запись: %+v", u)
	}

	// С паролем – входит.
	if _, err = e.svc.CreatePerson(e.ctx, dirA, service.NewPersonInput{
		Login: "new-a2", Password: "A123456a", PersonCard: service.PersonCard{FullName: "Второй"},
	}); err != nil {
		t.Fatal(err)
	}
	if _, err = e.svc.Login(e.ctx, "new-a2", "A123456a", "127.0.0.1"); err != nil {
		t.Fatalf("вход с паролем: %v", err)
	}

	_, err = e.svc.CreatePerson(e.ctx, dirA, service.NewPersonInput{Login: "NEW-A", PersonCard: service.PersonCard{FullName: "Дубль"}})
	wantValidation(t, err, "login")
	_, err = e.svc.CreatePerson(e.ctx, dirA, service.NewPersonInput{Login: "new-a3", Password: "12345", PersonCard: service.PersonCard{FullName: "Коротко"}})
	wantValidation(t, err, "password")
	_, err = e.svc.CreatePerson(e.ctx, e.as("emp-a"), service.NewPersonInput{Login: "new-a4", PersonCard: service.PersonCard{FullName: "Нельзя"}})
	wantErr(t, err, domain.ErrForbidden)
	// Без выбранной компании заводить некуда.
	_, err = e.svc.CreatePerson(e.ctx, e.as("emp-ab"), service.NewPersonInput{Login: "new-a5", PersonCard: service.PersonCard{FullName: "Куда"}})
	wantErr(t, err, domain.ErrForbidden)
}

func TestPersonnelRemove(t *testing.T) {
	e := seeded(t)
	dirA := e.as("dir-a")

	// Чужой, себя и несуществующего – «не найдено».
	wantErr(t, e.svc.RemovePerson(e.ctx, dirA, "emp-b", 0), domain.ErrNotFound)
	wantErr(t, e.svc.RemovePerson(e.ctx, dirA, "dir-a", e.card(dirA, "dir-a").LockVersion), domain.ErrNotFound)
	wantErr(t, e.svc.RemovePerson(e.ctx, dirA, "no-such", 0), domain.ErrNotFound)
	wantErr(t, e.svc.RemovePerson(e.ctx, dirA, "emp-a", e.card(dirA, "emp-a").LockVersion+1), domain.ErrConflict)

	// Человек двух компаний уходит только из этой.
	if err := e.svc.RemovePerson(e.ctx, dirA, "emp-ab", e.card(dirA, "emp-ab").LockVersion); err != nil {
		t.Fatal(err)
	}
	if got := cards(e.personnel(dirA)); slices.Contains(got, "emp-ab@c-a") {
		t.Fatalf("emp-ab остался в A: %v", got)
	}
	if got := cards(e.personnel(e.as("dir-b"))); !slices.Contains(got, "emp-ab@c-b") {
		t.Fatalf("emp-ab пропал из B: %v", got)
	}

	// Последняя компания – учётная запись удаляется (пометкой).
	if err := e.svc.RemovePerson(e.ctx, dirA, "emp-a", e.card(dirA, "emp-a").LockVersion); err != nil {
		t.Fatal(err)
	}
	if _, err := e.svc.Login(e.ctx, "emp-a", pass, "127.0.0.1"); err == nil {
		t.Fatal("удалённый входит")
	}
	all, err := e.svc.ListUsers(e.ctx, e.as("admin"))
	if err != nil {
		t.Fatal(err)
	}
	if slices.Contains(ids(all), "emp-a") {
		t.Fatal("удалённый в списке пользователей")
	}
}

// Должность из формы «Пользователи» и из переноса – в карточке компании.
func TestPositionGoesToCards(t *testing.T) {
	e := seeded(t)
	dirA := e.as("dir-a")
	u, err := e.svc.CreateUser(e.ctx, dirA, service.UserInput{
		Login: "with-pos", DisplayName: "С должностью", Role: "employee", CompanyIDs: []string{"c-a"},
		Password: "A123456a", Position: "Кладовщик",
	})
	if err != nil {
		t.Fatal(err)
	}
	if u.Position != "Кладовщик" || e.card(dirA, u.ID).Position != "Кладовщик" {
		t.Fatalf("должность при создании: %q", u.Position)
	}

	f := newEnv(t)
	admin := f.as("admin")
	if _, err = f.svc.Import(f.ctx, admin, service.ImportData{
		Companies: []service.Company{{"id": "c-a", "name": "ТОО «А»", "bin": bin(t, "10014000123")}},
		Users: []service.ImportUser{{
			ID: "imp", Login: "imp", DisplayName: "Перенесённый", Role: "employee", CompanyIDs: []string{"c-a"}, Position: "Юрист",
		}},
	}); err != nil {
		t.Fatal(err)
	}
	if c := f.card(f.in("admin", "c-a"), "imp"); c.Position != "Юрист" {
		t.Fatalf("должность после переноса: %q", c.Position)
	}
}

// userIn – учётная запись так, как её видит человек в своей компании.
func (e *env) userIn(p access.Principal, id string) service.User {
	e.t.Helper()
	list, err := e.svc.ListUsers(e.ctx, p)
	if err != nil {
		e.t.Fatal(err)
	}
	for _, u := range list {
		if u.ID == id {
			return u
		}
	}
	e.t.Fatalf("%s не видит %s", p.UserID, id)
	return service.User{}
}
