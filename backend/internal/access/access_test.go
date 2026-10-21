package access

import "testing"

func principal(role string, platform bool, companies []string, perms ...string) Principal {
	set := map[string]bool{}
	for _, p := range perms {
		set[p] = true
	}
	return Principal{UserID: "me", RoleID: role, Platform: platform, CompanyIDs: companies, Permissions: set}
}

var (
	admin    = principal("platform-admin", true, nil, "people.manage", "company.edit", "company.create", "admin.panel", "templates.create")
	director = principal("director", false, []string{"c-a"}, "people.manage", "company.edit", "admin.panel", "templates.create")
	worker   = principal("employee", false, []string{"c-a"})
)

func TestCan(t *testing.T) {
	if !director.Can("people.manage") || worker.Can("people.manage") {
		t.Fatal("права роли")
	}
	blocked := worker
	blocked.Permissions = map[string]bool{"people.manage": true}
	blocked.Blocked = true
	if blocked.Can("people.manage") {
		t.Fatal("заблокированный не может ничего")
	}
}

func TestManageUser(t *testing.T) {
	cases := []struct {
		name   string
		who    Principal
		target Target
		want   bool
	}{
		{"администратор – любого", admin, Target{ID: "x", RoleID: "director", CompanyIDs: []string{"c-b"}}, true},
		{"директор – работника своей компании", director, Target{ID: "x", RoleID: "employee", CompanyIDs: []string{"c-a"}}, true},
		{"директор – не работника чужой", director, Target{ID: "x", RoleID: "employee", CompanyIDs: []string{"c-b"}}, false},
		{"директор – не другого директора", director, Target{ID: "x", RoleID: "director", CompanyIDs: []string{"c-a"}}, false},
		{"директор – не администратора", director, Target{ID: "x", RoleID: "platform-admin"}, false},
		{"работник – никого", worker, Target{ID: "x", RoleID: "employee", CompanyIDs: []string{"c-a"}}, false},
		{"себя – никто", admin, Target{ID: "me", RoleID: "platform-admin"}, false},
	}
	for _, c := range cases {
		if got := CanManageUser(c.who, c.target); got != c.want {
			t.Errorf("%s: %v", c.name, got)
		}
	}
}

func TestSeeUser(t *testing.T) {
	if CanSeeUser(director, Target{ID: "x", RoleID: "platform-admin"}) {
		t.Error("директору не виден администратор")
	}
	if !CanSeeUser(director, Target{ID: "x", RoleID: "director", CompanyIDs: []string{"c-a"}}) {
		t.Error("директору виден другой директор своей компании")
	}
	if CanSeeUser(director, Target{ID: "x", RoleID: "employee", CompanyIDs: []string{"c-b"}}) {
		t.Error("директору не виден работник чужой компании")
	}
	if !CanSeeUser(worker, Target{ID: "me", RoleID: "employee"}) {
		t.Error("себя видит каждый")
	}
}

func TestAssign(t *testing.T) {
	if got := AssignableRoles(director); len(got) != 1 || got[0] != "employee" {
		t.Errorf("директор заводит только работников: %v", got)
	}
	if got := AssignableRoles(worker); len(got) != 0 {
		t.Errorf("работник никого не заводит: %v", got)
	}
	if got := AllowedCompanies(director, []string{"c-a", "c-b"}); len(got) != 1 || got[0] != "c-a" {
		t.Errorf("директор даёт доступ только к своим: %v", got)
	}
	if got := AllowedCompanies(admin, []string{"c-a", "c-b"}); len(got) != 2 {
		t.Errorf("администратор – к любым: %v", got)
	}
	if got := GrantableActions(director, []string{"templates.create", "people.manage"}); len(got) != 1 || got[0] != "templates.create" {
		t.Errorf("выдаются только права из списка выдаваемых и только свои: %v", got)
	}
}

func TestCompanyAccess(t *testing.T) {
	if !director.HasCompany("c-a") || director.HasCompany("c-b") || !admin.HasCompany("c-любая") {
		t.Fatal("доступ к компании")
	}
}

func TestEditPersonnel(t *testing.T) {
	cases := []struct {
		name    string
		who     Principal
		company string
		want    bool
	}{
		{"администратор – в любой компании", admin, "c-b", true},
		{"директор – в своей", director, "c-a", true},
		{"директор – не в чужой", director, "c-b", false},
		{"работник – нигде", worker, "c-a", false},
		{"без компании – нигде", admin, "", false},
	}
	for _, c := range cases {
		if got := CanEditPersonnel(c.who, c.company); got != c.want {
			t.Errorf("%s: %v", c.name, got)
		}
	}
}
