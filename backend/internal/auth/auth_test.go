package auth

import (
	"strings"
	"testing"
	"time"
)

func TestPassword(t *testing.T) {
	hash, err := HashPassword("Пароль-для-проверки-1")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(hash, "$argon2id$v=19$") {
		t.Fatalf("не argon2id: %s", hash)
	}
	if !VerifyPassword("Пароль-для-проверки-1", hash) {
		t.Fatal("верный пароль не подошёл")
	}
	if VerifyPassword("Пароль-для-проверки-2", hash) {
		t.Fatal("неверный пароль подошёл")
	}
	other, _ := HashPassword("Пароль-для-проверки-1")
	if other == hash {
		t.Fatal("у одинаковых паролей одинаковый хеш: соль не случайная")
	}
	for _, broken := range []string{"", "$argon2id$v=19$m=1", "$2a$14$bcrypt", hash[:len(hash)-4]} {
		if VerifyPassword("Пароль-для-проверки-1", broken) {
			t.Fatalf("испорченный хеш принят: %q", broken)
		}
	}
}

func TestPasswordPolicy(t *testing.T) {
	// Пять казахских букв – десять байт: длина считается в знаках.
	if err := CheckPasswordPolicy("әғқңө"); err == nil {
		t.Fatal("пароль короче 6 знаков принят")
	}
	for _, ok := range []string{"шесть6", "A123456a"} {
		if err := CheckPasswordPolicy(ok); err != nil {
			t.Fatalf("пароль %q из 6 знаков и длиннее отклонён: %v", ok, err)
		}
	}
	if err := CheckPasswordPolicy(strings.Repeat("я", 257)); err == nil {
		t.Fatal("пароль длиннее 256 знаков принят")
	}
}

func TestAccessToken(t *testing.T) {
	secret := []byte("test-secret-0123456789abcdef-0123456789")
	now := time.Date(2026, 10, 2, 9, 0, 0, 0, time.UTC)
	tokens := NewTokens(secret, 10*time.Minute, func() time.Time { return now })

	raw, err := tokens.Issue(Claims{UserID: "u-1", CompanyID: "c-a", TokenVersion: 3})
	if err != nil {
		t.Fatal(err)
	}
	got, err := tokens.Parse(raw)
	if err != nil {
		t.Fatalf("свой токен не разобран: %v", err)
	}
	if got.UserID != "u-1" || got.CompanyID != "c-a" || got.TokenVersion != 3 {
		t.Fatalf("утверждения: %+v", got)
	}

	t.Run("просроченный не принимается", func(t *testing.T) {
		later := NewTokens(secret, 10*time.Minute, func() time.Time { return now.Add(11 * time.Minute) })
		if _, err := later.Parse(raw); err == nil {
			t.Fatal("просроченный токен принят")
		}
	})

	t.Run("подписанный другим ключом не принимается", func(t *testing.T) {
		other := NewTokens([]byte("another-secret-0123456789abcdef-012345"), 10*time.Minute, func() time.Time { return now })
		if _, err := other.Parse(raw); err == nil {
			t.Fatal("чужая подпись принята")
		}
	})

	t.Run("алгоритм none не принимается", func(t *testing.T) {
		parts := strings.Split(raw, ".")
		forged := "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0." + parts[1] + "."
		if _, err := tokens.Parse(forged); err == nil {
			t.Fatal("токен без подписи принят")
		}
	})
}

func TestRefreshToken(t *testing.T) {
	a, hashA, err := NewRefreshToken()
	if err != nil {
		t.Fatal(err)
	}
	b, _, _ := NewRefreshToken()
	if a == b || len(a) < 40 {
		t.Fatalf("токены одинаковые или короткие: %q %q", a, b)
	}
	if string(HashRefreshToken(a)) != string(hashA) {
		t.Fatal("хеш токена не воспроизводится")
	}
}
