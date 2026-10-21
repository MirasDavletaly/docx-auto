import { describe, expect, it } from 'vitest';

import { translateJobTitle } from './jobTitles';

describe('должности и подразделения на казахском и английском', () => {
  it.each([
    ['Бухгалтер', 'Бухгалтер', 'Accountant'],
    ['Инженер-проектировщик', 'Жобалаушы инженер', 'Design Engineer'],
    ['Специалист по кадрам', 'Кадрлар жөніндегі маман', 'HR Specialist'],
    ['Отдел кадров', 'Кадрлар бөлімі', 'HR Department'],
    ['ИТ-служба', 'АТ қызметі', 'IT Service'],
  ])('«%s» – «%s» / «%s»', (ru, kk, en) => {
    expect(translateJobTitle(ru, 'kk')).toBe(kk);
    expect(translateJobTitle(ru, 'en')).toBe(en);
  });

  it('не зависит от регистра и пробелов по краям', () => {
    expect(translateJobTitle('  юрисконсульт ', 'en')).toBe('Legal Counsel');
  });

  it('чего нет в словаре, не выдумывает', () => {
    expect(translateJobTitle('Главный по кофе', 'en')).toBeUndefined();
  });
});
