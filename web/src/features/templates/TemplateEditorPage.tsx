/**
 * Конструктор шаблонов («Тест день 3»: «кнопка, чтобы можно было создать
 * новый шаблон; для директора, для админа и у кого есть доступ»).
 *
 * Слева – что за документ, какие у него поля и какой текст, справа – живой
 * лист на бланке группы, как в форме документа: человек видит, что выйдет
 * на бумагу, пока пишет. Отдельной вёрстки у шаблона нет – бланк один на все
 * документы (`api/mock/blank.ts`).
 *
 * Кто может и в каком разделе, решает политика (`canCreateTemplate`,
 * `canEditTemplate`), а сессия проверяет то же ещё раз при сохранении.
 * Шаблон ложится в компанию, в которой человек работает сейчас.
 */
import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { can, canCreateTemplate } from '@/access/policy';
import {
  COMPANY_PLACEHOLDERS,
  DEFAULT_HEADING,
  SERIES,
  checkTemplate,
  nextFieldId,
  renameInBody,
  toDocumentTemplate,
} from '@/api/mock/customTemplates';
import { sections } from '@/api/mock/sections';
import { DocumentSheet } from '@/components/DocumentSheet/DocumentSheet';
import { SheetViewport } from '@/components/DocumentSheet/SheetViewport';
import { PageHeader } from '@/components/PageHeader/PageHeader';
import { lang, t } from '@/i18n';
import { tc } from '@/i18n/content';
import { useSession } from '@/store/session';
import { cx } from '@/utils/cx';

import styles from './TemplateEditorPage.module.css';

import type { CustomTemplate, DocLang, TemplateField } from '@/api/types';
import type { TemplateInput } from '@/store/session';

const LANG_CHOICES: DocLang[][] = [['ru'], ['kk', 'ru'], ['kk', 'ru', 'en']];

const KINDS: Array<TemplateField['kind']> = [
  'text',
  'textarea',
  'date',
  'number',
  'money',
  'employee',
  'select',
];

function blankInput(sectionId: string): TemplateInput {
  const section = sections.find((s) => s.id === sectionId);
  return {
    title: '',
    purpose: '',
    sectionId,
    subsectionId: section?.subsections[0]?.id ?? '',
    series: 'ОД',
    heading: { ...DEFAULT_HEADING },
    langs: ['kk', 'ru', 'en'],
    fields: [],
    body: {},
    acquaint: false,
  };
}

function inputOf(tpl: CustomTemplate): TemplateInput {
  const {
    companyId: _c,
    authorId: _a,
    authorName: _n,
    createdAt: _cr,
    updatedAt: _u,
    deletedAt: _d,
    deletedBy: _b,
    ...rest
  } = tpl;
  return rest;
}

export default function TemplateEditorPage() {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();
  const { user, company, editableTemplate, saveTemplate, deleteTemplate } = useSession();

  const subject = { user, companyId: company?.id ?? null };
  const allowedSections = sections.filter((s) => canCreateTemplate(subject, s.id));
  const editing = templateId === undefined ? undefined : editableTemplate(templateId);

  const [draft, setDraft] = useState<TemplateInput>(() =>
    editing === undefined ? blankInput(allowedSections[0]?.id ?? '') : inputOf(editing),
  );
  const [showProblems, setShowProblems] = useState(false);
  const [denied, setDenied] = useState(false);

  // Куда вставлять поле по кнопке: в тот текст, где стоял курсор.
  const textAreas = useRef<Partial<Record<DocLang, HTMLTextAreaElement | null>>>({});
  const [focusLang, setFocusLang] = useState<DocLang>('ru');
  // Название поля до правки: текст переписывается при выходе из поля, а не
  // на каждой букве, иначе промежуточное пустое название ломало бы скобки.
  const labelBefore = useRef('');

  if (!can(subject, 'templates.create') || company === null || allowedSections.length === 0) {
    return (
      <div className={styles.missing}>
        <h1>{t.templates.noAccessTitle}</h1>
        <p>{t.templates.noAccessBody}</p>
        <Link to="/create">{t.templates.back}</Link>
      </div>
    );
  }

  if (templateId !== undefined && editing === undefined) {
    return (
      <div className={styles.missing}>
        <h1>{t.templates.notFound}</h1>
        <Link to="/create">{t.templates.back}</Link>
      </div>
    );
  }

  const full: CustomTemplate = {
    ...draft,
    id: draft.id ?? 'custom-preview',
    companyId: company.id,
    authorId: '',
    authorName: '',
    createdAt: '',
    updatedAt: '',
  };
  const problems = checkTemplate(full);
  const preview = toDocumentTemplate(full);
  const section = sections.find((s) => s.id === draft.sectionId);

  const set = (patch: Partial<TemplateInput>) => {
    setDenied(false);
    setDraft((prev) => ({ ...prev, ...patch }));
  };

  function setField(index: number, patch: Partial<TemplateField>) {
    set({ fields: draft.fields.map((f, i) => (i === index ? { ...f, ...patch } : f)) });
  }

  function renameField(index: number) {
    const field = draft.fields[index];
    if (field === undefined || labelBefore.current === field.label) return;
    set({ body: renameInBody(draft.body, labelBefore.current, field.label.trim()) });
  }

  function insert(token: string) {
    const target = draft.langs.includes(focusLang) ? focusLang : (draft.langs[0] ?? 'ru');
    const area = textAreas.current[target];
    const text = draft.body[target] ?? '';
    const start = area?.selectionStart ?? text.length;
    const end = area?.selectionEnd ?? text.length;

    set({ body: { ...draft.body, [target]: text.slice(0, start) + token + text.slice(end) } });
    window.requestAnimationFrame(() => {
      area?.focus();
      area?.setSelectionRange(start + token.length, start + token.length);
    });
  }

  function save() {
    if (problems.length > 0) {
      setShowProblems(true);
      return;
    }
    const saved = saveTemplate(draft);
    if (saved === null) {
      setDenied(true);
      return;
    }
    navigate(`/create?section=${saved.sectionId}`);
  }

  const caseWord = lang === 'en' ? 'case' : 'падеж';

  return (
    <div className={styles.page}>
      <PageHeader
        title={editing === undefined ? t.templates.newTitle : t.templates.editTitle}
        subtitle={t.templates.subtitle}
        actions={
          <Link className={styles.backLink} to="/create">
            {t.templates.back}
          </Link>
        }
      />

      <div className={styles.split}>
        <section className={styles.formColumn} aria-label={t.templates.editTitle}>
          <div className={styles.formBody}>
            {showProblems && problems.length > 0 ? (
              <div className={styles.problems} role="alert">
                <div className={styles.problemsTitle}>{t.templates.problemsTitle}</div>
                <ul className={styles.problemsList}>
                  {problems.map((problem) => (
                    <li key={problem}>{t.templates.problems[problem]}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {denied ? (
              <div className={styles.problems} role="alert">
                {t.templates.denied}
              </div>
            ) : null}

            {/* ── Документ ── */}
            <fieldset className={styles.group}>
              <legend className={styles.groupTitle}>{t.templates.groupDocument}</legend>
              <div className={styles.groupFields}>
                <Text
                  label={t.templates.title}
                  hint={t.templates.titleHint}
                  value={draft.title}
                  onChange={(title) => set({ title })}
                />
                <Text
                  label={t.templates.titleEn}
                  hint={t.templates.titleEnHint}
                  value={draft.titleEn ?? ''}
                  onChange={(titleEn) => set({ titleEn })}
                />
                <Text
                  label={t.templates.purpose}
                  hint={t.templates.purposeHint}
                  value={draft.purpose}
                  onChange={(purpose) => set({ purpose })}
                />
                <div className={styles.row}>
                  <label className={styles.field}>
                    <span className={styles.label}>{t.templates.section}</span>
                    <select
                      className={styles.input}
                      value={draft.sectionId}
                      onChange={(e) => {
                        const next = sections.find((s) => s.id === e.target.value);
                        set({ sectionId: e.target.value, subsectionId: next?.subsections[0]?.id ?? '' });
                      }}
                    >
                      {allowedSections.map((s) => (
                        <option key={s.id} value={s.id}>
                          {tc(s.title)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={styles.field}>
                    <span className={styles.label}>{t.templates.subsection}</span>
                    <select
                      className={styles.input}
                      value={draft.subsectionId}
                      onChange={(e) => set({ subsectionId: e.target.value })}
                    >
                      {(section?.subsections ?? []).map((s) => (
                        <option key={s.id} value={s.id}>
                          {tc(s.title)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className={styles.field}>
                  <span className={styles.label}>{t.templates.series}</span>
                  <select
                    className={styles.input}
                    value={draft.series}
                    onChange={(e) => set({ series: e.target.value })}
                  >
                    {SERIES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.id} – {tc(s.title)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </fieldset>

            {/* ── Бланк ── */}
            <fieldset className={styles.group}>
              <legend className={styles.groupTitle}>{t.templates.groupBlank}</legend>
              <div className={styles.groupFields}>
                <div className={styles.field}>
                  <span className={styles.label}>{t.templates.heading}</span>
                  <span className={styles.hint}>{t.templates.headingHint}</span>
                  <div className={styles.row3}>
                    {(['kk', 'ru', 'en'] as const).map((l) => (
                      <input
                        key={l}
                        className={styles.input}
                        lang={l}
                        aria-label={
                          l === 'kk' ? t.templates.headingKk : l === 'ru' ? t.templates.headingRu : t.templates.headingEn
                        }
                        value={draft.heading[l]}
                        onChange={(e) => set({ heading: { ...draft.heading, [l]: e.target.value } })}
                      />
                    ))}
                  </div>
                </div>

                <fieldset className={styles.choice}>
                  <legend className={styles.label}>{t.templates.langs}</legend>
                  <span className={styles.hint}>{t.templates.langsHint}</span>
                  {LANG_CHOICES.map((choice) => (
                    <label key={choice.join('-')} className={styles.checkItem}>
                      <input
                        type="radio"
                        name="langs"
                        checked={draft.langs.join('-') === choice.join('-')}
                        onChange={() => set({ langs: choice })}
                      />
                      {choice.length === 1
                        ? t.templates.langsRu
                        : choice.length === 2
                          ? t.templates.langsKkRu
                          : t.templates.langsAll}
                    </label>
                  ))}
                </fieldset>

                <label className={styles.checkItem}>
                  <input
                    type="checkbox"
                    checked={draft.acquaint}
                    onChange={(e) => set({ acquaint: e.target.checked })}
                  />
                  {t.templates.acquaint}
                </label>
              </div>
            </fieldset>

            {/* ── Поля формы ── */}
            <fieldset className={styles.group}>
              <legend className={styles.groupTitle}>{t.templates.groupFields}</legend>
              <p className={styles.hint}>{t.templates.fieldsHint}</p>

              {draft.fields.length === 0 ? <p className={styles.muted}>{t.templates.fieldsEmpty}</p> : null}

              <div className={styles.fieldList}>
                {draft.fields.map((field, index) => (
                  <div key={field.id} className={styles.fieldCard}>
                    <div className={styles.row}>
                      <label className={styles.field}>
                        <span className={styles.label}>{t.templates.fieldLabel}</span>
                        <input
                          className={styles.input}
                          value={field.label}
                          onFocus={() => {
                            labelBefore.current = field.label;
                          }}
                          onChange={(e) => setField(index, { label: e.target.value })}
                          onBlur={() => renameField(index)}
                        />
                      </label>
                      <label className={styles.field}>
                        <span className={styles.label}>{t.templates.fieldKind}</span>
                        <select
                          className={styles.input}
                          value={field.kind}
                          onChange={(e) => setField(index, { kind: e.target.value as TemplateField['kind'] })}
                        >
                          {KINDS.map((kind) => (
                            <option key={kind} value={kind}>
                              {t.templates.kinds[kind]}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    {field.kind === 'select' ? (
                      <Text
                        label={t.templates.fieldOptions}
                        value={(field.options ?? []).join(', ')}
                        onChange={(value) =>
                          setField(index, { options: value.split(',').map((o) => o.trim()) })
                        }
                      />
                    ) : null}

                    <div className={styles.fieldFooter}>
                      <label className={styles.checkItem}>
                        <input
                          type="checkbox"
                          checked={field.required}
                          onChange={(e) => setField(index, { required: e.target.checked })}
                        />
                        {t.templates.fieldRequired}
                      </label>
                      {draft.langs.length > 1 && (field.kind === 'text' || field.kind === 'textarea') ? (
                        <label className={styles.checkItem}>
                          <input
                            type="checkbox"
                            checked={field.perLang === true}
                            onChange={(e) => setField(index, { perLang: e.target.checked })}
                          />
                          {t.templates.fieldPerLang}
                        </label>
                      ) : null}
                      <button
                        type="button"
                        className={styles.danger}
                        onClick={() => set({ fields: draft.fields.filter((_, i) => i !== index) })}
                      >
                        {t.templates.fieldRemove}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                className={styles.secondary}
                onClick={() =>
                  set({
                    fields: [
                      ...draft.fields,
                      { id: nextFieldId(draft.fields), label: '', kind: 'text', required: true },
                    ],
                  })
                }
              >
                {t.templates.fieldAdd}
              </button>
            </fieldset>

            {/* ── Текст ── */}
            <fieldset className={styles.group}>
              <legend className={styles.groupTitle}>{t.templates.groupText}</legend>
              <p className={styles.hint}>{t.templates.textHint}</p>

              <div className={styles.chips} role="group" aria-label={t.templates.insert}>
                <span className={styles.chipsTitle}>{t.templates.insert}:</span>
                {draft.fields
                  .filter((f) => f.label.trim() !== '')
                  .flatMap((f) =>
                    f.kind === 'employee'
                      ? [
                          { key: f.id, text: f.label, token: `{${f.label.trim()}}` },
                          {
                            key: `${f.id}-case`,
                            text: `${f.label} (${t.templates.insertCase})`,
                            token: `{${f.label.trim()}|${caseWord}}`,
                          },
                        ]
                      : [{ key: f.id, text: f.label, token: `{${f.label.trim()}}` }],
                  )
                  .map((chip) => (
                    <button
                      key={chip.key}
                      type="button"
                      className={styles.chip}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => insert(chip.token)}
                    >
                      {chip.text}
                    </button>
                  ))}
              </div>
              <div className={styles.chips} role="group" aria-label={t.templates.insertCompany}>
                <span className={styles.chipsTitle}>{t.templates.insertCompany}:</span>
                {COMPANY_PLACEHOLDERS.map((c) => {
                  const word = lang === 'en' ? c.en : c.ru;
                  return (
                    <button
                      key={c.ru}
                      type="button"
                      className={cx(styles.chip, styles.chipCompany)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => insert(`{${word}}`)}
                    >
                      {word}
                    </button>
                  );
                })}
              </div>

              <div className={styles.groupFields}>
                {draft.langs.map((l) => (
                  <label key={l} className={styles.field}>
                    <span className={styles.label}>
                      {l === 'kk' ? t.templates.textKk : l === 'ru' ? t.templates.textRu : t.templates.textEn}
                    </span>
                    <textarea
                      ref={(el) => {
                        textAreas.current[l] = el;
                      }}
                      className={cx(styles.input, styles.textarea)}
                      lang={l}
                      rows={8}
                      value={draft.body[l] ?? ''}
                      onFocus={() => setFocusLang(l)}
                      onChange={(e) => set({ body: { ...draft.body, [l]: e.target.value } })}
                    />
                  </label>
                ))}
              </div>
            </fieldset>
          </div>

          <footer className={styles.formFooter}>
            {editing === undefined ? (
              <span />
            ) : (
              <button
                type="button"
                className={styles.danger}
                onClick={() => {
                  if (!window.confirm(t.templates.removeConfirm)) return;
                  deleteTemplate(editing.id);
                  navigate('/create', { replace: true });
                }}
              >
                {t.templates.remove}
              </button>
            )}
            <button type="button" className={styles.save} onClick={save}>
              {t.templates.save}
            </button>
          </footer>
        </section>

        <section className={styles.sheetColumn} aria-label={t.form.sheetTitle}>
          <div className={styles.notice} role="note">
            <div className={styles.noticeTitle}>{t.templates.previewTitle}</div>
            <p className={styles.noticeBody}>{t.templates.previewBody}</p>
          </div>
          <SheetViewport>
            <DocumentSheet
              template={preview}
              values={{}}
              company={company}
              date={new Date().toISOString().slice(0, 10)}
            />
          </SheetViewport>
        </section>
      </div>
    </div>
  );
}

function Text({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      <input className={styles.input} value={value} onChange={(e) => onChange(e.target.value)} />
      {hint === undefined ? null : <span className={styles.hint}>{hint}</span>}
    </label>
  );
}
