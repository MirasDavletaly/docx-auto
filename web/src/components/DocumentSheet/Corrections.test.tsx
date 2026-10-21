/**
 * Правки из файла «Исправление.docx».
 *
 * Каждая проверка здесь отвечает одному пункту той правки. Тест нужен потому,
 * что часть этих решений уже менялась на противоположные: линия подписи была,
 * потом её убрали, потом вернули, потом убрали снова. Пусть это будет видно
 * в коде, а не только в переписке.
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { DocumentSheet } from './DocumentSheet';
import { templates } from '@/api/mock/templates';
import { resetDb } from '@/store/db';

import type { Company } from '@/api/types';
import type { Root } from 'react-dom/client';

const knt: Company = {
  id: 'c-test',
  name: 'Kazakhstan New Technologies LLP',
  legalName: 'Партнерство с ограниченной ответственностью «Kazakhstan New Technologies LLP»',
  legalNameKk: 'ЖАУАПКЕРШІЛІГІ ШЕКТЕУЛІ СЕРІКТЕСТІК «KAZAKHSTAN NEW TECHNOLOGIES LLP»',
  legalNameEn: 'KAZAKHSTAN NEW TECHNOLOGIES LLP',
  bin: '200840900077',
  address: 'город Астана, проспект Мәңгілік Ел, 55/16',
  directorName: 'Ихсанова София Талаповна',
  directorNameShort: 'Ихсанова С.Т.',
  directorNameEn: 'Sofiya Ikhsanova',
  directorTitle: 'Генеральный директор',
  directorTitleKk: 'Бас директор',
  directorTitleEn: 'General director',
  directorTitleGenitive: 'Генерального директора',
  directorNameGenitive: 'Ихсановой Софии Талаповны',
  directorBasis: 'Решения',
  employerCaption: true,
  city: 'Астана',
  cityKk: 'Астана',
  cityEn: 'Astana city',
  accent: '#1f5c4a',
  monogram: 'KN',
  logo: 'data:image/png;base64,iVBORw0KGgo=',
};

/** GREENSPARKLIMITED: без «Жұмыс беруші», город – просто «Aksai». */
const gsl: Company = {
  ...knt,
  name: 'ТОО «GREEN SPARK LIMITED»',
  legalNameKk: 'ЖАУАПКЕРШІЛІГІ ШЕКТЕУЛІ СЕРІКТЕСТІК «GREEN SPARK LIMITED»',
  legalName: 'Товарищество с ограниченной ответственностью «GREEN SPARK LIMITED»',
  legalNameEn: 'GREEN SPARK LIMITED LLP',
  directorName: 'Кабешова Самал Амангелдиевна',
  directorNameShort: 'Кабешова С.А.',
  directorNameEn: 'Samal Kabeshova',
  directorTitleKk: 'Бас Директоры',
  employerCaption: false,
  city: 'Аксай',
  cityKk: 'Ақсай',
  cityEn: 'Aksai',
};

function template(id: string) {
  const found = templates.find((tpl) => tpl.id === id);
  if (found === undefined) throw new Error(`шаблон ${id} не найден`);
  return found;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  localStorage.clear();
  resetDb();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function render(company: Company, id = 'hr-hire-order', values: Record<string, string> = {}) {
  act(() => {
    root.render(
      <DocumentSheet
        template={template(id)}
        values={values}
        company={company}
        date="2026-09-22"
      />,
    );
  });
  return container.textContent ?? '';
}

describe('подпись', () => {
  it('между должностью и фамилией нет черты', () => {
    render(knt);
    expect(container.innerHTML).not.toContain('signatureLine');
  });

  it('стоит фамилия с инициалами, а не полное имя', () => {
    const text = render(knt);
    expect(text).toContain('Ихсанова С.Т. / Sofiya Ikhsanova');
    expect(text).not.toContain('Ихсанова София Талаповна');
  });

  it('«Жұмыс беруші» стоит только там, где эта строка есть в бланке', () => {
    expect(render(knt)).toContain('Жұмыс беруші / Работодатель / Employer:');
    expect(render(gsl)).not.toContain('Жұмыс беруші');
  });
});

describe('лист ознакомления', () => {
  it('черта набрана знаками подчёркивания, а не линией в оформлении', () => {
    render(knt);

    const line = container.querySelector('[class*="acquaintLine"]');
    expect(line).not.toBeNull();
    expect(line?.textContent ?? '').toMatch(/^_+$/);
  });

  it('стоит справа, под подписью', () => {
    render(knt);

    const acquaint = container.querySelector('[class*="acquaint"]');
    expect(acquaint).not.toBeNull();
    // Ширина ограничена и блок прижат вправо: в разметке это отдельный класс,
    // а не выравнивание текста внутри полной строки.
    expect(acquaint?.className ?? '').toContain('acquaint');
  });
});

describe('город латиницей', () => {
  it('печатается ровно так, как записан в карточке', () => {
    expect(render(knt)).toContain('Астана қ./г. Астана / Astana city');
    // У GREENSPARKLIMITED – просто «Aksai», без слова «city».
    const text = render(gsl);
    expect(text).toContain('Ақсай қ./г. Аксай / Aksai');
    expect(text).not.toContain('Aksai city');
  });
});

describe('дата решения участников', () => {
  it('пишется прописью на языке своей колонки', () => {
    const text = render(knt, 'corporate-director-appointment', {
      decisionDate: '2026-09-22',
      employee: 'Какимова Динара Сергалиевна',
      position: 'Генеральный директор',
      startDate: '2026-09-24',
    });

    expect(text).toContain('2026 жылғы 22 қыркүйегіндегі шешіміне сәйкес');
    expect(text).toContain('от 22 сентября 2026 года');
    expect(text).toContain('dated September 22, 2026');
  });
});

describe('логотип', () => {
  it('стоит в шапке отдельным блоком слева от наименования', () => {
    render(knt);

    const mark = container.querySelector('[class*="letterheadMark"]');
    expect(mark).not.toBeNull();
    expect(mark?.querySelector('img')).not.toBeNull();
  });
});

describe('статьи Трудового кодекса («Тест день 2»)', () => {
  it.each([
    ['hr-trip-order', '127'],
    ['hr-transfer-order', '45'],
    ['hr-salary-order', '46'],
    ['hr-discipline-order', '64'],
  ])('%s ссылается на статью %s на всех трёх языках', (id, article) => {
    const text = render(knt, id);
    expect(text).toContain(`Еңбек кодексінің ${article}-бабына сәйкес`);
    expect(text).toContain(`со статьей ${article} Трудового Кодекса РК`);
    expect(text).toContain(`Article ${article} of the Labor Code`);
  });

  it('расторжение: 56 по инициативе работника, 49 в остальных случаях', () => {
    expect(render(knt, 'hr-dismissal-order', { reason: 'по инициативе работника' })).toContain(
      'со статьей 56 Трудового Кодекса РК',
    );
    expect(render(knt, 'hr-dismissal-order', { reason: 'по соглашению сторон' })).toContain(
      'со статьей 49 Трудового Кодекса РК',
    );
    // Основание ещё не выбрано – ставится общая статья, а не пустое место.
    expect(render(knt, 'hr-dismissal-order', {})).toContain('со статьей 49 Трудового Кодекса РК');
  });

  it('у приказа о поощрении статьи нет: норму не подтвердили', () => {
    expect(render(knt, 'hr-bonus-order')).not.toContain('Трудового Кодекса РК');
  });
});
