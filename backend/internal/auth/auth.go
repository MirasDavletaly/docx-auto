// Package auth – пароли и токены (CLAUDE.md, п. 3.8).
//
//   - Пароли – argon2id в формате PHC: «$argon2id$v=19$m=…,t=…,p=…$соль$хеш».
//     Параметры – рекомендация OWASP для сервера с малой памятью
//     (19 МиБ, 2 прохода): сервер сайта – 1 ГБ.
//   - Access-токен – JWT HS256 на 10 минут: кто, в какой компании, версия
//     токенов человека. Права в токене не лежат: роли – данные и читаются из
//     базы на каждый запрос, вместе с проверкой token_version.
//   - Refresh-токен – 32 случайных байта; в базе – только SHA-256.
package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/argon2"
)

// ── Пароли ─────────────────────────────────────────────────────────────────

const (
	argonMemoryKiB = 19 * 1024
	argonTime      = 2
	argonThreads   = 1
	argonKeyLen    = 32
	argonSaltLen   = 16

	// MinPasswordLength – как на сайте (store/password.ts). 6, а не 12 по
	// OWASP ASVS 5.0 – решение человека 13.10: у сотрудников общий
	// начальный пароль из 8 знаков.
	MinPasswordLength = 6
	maxPasswordLength = 256
)

// ErrWeakPassword – пароль не проходит правила длины.
var ErrWeakPassword = errors.New("пароль не короче 6 знаков")

// CheckPasswordPolicy – длина в знаках, а не в байтах: казахские буквы –
// два байта, и пароль из 6 букв не должен считаться длиннее.
func CheckPasswordPolicy(password string) error {
	n := utf8.RuneCountInString(password)
	if n < MinPasswordLength || n > maxPasswordLength {
		return ErrWeakPassword
	}
	return nil
}

// HashPassword – argon2id с новой случайной солью.
func HashPassword(password string) (string, error) {
	salt := make([]byte, argonSaltLen)
	if _, err := rand.Read(salt); err != nil {
		return "", fmt.Errorf("соль пароля: %w", err)
	}
	key := argon2.IDKey([]byte(password), salt, argonTime, argonMemoryKiB, argonThreads, argonKeyLen)
	return fmt.Sprintf("$argon2id$v=%d$m=%d,t=%d,p=%d$%s$%s",
		argon2.Version, argonMemoryKiB, argonTime, argonThreads,
		base64.RawStdEncoding.EncodeToString(salt), base64.RawStdEncoding.EncodeToString(key)), nil
}

// VerifyPassword сравнивает за постоянное время. Испорченный или чужой
// формат хеша – «не подошёл», а не ошибка: на входе это одно и то же.
func VerifyPassword(password, encoded string) bool {
	parts := strings.Split(encoded, "$")
	if len(parts) != 6 || parts[1] != "argon2id" || parts[2] != fmt.Sprintf("v=%d", argon2.Version) {
		return false
	}
	var memory, iterations uint32
	var threads uint8
	if _, err := fmt.Sscanf(parts[3], "m=%d,t=%d,p=%d", &memory, &iterations, &threads); err != nil {
		return false
	}
	// Предел на параметры из базы: подменённый хеш не должен заставить
	// сервер выделить гигабайты памяти.
	if memory == 0 || memory > 256*1024 || iterations == 0 || iterations > 10 || threads == 0 || threads > 8 {
		return false
	}
	salt, err := base64.RawStdEncoding.DecodeString(parts[4])
	if err != nil || len(salt) < 8 {
		return false
	}
	want, err := base64.RawStdEncoding.DecodeString(parts[5])
	if err != nil || len(want) < 16 || len(want) > 128 {
		return false
	}
	got := argon2.IDKey([]byte(password), salt, iterations, memory, threads, uint32(len(want))) //nolint:gosec // длина проверена выше: 16–128
	return subtle.ConstantTimeCompare(got, want) == 1
}

// dummyHash – для входа с несуществующим логином: проверка пароля идёт и
// тогда, чтобы по времени ответа нельзя было узнать, есть ли такой логин.
var dummyHash = func() string {
	h, err := HashPassword("docflow-dummy-password-for-timing")
	if err != nil {
		panic(err)
	}
	return h
}()

// BurnPasswordCheck тратит то же время, что настоящая проверка.
func BurnPasswordCheck(password string) {
	_ = VerifyPassword(password, dummyHash)
}

// ── Access-токен ───────────────────────────────────────────────────────────

// Claims – что лежит в access-токене.
type Claims struct {
	UserID string
	// CompanyID – выбранная компания; пусто – ещё не выбрана.
	CompanyID    string
	TokenVersion int
	ExpiresAt    time.Time
}

type jwtClaims struct {
	Company      string `json:"cid,omitempty"`
	TokenVersion int    `json:"tv"`
	jwt.RegisteredClaims
}

// Tokens выдаёт и проверяет access-токены.
type Tokens struct {
	secret []byte
	ttl    time.Duration
	now    func() time.Time
}

// NewTokens – now передаётся явно: сроки проверяются тестами без ожидания.
func NewTokens(secret []byte, ttl time.Duration, now func() time.Time) *Tokens {
	return &Tokens{secret: secret, ttl: ttl, now: now}
}

// TTL – срок жизни access-токена.
func (t *Tokens) TTL() time.Duration { return t.ttl }

const issuer = "docflow"

// Issue подписывает токен на ttl от текущего момента.
func (t *Tokens) Issue(c Claims) (string, error) {
	now := t.now()
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwtClaims{
		Company:      c.CompanyID,
		TokenVersion: c.TokenVersion,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   c.UserID,
			Issuer:    issuer,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(t.ttl)),
		},
	})
	signed, err := token.SignedString(t.secret)
	if err != nil {
		return "", fmt.Errorf("подпись токена: %w", err)
	}
	return signed, nil
}

// ErrInvalidToken – токен не подходит: подделан, просрочен, испорчен.
var ErrInvalidToken = errors.New("токен недействителен")

// Parse проверяет подпись (только HS256), срок и издателя.
func (t *Tokens) Parse(raw string) (Claims, error) {
	var c jwtClaims
	_, err := jwt.ParseWithClaims(raw, &c, func(*jwt.Token) (any, error) { return t.secret, nil },
		jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}),
		jwt.WithIssuer(issuer),
		jwt.WithExpirationRequired(),
		jwt.WithTimeFunc(t.now),
	)
	if err != nil || c.Subject == "" {
		return Claims{}, ErrInvalidToken
	}
	return Claims{UserID: c.Subject, CompanyID: c.Company, TokenVersion: c.TokenVersion, ExpiresAt: c.ExpiresAt.Time}, nil
}

// ── Refresh-токен ──────────────────────────────────────────────────────────

// NewRefreshToken – случайный токен для cookie и его хеш для базы.
func NewRefreshToken() (string, []byte, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", nil, fmt.Errorf("refresh-токен: %w", err)
	}
	token := base64.RawURLEncoding.EncodeToString(b)
	return token, HashRefreshToken(token), nil
}

// HashRefreshToken – SHA-256: токен случайный и длинный, соль не нужна.
func HashRefreshToken(token string) []byte {
	sum := sha256.Sum256([]byte(token))
	return sum[:]
}

// NewID – случайный идентификатор записи (refresh-токен, цепочка, человек).
func NewID(prefix string) (string, error) {
	b := make([]byte, 12)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("идентификатор: %w", err)
	}
	return prefix + "-" + base64.RawURLEncoding.EncodeToString(b), nil
}
