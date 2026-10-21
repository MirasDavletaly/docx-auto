package service_test

import (
	"context"
	"errors"
	"slices"
	"strconv"
	"sync"
	"testing"
	"time"

	"docflow/internal/access"
	"docflow/internal/auth"
	"docflow/internal/config"
	"docflow/internal/domain"
	"docflow/internal/service"
	"docflow/internal/testdb"
)

// Пароль для всех учётных записей в тестах.
const pass = "test-password-123"

// clock – часы, которые тест двигает сам.
type clock struct {
	mu sync.Mutex
	t  time.Time
}

func (c *clock) now() time.Time {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.t
}

func (c *clock) add(d time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.t = c.t.Add(d)
}

// env – база с двумя компаниями (A и B) и людьми в них:
//
//	admin – администратор платформы;
//	dir-a, emp-a – директор и работник компании A;
//	dir-b, emp-b – директор и работник компании B;
//	emp-ab – работник обеих компаний.
type env struct {
	t     *testing.T
	ctx   context.Context
	svc   *service.Service
	db    *testdb.DB
	clock *clock
}

// bin – БИН с верной контрольной цифрой из 11 первых цифр.
func bin(t *testing.T, prefix string) string {
	t.Helper()
	for d := 0; d <= 9; d++ {
		if s := prefix + strconv.Itoa(d); domain.ValidIINBIN(s) {
			return s
		}
	}
	t.Fatalf("для %s нет контрольной цифры", prefix)
	return ""
}

func newEnv(t *testing.T) *env {
	t.Helper()
	tdb := testdb.New(t)
	clk := &clock{t: time.Now()}
	cfg := config.Auth{
		JWTSecret:   []byte("test-secret-test-secret-test-secret!"),
		AccessTTL:   10 * time.Minute,
		RefreshTTL:  12 * time.Hour,
		MaxAttempts: 5,
		LockFor:     15 * time.Minute,
	}
	e := &env{t: t, ctx: context.Background(), svc: service.New(tdb.App, cfg, clk.now), db: tdb, clock: clk}

	// Первый администратор – как его заводит установка (cmd/admin).
	hash, err := auth.HashPassword(pass)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = tdb.Owner.Exec(e.ctx,
		`INSERT INTO users (id, login, display_name, password_hash, role_id) VALUES ('u-admin', 'admin', 'Администратор', $1, 'platform-admin')`,
		hash); err != nil {
		t.Fatal(err)
	}
	return e
}

// seeded – база, заполненная переносом из браузера, с паролями.
func seeded(t *testing.T) *env {
	t.Helper()
	e := newEnv(t)
	admin := e.as("admin")
	user := func(id, role string, companies ...string) service.ImportUser {
		return service.ImportUser{ID: id, Login: id, DisplayName: "Имя " + id, Role: role, CompanyIDs: companies}
	}
	_, err := e.svc.Import(e.ctx, admin, service.ImportData{
		Companies: []service.Company{
			{"id": "c-a", "name": "ТОО «А»", "bin": bin(t, "10014000123"), "directorName": "Директор А"},
			{"id": "c-b", "name": "ТОО «Б»", "bin": bin(t, "10014000456"), "directorName": "Директор Б"},
		},
		Users: []service.ImportUser{
			user("dir-a", "director", "c-a"),
			user("emp-a", "employee", "c-a"),
			user("dir-b", "director", "c-b"),
			user("emp-b", "employee", "c-b"),
			user("emp-ab", "employee", "c-a", "c-b"),
		},
	})
	if err != nil {
		t.Fatalf("перенос: %v", err)
	}
	for _, id := range []string{"dir-a", "emp-a", "dir-b", "emp-b", "emp-ab"} {
		if err := e.svc.SetUserPassword(e.ctx, admin, id, pass); err != nil {
			t.Fatalf("пароль %s: %v", id, err)
		}
	}
	return e
}

func (e *env) login(login string) service.Session {
	e.t.Helper()
	s, err := e.svc.Login(e.ctx, login, pass, "127.0.0.1")
	if err != nil {
		e.t.Fatalf("вход %s: %v", login, err)
	}
	return s
}

// as – кто выполняет запрос, как его видит сервер по access-токену.
func (e *env) as(login string) access.Principal {
	e.t.Helper()
	p, err := e.svc.Authenticate(e.ctx, e.login(login).AccessToken)
	if err != nil {
		e.t.Fatalf("токен %s: %v", login, err)
	}
	return p
}

func (e *env) user(p access.Principal, id string) service.User {
	e.t.Helper()
	list, err := e.svc.ListUsers(e.ctx, e.as("admin"))
	if err != nil {
		e.t.Fatal(err)
	}
	for _, u := range list {
		if u.ID == id {
			return u
		}
	}
	e.t.Fatalf("нет учётной записи %s", id)
	return service.User{}
}

// wrongCheckDigit – тот же номер с неверной контрольной цифрой.
func wrongCheckDigit(t *testing.T, s string) string {
	t.Helper()
	last := (int(s[11]-'0') + 1) % 10
	out := s[:11] + strconv.Itoa(last)
	if domain.ValidIINBIN(out) {
		t.Fatalf("%s неожиданно верен", out)
	}
	return out
}

func wantErr(t *testing.T, err, want error) {
	t.Helper()
	if !errors.Is(err, want) {
		t.Fatalf("ошибка %v, ожидалась %v", err, want)
	}
}

func wantValidation(t *testing.T, err error, field string) {
	t.Helper()
	v, ok := domain.AsValidationError(err)
	if !ok {
		t.Fatalf("ошибка %v, ожидалась ошибка проверки поля %s", err, field)
	}
	for _, f := range v.Fields {
		if f.Field == field {
			return
		}
	}
	t.Fatalf("ошибка проверки без поля %s: %+v", field, v.Fields)
}

func ids(users []service.User) []string {
	out := make([]string, 0, len(users))
	for _, u := range users {
		out = append(out, u.ID)
	}
	slices.Sort(out)
	return out
}

// ── Вход ────────────────────────────────────────────────────────────────────

func TestLoginSucceeds(t *testing.T) {
	e := seeded(t)
	s := e.login("DIR-A") // логин без учёта регистра
	if s.AccessToken == "" || s.RefreshToken == "" {
		t.Fatal("нет токенов")
	}
	// Одна компания – выбрана сразу.
	if s.Me.CompanyID != "c-a" || s.Me.User.Login != "dir-a" || !slices.Contains(s.Me.Permissions, "people.manage") {
		t.Fatalf("me: %+v", s.Me)
	}
	// Две компании – выбирает сам.
	if s := e.login("emp-ab"); s.Me.CompanyID != "" {
		t.Fatalf("компания выбрана за человека: %q", s.Me.CompanyID)
	}
}

// Любая неудача – один и тот же ответ: по нему нельзя узнать, есть ли логин,
// заблокирован ли он, задан ли пароль (CLAUDE.md, п. 3.8).
func TestLoginFailuresLookTheSame(t *testing.T) {
	e := seeded(t)
	admin := e.as("admin")
	u := e.user(admin, "emp-b")
	in := service.UserInput{DisplayName: u.DisplayName, Role: u.Role, CompanyIDs: u.CompanyIDs, Blocked: true, LockVersion: u.LockVersion}
	if _, err := e.svc.UpdateUser(e.ctx, admin, "emp-b", in); err != nil {
		t.Fatal(err)
	}
	if _, err := e.db.Owner.Exec(e.ctx, `INSERT INTO users (id, login, display_name, role_id) VALUES ('u-nopass', 'nopass', 'Без пароля', 'employee')`); err != nil {
		t.Fatal(err)
	}

	for name, try := range map[string][2]string{
		"неверный пароль": {"emp-a", "wrong-password-1"},
		"нет логина":      {"nobody", pass},
		"заблокирован":    {"emp-b", pass},
		"нет пароля":      {"nopass", pass},
		"пустой пароль":   {"emp-a", ""},
	} {
		_, err := e.svc.Login(e.ctx, try[0], try[1], "127.0.0.1")
		if !errors.Is(err, domain.ErrInvalidCredentials) {
			t.Errorf("%s: %v", name, err)
		}
	}
}

// Логин меняет только администратор платформы (решение человека 16.10,
// docs/plans/phase-01d-archive-login.md): новый входит, старый – нет;
// директору – отказ; занятый и неверный – ошибка поля, логин прежний.
func TestLoginChangeByPlatformAdmin(t *testing.T) {
	e := seeded(t)
	admin, dir := e.as("admin"), e.as("dir-a")
	edit := func(p access.Principal, id, login string) error {
		t.Helper()
		u := e.user(p, id)
		_, err := e.svc.UpdateUser(e.ctx, p, id, service.UserInput{
			Login: login, DisplayName: u.DisplayName, Role: u.Role, CompanyIDs: u.CompanyIDs,
			SectionIDs: u.SectionIDs, ViewSectionIDs: u.ViewSectionIDs, LockVersion: u.LockVersion,
		})
		return err
	}

	// Директор логин не меняет, даже работнику своей компании; тот же логин
	// в запросе – не смена, правка проходит.
	wantErr(t, edit(dir, "emp-a", "emp-a-new"), domain.ErrForbidden)
	if err := edit(dir, "emp-a", "emp-a"); err != nil {
		t.Fatal(err)
	}

	// Занятый (в любом регистре) и неверный – ошибка поля.
	wantValidation(t, edit(admin, "emp-a", "EMP-B"), "login")
	wantValidation(t, edit(admin, "emp-a", "a b"), "login")
	wantValidation(t, edit(admin, "emp-a", "ab"), "login")
	if got := e.user(admin, "emp-a").Login; got != "emp-a" {
		t.Fatalf("логин после отказов: %q", got)
	}

	if err := edit(admin, "emp-a", "aidana.k"); err != nil {
		t.Fatal(err)
	}
	if got := e.user(admin, "emp-a").Login; got != "aidana.k" {
		t.Fatalf("логин: %q", got)
	}
	e.login("aidana.k")
	_, err := e.svc.Login(e.ctx, "emp-a", pass, "127.0.0.1")
	wantErr(t, err, domain.ErrInvalidCredentials)

	var logged int
	if err = e.db.Owner.QueryRow(e.ctx,
		`SELECT count(*) FROM audit_log WHERE event = 'user.login' AND target = 'emp-a → aidana.k'`).Scan(&logged); err != nil {
		t.Fatal(err)
	}
	if logged != 1 {
		t.Fatalf("записей в журнале: %d", logged)
	}

	// Свой логин – в профиле: директору нельзя, администратору можно.
	self := func(p access.Principal, id, login string) error {
		t.Helper()
		u := e.user(admin, id)
		_, profileErr := e.svc.UpdateOwnProfile(e.ctx, p, service.ProfileInput{
			DisplayName: u.DisplayName, Login: login, LockVersion: u.LockVersion,
		})
		return profileErr
	}
	wantErr(t, self(dir, "dir-a", "dir-a-new"), domain.ErrForbidden)
	if err = self(dir, "dir-a", "dir-a"); err != nil {
		t.Fatal(err)
	}
	if err = self(admin, "u-admin", "miras"); err != nil {
		t.Fatal(err)
	}
	e.login("miras")
}

func TestLoginLocksAfterFiveFailures(t *testing.T) {
	e := seeded(t)
	for i := 0; i < 5; i++ {
		_, err := e.svc.Login(e.ctx, "emp-a", "wrong-password-1", "")
		wantErr(t, err, domain.ErrInvalidCredentials)
	}
	// Верный пароль после блокировки – тот же отказ.
	_, err := e.svc.Login(e.ctx, "emp-a", pass, "")
	wantErr(t, err, domain.ErrInvalidCredentials)

	var events int
	if err := e.db.Owner.QueryRow(e.ctx, `SELECT count(*) FROM audit_log WHERE event = 'auth.locked' AND user_id = 'emp-a'`).Scan(&events); err != nil {
		t.Fatal(err)
	}
	if events != 1 {
		t.Fatalf("событий блокировки: %d", events)
	}

	// Новый пароль от администратора снимает блокировку.
	if err := e.svc.SetUserPassword(e.ctx, e.as("admin"), "emp-a", pass); err != nil {
		t.Fatal(err)
	}
	e.login("emp-a")
}

func TestSuccessResetsFailureCount(t *testing.T) {
	e := seeded(t)
	for round := 0; round < 2; round++ {
		for i := 0; i < 4; i++ {
			_, _ = e.svc.Login(e.ctx, "emp-a", "wrong-password-1", "")
		}
		e.login("emp-a")
	}
}

// ── Refresh-токены ──────────────────────────────────────────────────────────

func TestRefreshRotatesAndDetectsReuse(t *testing.T) {
	e := seeded(t)
	first := e.login("emp-a")

	second, err := e.svc.Refresh(e.ctx, first.RefreshToken, "")
	if err != nil {
		t.Fatal(err)
	}
	if second.RefreshToken == first.RefreshToken || second.Me.CompanyID != "c-a" {
		t.Fatalf("refresh не сменился или компания потеряна: %+v", second.Me)
	}

	// Старый токен ещё раз – кража: отзывается вся цепочка.
	_, err = e.svc.Refresh(e.ctx, first.RefreshToken, "")
	wantErr(t, err, domain.ErrUnauthorized)
	_, err = e.svc.Refresh(e.ctx, second.RefreshToken, "")
	wantErr(t, err, domain.ErrUnauthorized)

	// Другие входы этого человека не задеты.
	other := e.login("emp-a")
	if _, err := e.svc.Refresh(e.ctx, other.RefreshToken, ""); err != nil {
		t.Fatal(err)
	}
}

func TestRefreshExpires(t *testing.T) {
	e := seeded(t)
	s := e.login("emp-a")
	e.clock.add(12*time.Hour + time.Second)
	_, err := e.svc.Refresh(e.ctx, s.RefreshToken, "")
	wantErr(t, err, domain.ErrUnauthorized)
}

func TestRefreshUnknownToken(t *testing.T) {
	e := seeded(t)
	_, err := e.svc.Refresh(e.ctx, "not-a-token", "")
	wantErr(t, err, domain.ErrUnauthorized)
}

func TestLogoutRevokesChain(t *testing.T) {
	e := seeded(t)
	s := e.login("emp-a")
	if err := e.svc.Logout(e.ctx, s.RefreshToken); err != nil {
		t.Fatal(err)
	}
	_, err := e.svc.Refresh(e.ctx, s.RefreshToken, "")
	wantErr(t, err, domain.ErrUnauthorized)
	if err := e.svc.Logout(e.ctx, "unknown"); err != nil {
		t.Fatalf("выход с неизвестным токеном: %v", err)
	}
}

func TestRefreshCannotPickForeignCompany(t *testing.T) {
	e := seeded(t)
	s := e.login("emp-a")
	next, err := e.svc.Refresh(e.ctx, s.RefreshToken, "c-b")
	if err != nil {
		t.Fatal(err)
	}
	if next.Me.CompanyID != "c-a" {
		t.Fatalf("компания из запроса без доступа: %q", next.Me.CompanyID)
	}
}

// ── Токены и версия токенов ─────────────────────────────────────────────────

// Блокировка и смена роли действуют сразу: и access, и refresh старой
// версии больше не принимаются (CLAUDE.md, п. 3.8).
func TestBlockingRevokesTokens(t *testing.T) {
	e := seeded(t)
	s := e.login("emp-a")
	dir := e.as("dir-a")
	u := e.user(dir, "emp-a")
	in := service.UserInput{DisplayName: u.DisplayName, Role: u.Role, CompanyIDs: u.CompanyIDs, Blocked: true, LockVersion: u.LockVersion}
	if _, err := e.svc.UpdateUser(e.ctx, dir, "emp-a", in); err != nil {
		t.Fatal(err)
	}
	_, err := e.svc.Authenticate(e.ctx, s.AccessToken)
	wantErr(t, err, domain.ErrUnauthorized)
	_, err = e.svc.Refresh(e.ctx, s.RefreshToken, "")
	wantErr(t, err, domain.ErrUnauthorized)
}

func TestRoleChangeRevokesTokens(t *testing.T) {
	e := seeded(t)
	s := e.login("dir-a")
	admin := e.as("admin")
	u := e.user(admin, "dir-a")
	in := service.UserInput{DisplayName: u.DisplayName, Role: "employee", CompanyIDs: u.CompanyIDs, LockVersion: u.LockVersion}
	if _, err := e.svc.UpdateUser(e.ctx, admin, "dir-a", in); err != nil {
		t.Fatal(err)
	}
	_, err := e.svc.Authenticate(e.ctx, s.AccessToken)
	wantErr(t, err, domain.ErrUnauthorized)
	p := e.as("dir-a")
	if p.Can("people.manage") {
		t.Fatal("права директора после смены роли")
	}
}

func TestAccessTokenExpires(t *testing.T) {
	e := seeded(t)
	s := e.login("emp-a")
	e.clock.add(10*time.Minute + time.Second)
	_, err := e.svc.Authenticate(e.ctx, s.AccessToken)
	wantErr(t, err, domain.ErrUnauthorized)
}

func TestSelectCompany(t *testing.T) {
	e := seeded(t)
	p := e.as("emp-ab")
	s, err := e.svc.SelectCompany(e.ctx, p, "c-b")
	if err != nil {
		t.Fatal(err)
	}
	q, err := e.svc.Authenticate(e.ctx, s.AccessToken)
	if err != nil || q.CompanyID != "c-b" {
		t.Fatalf("компания в токене: %q, %v", q.CompanyID, err)
	}

	_, err = e.svc.SelectCompany(e.ctx, e.as("emp-a"), "c-b")
	wantErr(t, err, domain.ErrNotFound)
	_, err = e.svc.SelectCompany(e.ctx, e.as("admin"), "c-nope")
	wantErr(t, err, domain.ErrNotFound)
}

// Токен с компанией, доступ к которой потом сняли, больше не действует.
func TestAccessRemovedInvalidatesCompanyToken(t *testing.T) {
	e := seeded(t)
	s, err := e.svc.SelectCompany(e.ctx, e.as("emp-ab"), "c-b")
	if err != nil {
		t.Fatal(err)
	}
	dirB := e.as("dir-b")
	u := e.user(dirB, "emp-ab")
	in := service.UserInput{DisplayName: u.DisplayName, Role: u.Role, CompanyIDs: []string{}, LockVersion: u.LockVersion}
	if _, err = e.svc.UpdateUser(e.ctx, dirB, "emp-ab", in); err != nil {
		t.Fatal(err)
	}
	_, err = e.svc.Authenticate(e.ctx, s.AccessToken)
	wantErr(t, err, domain.ErrUnauthorized)
}

// ── Учётные записи: изоляция компаний ───────────────────────────────────────

func TestDirectorSeesOnlyOwnCompany(t *testing.T) {
	e := seeded(t)
	list, err := e.svc.ListUsers(e.ctx, e.as("dir-a"))
	if err != nil {
		t.Fatal(err)
	}
	if got, want := ids(list), []string{"dir-a", "emp-a", "emp-ab"}; !slices.Equal(got, want) {
		t.Fatalf("директор A видит %v, ожидалось %v", got, want)
	}
	for _, u := range list {
		if u.ID == "emp-ab" && !slices.Equal(u.CompanyIDs, []string{"c-a"}) {
			t.Fatalf("директор A узнал о доступах в другой компании: %v", u.CompanyIDs)
		}
	}
}

func TestEmployeeSeesOnlySelf(t *testing.T) {
	e := seeded(t)
	list, err := e.svc.ListUsers(e.ctx, e.as("emp-a"))
	if err != nil {
		t.Fatal(err)
	}
	if got := ids(list); !slices.Equal(got, []string{"emp-a"}) {
		t.Fatalf("работник видит %v", got)
	}
}

func TestAdminSeesEveryone(t *testing.T) {
	e := seeded(t)
	list, err := e.svc.ListUsers(e.ctx, e.as("admin"))
	if err != nil {
		t.Fatal(err)
	}
	if len(list) != 6 {
		t.Fatalf("администратор видит %v", ids(list))
	}
}

// Чужая учётная запись – «не найдено» на любое действие, а не «запрещено»:
// о её существовании директор другой компании не узнаёт.
func TestForeignUserIsNotFound(t *testing.T) {
	e := seeded(t)
	dirA := e.as("dir-a")
	foreign := e.user(e.as("admin"), "emp-b")
	in := service.UserInput{DisplayName: "Взлом", Role: "employee", CompanyIDs: []string{"c-a"}, LockVersion: foreign.LockVersion}

	_, err := e.svc.UpdateUser(e.ctx, dirA, "emp-b", in)
	wantErr(t, err, domain.ErrNotFound)
	wantErr(t, e.svc.SetUserPassword(e.ctx, dirA, "emp-b", "another-password-1"), domain.ErrNotFound)
	wantErr(t, e.svc.DeleteUser(e.ctx, dirA, "emp-b", foreign.LockVersion), domain.ErrNotFound)
	// И несуществующая – тот же ответ.
	_, err = e.svc.UpdateUser(e.ctx, dirA, "nobody", in)
	wantErr(t, err, domain.ErrNotFound)

	// Ничего не изменилось.
	if got := e.user(e.as("admin"), "emp-b"); got.DisplayName != foreign.DisplayName || got.LockVersion != foreign.LockVersion {
		t.Fatalf("чужая учётная запись изменилась: %+v", got)
	}
	e.login("emp-b")
}

// Директор не управляет другими директорами и администраторами, работник –
// никем, никто – собой.
func TestManagementLimits(t *testing.T) {
	e := seeded(t)
	admin := e.as("admin")
	for _, c := range []struct{ who, target string }{
		{"dir-a", "dir-a"}, {"dir-a", "u-admin"}, {"emp-a", "emp-ab"}, {"admin", "u-admin"},
	} {
		err := e.svc.SetUserPassword(e.ctx, e.as(c.who), c.target, "another-password-1")
		if !errors.Is(err, domain.ErrNotFound) {
			t.Errorf("%s → %s: %v", c.who, c.target, err)
		}
	}
	// Директора своей же компании – тоже нет.
	if _, err := e.db.Owner.Exec(e.ctx, `INSERT INTO users (id, login, display_name, role_id) VALUES ('dir-a2', 'dir-a2', 'Второй директор', 'director');
		INSERT INTO user_companies (company_id, user_id) VALUES ('c-a', 'dir-a2')`); err != nil {
		t.Fatal(err)
	}
	wantErr(t, e.svc.SetUserPassword(e.ctx, e.as("dir-a"), "dir-a2", "another-password-1"), domain.ErrNotFound)
	if err := e.svc.SetUserPassword(e.ctx, admin, "dir-a2", "another-password-1"); err != nil {
		t.Fatal(err)
	}
}

func TestDirectorCreatesOnlyEmployeesInOwnCompanies(t *testing.T) {
	e := seeded(t)
	dir := e.as("dir-a")
	in := service.UserInput{Login: "new-dir", DisplayName: "Новый", Role: "director", CompanyIDs: []string{"c-a"}, Password: pass}
	_, err := e.svc.CreateUser(e.ctx, dir, in)
	wantErr(t, err, domain.ErrForbidden)

	in.Login, in.Role, in.CompanyIDs = "new-emp", "employee", []string{"c-a", "c-b"}
	in.GrantedActions = []string{"templates.create", "people.manage"}
	u, err := e.svc.CreateUser(e.ctx, dir, in)
	if err != nil {
		t.Fatal(err)
	}
	if !slices.Equal(u.CompanyIDs, []string{"c-a"}) {
		t.Fatalf("директор A выдал доступ к %v", u.CompanyIDs)
	}
	if !slices.Equal(u.GrantedActions, []string{"templates.create"}) {
		t.Fatalf("выданы права %v", u.GrantedActions)
	}

	in.Login, in.CompanyIDs = "only-b", []string{"c-b"}
	_, err = e.svc.CreateUser(e.ctx, dir, in)
	wantValidation(t, err, "companyIds")

	_, err = e.svc.CreateUser(e.ctx, e.as("emp-a"), in)
	wantErr(t, err, domain.ErrForbidden)
}

func TestCreateUserValidation(t *testing.T) {
	e := seeded(t)
	admin := e.as("admin")
	base := service.UserInput{Login: "fresh", DisplayName: "Новый", Role: "employee", CompanyIDs: []string{"c-a"}, Password: pass}

	in := base
	in.Login = "EMP-A"
	_, err := e.svc.CreateUser(e.ctx, admin, in)
	wantValidation(t, err, "login")

	in = base
	in.Password = "short"
	_, err = e.svc.CreateUser(e.ctx, admin, in)
	wantValidation(t, err, "password")

	in = base
	in.CompanyIDs = []string{"c-nope"}
	_, err = e.svc.CreateUser(e.ctx, admin, in)
	wantValidation(t, err, "companyIds")

	u, err := e.svc.CreateUser(e.ctx, admin, base)
	if err != nil {
		t.Fatal(err)
	}
	if !u.HasPassword {
		t.Fatal("нет пароля")
	}
	e.login("fresh")
}

// Директор меняет доступ только к своим компаниям; доступ человека к
// другим компаниям остаётся как был.
func TestDirectorEditKeepsForeignAccess(t *testing.T) {
	e := seeded(t)
	dir := e.as("dir-a")
	u := e.user(dir, "emp-ab")
	in := service.UserInput{DisplayName: u.DisplayName, Role: u.Role, CompanyIDs: []string{}, LockVersion: u.LockVersion}
	got, err := e.svc.UpdateUser(e.ctx, dir, "emp-ab", in)
	if err != nil {
		t.Fatal(err)
	}
	if len(got.CompanyIDs) != 0 {
		t.Fatalf("директору A видны доступы к %v", got.CompanyIDs)
	}
	if all := e.user(e.as("admin"), "emp-ab").CompanyIDs; !slices.Equal(all, []string{"c-b"}) {
		t.Fatalf("доступы после правки директором A: %v", all)
	}
}

func TestUpdateUserConflict(t *testing.T) {
	e := seeded(t)
	dir := e.as("dir-a")
	u := e.user(dir, "emp-a")
	in := service.UserInput{DisplayName: "Первая правка", Role: u.Role, CompanyIDs: u.CompanyIDs, LockVersion: u.LockVersion}
	if _, err := e.svc.UpdateUser(e.ctx, dir, "emp-a", in); err != nil {
		t.Fatal(err)
	}
	in.DisplayName = "Вторая правка поверх"
	_, err := e.svc.UpdateUser(e.ctx, dir, "emp-a", in)
	wantErr(t, err, domain.ErrConflict)
}

func TestDeleteUser(t *testing.T) {
	e := seeded(t)
	dir := e.as("dir-a")
	s := e.login("emp-a")
	u := e.user(dir, "emp-a")
	wantErr(t, e.svc.DeleteUser(e.ctx, dir, "emp-a", u.LockVersion+1), domain.ErrConflict)
	if err := e.svc.DeleteUser(e.ctx, dir, "emp-a", u.LockVersion); err != nil {
		t.Fatal(err)
	}
	_, err := e.svc.Authenticate(e.ctx, s.AccessToken)
	wantErr(t, err, domain.ErrUnauthorized)
	_, err = e.svc.Login(e.ctx, "emp-a", pass, "")
	wantErr(t, err, domain.ErrInvalidCredentials)
	// Запись осталась в базе (физического удаления нет).
	var n int
	if err := e.db.Owner.QueryRow(e.ctx, `SELECT count(*) FROM users WHERE id = 'emp-a' AND deleted_at IS NOT NULL`).Scan(&n); err != nil || n != 1 {
		t.Fatalf("запись удалена физически: %d, %v", n, err)
	}
}

// ── Своя учётная запись ─────────────────────────────────────────────────────

func TestChangeOwnPassword(t *testing.T) {
	e := seeded(t)
	old := e.login("emp-a")
	p, err := e.svc.Authenticate(e.ctx, old.AccessToken)
	if err != nil {
		t.Fatal(err)
	}
	_, err = e.svc.ChangeOwnPassword(e.ctx, p, "wrong-current-1", "brand-new-password")
	wantValidation(t, err, "currentPassword")

	s, err := e.svc.ChangeOwnPassword(e.ctx, p, pass, "brand-new-password")
	if err != nil {
		t.Fatal(err)
	}
	// Прежние сессии закрыты, новая работает.
	_, err = e.svc.Refresh(e.ctx, old.RefreshToken, "")
	wantErr(t, err, domain.ErrUnauthorized)
	if _, err := e.svc.Authenticate(e.ctx, s.AccessToken); err != nil {
		t.Fatal(err)
	}
	if _, err := e.svc.Login(e.ctx, "emp-a", "brand-new-password", ""); err != nil {
		t.Fatal(err)
	}
}

func TestUpdateOwnProfile(t *testing.T) {
	e := seeded(t)
	p := e.as("emp-a")
	me, err := e.svc.Me(e.ctx, p)
	if err != nil {
		t.Fatal(err)
	}
	got, err := e.svc.UpdateOwnProfile(e.ctx, p, service.ProfileInput{
		DisplayName: "Новое имя", LockVersion: me.User.LockVersion, Profile: service.Profile{Phone: "+7 700 000 00 00"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if got.User.DisplayName != "Новое имя" || got.User.Phone != "+7 700 000 00 00" || got.User.Role != "employee" {
		t.Fatalf("профиль: %+v", got.User)
	}
	_, err = e.svc.UpdateOwnProfile(e.ctx, p, service.ProfileInput{DisplayName: "Ещё", LockVersion: me.User.LockVersion})
	wantErr(t, err, domain.ErrConflict)
}

// ── Компании ────────────────────────────────────────────────────────────────

func TestCompaniesIsolation(t *testing.T) {
	e := seeded(t)
	dir := e.as("dir-a")
	list, err := e.svc.ListCompanies(e.ctx, dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(list) != 1 || list[0]["id"] != "c-a" {
		t.Fatalf("директор A видит компании %v", list)
	}

	foreign := service.Company{"name": "Взлом", "bin": bin(t, "10014000456"), "lockVersion": float64(0)}
	_, err = e.svc.UpdateCompany(e.ctx, dir, "c-b", foreign)
	wantErr(t, err, domain.ErrNotFound)
	_, err = e.svc.UpdateCompany(e.ctx, dir, "c-nope", foreign)
	wantErr(t, err, domain.ErrNotFound)

	all, err := e.svc.ListCompanies(e.ctx, e.as("admin"))
	if err != nil || len(all) != 2 {
		t.Fatalf("администратор видит %d компаний: %v", len(all), err)
	}
	for _, c := range all {
		if c["id"] == "c-b" && c["name"] != "ТОО «Б»" {
			t.Fatalf("чужая компания изменилась: %v", c)
		}
	}
}

func TestUpdateCompany(t *testing.T) {
	e := seeded(t)
	dir := e.as("dir-a")
	in := service.Company{"name": "ТОО «А+»", "bin": "123456789012", "lockVersion": float64(0), "directorName": "Новый"}
	_, err := e.svc.UpdateCompany(e.ctx, dir, "c-a", in)
	wantValidation(t, err, "bin")

	in["bin"] = bin(t, "10014000123")
	got, err := e.svc.UpdateCompany(e.ctx, dir, "c-a", in)
	if err != nil {
		t.Fatal(err)
	}
	if got["name"] != "ТОО «А+»" || got["directorName"] != "Новый" || got["lockVersion"] != int32(1) {
		t.Fatalf("компания: %v", got)
	}
	_, err = e.svc.UpdateCompany(e.ctx, dir, "c-a", in) // та же версия ещё раз
	wantErr(t, err, domain.ErrConflict)

	_, err = e.svc.UpdateCompany(e.ctx, e.as("emp-a"), "c-a", in)
	wantErr(t, err, domain.ErrForbidden)
}

func TestCreateCompanyOnlyAdmin(t *testing.T) {
	e := seeded(t)
	in := service.Company{"name": "ТОО «В»", "bin": bin(t, "10014000789")}
	_, err := e.svc.CreateCompany(e.ctx, e.as("dir-a"), in)
	wantErr(t, err, domain.ErrForbidden)
	c, err := e.svc.CreateCompany(e.ctx, e.as("admin"), in)
	if err != nil {
		t.Fatal(err)
	}
	if c["name"] != "ТОО «В»" {
		t.Fatalf("компания: %v", c)
	}
}

// ── Перенос из браузера ─────────────────────────────────────────────────────

func TestImportOnlyOnceAndOnlyByAdmin(t *testing.T) {
	e := seeded(t)
	data := service.ImportData{Companies: []service.Company{{"id": "c-x", "name": "X", "bin": bin(t, "10014000789")}}}
	_, err := e.svc.Import(e.ctx, e.as("dir-a"), data)
	wantErr(t, err, domain.ErrForbidden)
	_, err = e.svc.Import(e.ctx, e.as("admin"), data)
	wantErr(t, err, domain.ErrConflict)
}

func TestImportSkipsExistingLoginAndChecksInput(t *testing.T) {
	e := newEnv(t)
	admin := e.as("admin")
	company := service.Company{"id": "c-a", "name": "А", "bin": bin(t, "10014000123")}

	_, err := e.svc.Import(e.ctx, admin, service.ImportData{
		Companies: []service.Company{company},
		Users:     []service.ImportUser{{ID: "x", Login: "xx-1", DisplayName: "X", Role: "employee", CompanyIDs: []string{"c-zzz"}}},
	})
	wantValidation(t, err, "users[0].companyIds")

	_, err = e.svc.Import(e.ctx, admin, service.ImportData{
		Companies: []service.Company{{"id": "c-a", "name": "А", "bin": wrongCheckDigit(t, bin(t, "10014000123"))}},
	})
	wantValidation(t, err, "companies[0].bin")

	res, err := e.svc.Import(e.ctx, admin, service.ImportData{
		Companies: []service.Company{company},
		Users: []service.ImportUser{
			{ID: "u-browser-admin", Login: "Admin", DisplayName: "Админ из браузера", Role: "platform-admin"},
			{ID: "u-1", Login: "worker", DisplayName: "Работник", Role: "employee", CompanyIDs: []string{"c-a"}, CreatedAt: "2026-09-01T10:00:00.000Z"},
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	if res.Companies != 1 || res.Users != 1 || !slices.Equal(res.Skipped, []string{"Admin"}) {
		t.Fatalf("итог переноса: %+v", res)
	}
	// Перенесённый без пароля войти не может, пока пароль не задан.
	_, err = e.svc.Login(e.ctx, "worker", "", "")
	wantErr(t, err, domain.ErrInvalidCredentials)
	u := e.user(admin, "u-1")
	if u.HasPassword || u.CreatedAt.Format("2006-01-02") != "2026-09-01" {
		t.Fatalf("перенесённая запись: %+v", u)
	}
}

// ── Подтверждение пароля и удаление компании ────────────────────────────────

func TestConfirmPassword(t *testing.T) {
	e := seeded(t)
	p := e.as("dir-a")
	if err := e.svc.ConfirmPassword(e.ctx, p, pass); err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 5; i++ {
		wantValidation(t, e.svc.ConfirmPassword(e.ctx, p, "wrong-password-1"), "password")
	}
	// Подбор через подтверждение закрывает и вход, и само подтверждение.
	wantValidation(t, e.svc.ConfirmPassword(e.ctx, p, pass), "password")
	_, err := e.svc.Login(e.ctx, "dir-a", pass, "")
	wantErr(t, err, domain.ErrInvalidCredentials)
}

func TestDeleteCompany(t *testing.T) {
	e := seeded(t)
	wantErr(t, e.svc.DeleteCompany(e.ctx, e.as("dir-a"), "c-a", 0), domain.ErrForbidden)
	wantErr(t, e.svc.DeleteCompany(e.ctx, e.as("dir-a"), "c-b", 0), domain.ErrNotFound)

	admin := e.as("admin")
	wantErr(t, e.svc.DeleteCompany(e.ctx, admin, "c-b", 7), domain.ErrConflict)
	if err := e.svc.DeleteCompany(e.ctx, admin, "c-b", 0); err != nil {
		t.Fatal(err)
	}
	list, err := e.svc.ListCompanies(e.ctx, admin)
	if err != nil || len(list) != 1 {
		t.Fatalf("компаний после удаления: %d, %v", len(list), err)
	}
	// Доступ к удалённой компании больше не действует.
	if got := e.user(admin, "emp-ab").CompanyIDs; !slices.Equal(got, []string{"c-a"}) {
		t.Fatalf("доступы emp-ab: %v", got)
	}
	_, err = e.svc.SelectCompany(e.ctx, e.as("emp-ab"), "c-b")
	wantErr(t, err, domain.ErrNotFound)
	// Строка осталась в базе.
	var n int
	if err := e.db.Owner.QueryRow(e.ctx, `SELECT count(*) FROM companies WHERE id = 'c-b' AND deleted_at IS NOT NULL`).Scan(&n); err != nil || n != 1 {
		t.Fatalf("компания стёрта физически: %d, %v", n, err)
	}
}
