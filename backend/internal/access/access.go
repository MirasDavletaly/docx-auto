// Package access – вся логика доступа (CLAUDE.md, п. 3.2): в обработчиках и
// сервисах нет проверок вида «роль == директор», только вызов правил
// отсюда. Роли – данные (таблицы roles, role_permissions), здесь – только
// правила, общие для всех ролей.
//
// Правила повторяют политику сайта (web/src/access/policy.ts), чтобы
// интерфейс и сервер отвечали одинаково; решает – сервер.
package access

import "slices"

// GrantablePermissions – права, которые выдаются человеку поверх роли
// («Тест день 3»: создание шаблонов).
var GrantablePermissions = []string{"templates.create"}

// Principal – кто выполняет запрос. Собирается из токена и базы на каждый
// запрос; из тела запроса в нём ничего нет.
type Principal struct {
	UserID string
	// CompanyID – выбранная компания из токена; доступ к ней уже проверен.
	CompanyID string
	RoleID    string
	// Platform – роль платформы: работает во всех компаниях.
	Platform bool
	// CompanyIDs – компании, к которым у человека есть доступ.
	CompanyIDs  []string
	Permissions map[string]bool
	Blocked     bool
	// SectionIDs – разделы, где работник создаёт документы; у остальных
	// ролей пусто значит «все» (CanUseSection).
	SectionIDs []string
	// ViewSectionIDs – разделы, сохранённые документы которых работнику
	// открыты для просмотра.
	ViewSectionIDs []string
}

// Can – есть ли право. Заблокированный не может ничего.
func (p Principal) Can(permission string) bool {
	return !p.Blocked && p.Permissions[permission]
}

// HasCompany – доступна ли компания человеку.
func (p Principal) HasCompany(companyID string) bool {
	return p.Platform || slices.Contains(p.CompanyIDs, companyID)
}

// Target – учётная запись, над которой действие.
type Target struct {
	ID         string
	RoleID     string
	CompanyIDs []string
}

// managed – компании, людьми которых человек управляет: nil – все
// (администратор платформы), пусто – никакими.
func managed(p Principal) (all bool, ids []string) {
	if !p.Can("people.manage") {
		return false, nil
	}
	if p.Platform {
		return true, nil
	}
	return false, p.CompanyIDs
}

func overlaps(a, b []string) bool {
	for _, x := range a {
		if slices.Contains(b, x) {
			return true
		}
	}
	return false
}

// CanSeeUser – видна ли учётная запись в списке. Директору видны люди его
// компаний, включая других директоров, но не администраторы платформы.
func CanSeeUser(p Principal, t Target) bool {
	if t.ID == p.UserID {
		return true
	}
	all, ids := managed(p)
	if all {
		return true
	}
	if t.RoleID == "platform-admin" {
		return false
	}
	return overlaps(t.CompanyIDs, ids)
}

// CanManageUser – может ли править учётную запись: доступ, блокировку,
// пароль. Себя не правит никто (своё – в профиле); директор – только
// работников своих компаний.
func CanManageUser(p Principal, t Target) bool {
	if t.ID == p.UserID {
		return false
	}
	all, ids := managed(p)
	if all {
		return true
	}
	if len(ids) == 0 || t.RoleID != "employee" {
		return false
	}
	return overlaps(t.CompanyIDs, ids)
}

// CanChangeLogin – может ли менять логин: право users.login (решение
// человека 16.10 – только администратору платформы). Чей логин – решают
// CanManageUser (чужой) и профиль (свой).
func CanChangeLogin(p Principal) bool {
	return p.Can("users.login")
}

// CanEditPersonnel – правка карточек персонала компании (имя и его формы,
// должность, подразделение): кто управляет людьми этой компании. Карточку
// правят и свою, и другого директора – это данные для документов, а не
// доступ; доступ, блокировка и уход из компании – по CanManageUser.
func CanEditPersonnel(p Principal, companyID string) bool {
	if companyID == "" {
		return false
	}
	all, ids := managed(p)
	return all || slices.Contains(ids, companyID)
}

// AssignableRoles – какие роли человек может выдавать: директор – только
// работника.
func AssignableRoles(p Principal) []string {
	all, ids := managed(p)
	if all {
		return []string{"platform-admin", "director", "employee"}
	}
	if len(ids) == 0 {
		return nil
	}
	return []string{"employee"}
}

// AllowedCompanies – какие из запрошенных компаний человек может выдать в
// доступ: администратор – любые, директор – только свои.
func AllowedCompanies(p Principal, requested []string) []string {
	all, ids := managed(p)
	out := make([]string, 0, len(requested))
	for _, id := range requested {
		if all || slices.Contains(ids, id) {
			out = append(out, id)
		}
	}
	return out
}

// GrantableActions – какие права поверх роли человек может выдать: только
// из списка выдаваемых и только те, что есть у него самого.
func GrantableActions(p Principal, requested []string) []string {
	if all, ids := managed(p); !all && len(ids) == 0 {
		return nil
	}
	out := make([]string, 0, len(requested))
	for _, a := range requested {
		if slices.Contains(GrantablePermissions, a) && p.Can(a) {
			out = append(out, a)
		}
	}
	return out
}
