-- Этап 1б, часть 1: персонал компании – её пользователи
-- (docs/plans/phase-01b-personnel.md).
--
-- Один человек – одна запись: имя, падеж для приказа, казахское ФИО с
-- дательным падежом и ФИО латиницей – в users; должность и подразделение на
-- трёх языках – в user_companies, своя в каждой компании. Пустая строка –
-- «не заполнено»: документ тогда берёт русское значение.

-- +goose Up

ALTER TABLE users
  ADD COLUMN name_genitive  text NOT NULL DEFAULT '' CHECK (length(name_genitive) <= 200),
  ADD COLUMN name_kk        text NOT NULL DEFAULT '' CHECK (length(name_kk) <= 200),
  ADD COLUMN name_kk_dative text NOT NULL DEFAULT '' CHECK (length(name_kk_dative) <= 200),
  ADD COLUMN name_en        text NOT NULL DEFAULT '' CHECK (length(name_en) <= 200);

ALTER TABLE user_companies
  ADD COLUMN position    text NOT NULL DEFAULT '' CHECK (length(position) <= 200),
  ADD COLUMN position_kk text NOT NULL DEFAULT '' CHECK (length(position_kk) <= 200),
  ADD COLUMN position_en text NOT NULL DEFAULT '' CHECK (length(position_en) <= 200),
  ADD COLUMN unit        text NOT NULL DEFAULT '' CHECK (length(unit) <= 200),
  ADD COLUMN unit_kk     text NOT NULL DEFAULT '' CHECK (length(unit_kk) <= 200),
  ADD COLUMN unit_en     text NOT NULL DEFAULT '' CHECK (length(unit_en) <= 200);

-- Должность была одна на человека – в профиле. Теперь она в карточке каждой
-- его компании, в профиле её больше нет.
UPDATE user_companies uc
SET position = left(u.profile->>'position', 200)
FROM users u
WHERE u.id = uc.user_id AND coalesce(u.profile->>'position', '') <> '';

UPDATE users SET profile = profile - 'position' WHERE profile ? 'position';

-- Сколько компаний у человека – без RLS: директор видит доступы человека
-- только к своим компаниям и иначе решил бы, что, убирая его из своей,
-- оставляет его вовсе без компаний. Наружу уходит только число.
-- +goose StatementBegin
CREATE FUNCTION app_user_company_count(p_user text) RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::integer
  FROM user_companies uc JOIN companies c ON c.id = uc.company_id AND c.deleted_at IS NULL
  WHERE uc.user_id = p_user
$$;
-- +goose StatementEnd
GRANT EXECUTE ON FUNCTION app_user_company_count(text) TO docflow_app;

-- Карточку правят только эти колонки; доступ к компании (сами строки)
-- по-прежнему добавляется и удаляется целиком.
GRANT UPDATE (position, position_kk, position_en, unit, unit_kk, unit_en) ON user_companies TO docflow_app;

-- +goose Down

-- Должность возвращается в профиль – из первой компании, где она есть.
UPDATE users u
SET profile = u.profile || jsonb_build_object('position', c.position)
FROM (
  SELECT DISTINCT ON (user_id) user_id, position
  FROM user_companies
  WHERE position <> ''
  ORDER BY user_id, company_id
) c
WHERE c.user_id = u.id;

REVOKE UPDATE (position, position_kk, position_en, unit, unit_kk, unit_en) ON user_companies FROM docflow_app;
DROP FUNCTION app_user_company_count(text);

ALTER TABLE user_companies
  DROP COLUMN unit_en,
  DROP COLUMN unit_kk,
  DROP COLUMN unit,
  DROP COLUMN position_en,
  DROP COLUMN position_kk,
  DROP COLUMN position;

ALTER TABLE users
  DROP COLUMN name_en,
  DROP COLUMN name_kk_dative,
  DROP COLUMN name_kk,
  DROP COLUMN name_genitive;
