/**
 * Собирает документы на проверку юристу.
 *
 * Все шаблоны выходят на трёх языках, но текст в них – черновик: часть взята
 * буквой в букву из присланных приказов, часть написана по их образцу.
 * Окончательным он не выдаётся (`reviewed: false`), и до проверки юристом
 * таким и останется (CLAUDE.md, п. 4.9).
 *
 * Файл собирается из самих шаблонов, поэтому не может с ними разойтись.
 * Запуск: npm run legal-review
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { sections } from '../src/api/mock/sections';
import { templates } from '../src/api/mock/templates';

import type { DocLang, DocumentTemplate, Para, Run } from '../src/api/types';

/** Документы, чей текст пришёл из ваших файлов, а не написан по образцу. */
const FROM_YOUR_FILES = new Set([
  'hr-hire-order',
  'hr-vacation-order',
  'hr-unpaid-leave-order',
  'corporate-director-appointment',
  'legal-power-single',
]);

const LANG_TITLE: Record<DocLang, string> = {
  kk: 'Қазақша',
  ru: 'Русский',
  en: 'English',
};

function runsToText(runs: Run[]): string {
  return runs
    .map((run) => ('text' in run ? run.text : `{${run.field}}`))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

function paras(list: Para[] | undefined): string[] {
  return (list ?? []).map(runsToText).filter((line) => line !== '');
}

function sectionTitle(id: string): string {
  return sections.find((s) => s.id === id)?.title ?? id;
}

/** Первая таблица документа: тема приказа и ссылка на статью закона. */
function head(tpl: DocumentTemplate) {
  for (const block of tpl.body) {
    if (block.kind === 'tri-table') return block.rows[0];
  }
  return undefined;
}

/** Остальные таблицы: само распоряжение. */
function bodyRows(tpl: DocumentTemplate) {
  const tables = tpl.body.filter((block) => block.kind === 'tri-table');
  return tables.slice(1).flatMap((block) => (block.kind === 'tri-table' ? block.rows : []));
}

function render(): string {
  const lines: string[] = [];

  lines.push('# Документы на проверку юристу');
  lines.push('');
  lines.push(
    'Файл собирается командой `npm run legal-review` в папке `web` из самих',
    'шаблонов, поэтому не может с ними разойтись. Руками его не правят.',
  );
  lines.push('');
  lines.push('## Что именно нужно проверить');
  lines.push('');
  lines.push(
    '1. **Ссылку на статью закона.** В ваших приказах она стоит первой строкой',
    '   под темой: «В соответствии со статьей 34 Трудового Кодекса РК от 23 ноября',
    '   2015 г. № 414-V». Там, где ниже написано «ссылки нет», её нужно дать –',
    '   реквизиты норм права не выдумываются.',
    '2. **Казахские падежные окончания после дат, чисел и ФИО.** В ваших же',
    '   приказах для разных дат стоят разные окончания («23.06.2026-нан»,',
    '   «04.09.2026-дан», «02.07.2026-ті»), и выбрать их программно нельзя.',
    '   Где мог, я обошёлся оборотами без окончания.',
    '3. **Формулировки распоряжений** в казахской колонке: «жіберілсін»,',
    '   «ауыстырылсын», «белгіленсін», «бұзылсын», «көтермеленсін»,',
    '   «қолданылсын» – сделаны по образцу ваших «қабылдансын» и «тағайындалсын».',
    '4. **Значения выпадающих списков** – основание расторжения, вид взыскания,',
    '   вид поощрения – пока идут по-русски во всех трёх колонках: своих полей',
    '   под перевод у них нет.',
  );
  lines.push('');
  lines.push('`{поле}` – подстановка: система сама поставит туда ФИО, дату или сумму.');
  lines.push('');
  lines.push(`Документов: **${templates.length}**.`);
  lines.push('');

  for (const tpl of templates) {
    lines.push('---');
    lines.push('');
    lines.push(`## ${tpl.title}`);
    lines.push('');
    lines.push(
      `Раздел: ${sectionTitle(tpl.sectionId)}. Идентификатор: \`${tpl.id}\`. ` +
        `Языки: ${tpl.langs.join(', ')}.`,
    );
    lines.push('');
    lines.push(
      FROM_YOUR_FILES.has(tpl.id)
        ? '**Источник текста:** ваш файл, взят буквой в букву.'
        : tpl.generic === true
          ? '**Источник текста:** типовой шаблон – неконкретный, собран по распространённым образцам. ' +
            'Проверить полностью и под компанию; ссылок на статьи закона в нём нет нарочно.'
          : '**Источник текста:** написан по образцу ваших приказов. Проверить полностью.',
    );
    lines.push('');

    // Типовой шаблон – не приказ: темы и распоряжения у него нет, весь текст
    // идёт подряд, пункт за пунктом.
    if (tpl.generic === true) {
      lines.push('### Текст');
      lines.push('');
      for (const block of tpl.body) {
        if (block.kind === 'tri-table') {
          for (const row of block.rows) {
            for (const lang of tpl.langs) {
              for (const line of paras(row[lang])) lines.push(`- **${LANG_TITLE[lang]}.** ${line}`);
            }
            lines.push('');
          }
        }
        if (block.kind === 'bi-table') {
          for (const row of block.rows) {
            for (const lang of ['ru', 'en'] as const) {
              for (const line of paras(row[lang])) lines.push(`- **${LANG_TITLE[lang]}.** ${line}`);
            }
            lines.push('');
          }
        }
      }
      continue;
    }

    if (tpl.layout === 'poa') {
      lines.push('Доверенность: выходит на русском и английском, казахской колонки нет.');
      lines.push('');
      continue;
    }

    const first = head(tpl);
    const subjectRu = paras(first?.ru);
    const hasLawRef = subjectRu.length > 1;

    lines.push(
      hasLawRef
        ? '**Ссылка на статью закона:** есть, проверить.'
        : '**Ссылка на статью закона: НЕТ.** Нужно дать – её не присылали.',
    );
    lines.push('');

    if (first !== undefined) {
      lines.push('### Тема приказа');
      lines.push('');
      for (const lang of tpl.langs) {
        for (const line of paras(first[lang])) {
          lines.push(`- **${LANG_TITLE[lang]}.** ${line}`);
        }
      }
      lines.push('');
    }

    lines.push('### Распоряжение');
    lines.push('');
    for (const row of bodyRows(tpl)) {
      for (const lang of tpl.langs) {
        const list = paras(row[lang]);
        if (list.length === 0) continue;
        lines.push(`**${LANG_TITLE[lang]}**`);
        lines.push('');
        for (const line of list) lines.push(`- ${line}`);
        lines.push('');
      }
    }
  }

  return lines.join('\n');
}

const out = resolve(import.meta.dirname, '..', '..', 'docs', 'legal-review.md');
writeFileSync(out, render(), 'utf8');
console.log(`готово: ${out} (${templates.length} документов)`);
