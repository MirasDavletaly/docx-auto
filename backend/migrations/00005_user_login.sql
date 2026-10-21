-- Смена логина (docs/plans/phase-01d-archive-login.md): право users.login –
-- администратору платформы (решение человека 16.10). Права ролей – данные
-- (CLAUDE.md, п. 3.2): выдать его другой роли – одна строка, без правки кода.

-- +goose Up
INSERT INTO role_permissions (role_id, permission) VALUES ('platform-admin', 'users.login');

-- +goose Down
DELETE FROM role_permissions WHERE role_id = 'platform-admin' AND permission = 'users.login';
