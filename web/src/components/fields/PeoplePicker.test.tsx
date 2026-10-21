/**
 * Члены комиссии – выбором, как поле «Работник» («Тест день 4», дополнение:
 * «чтобы как в остальных выбиралась, а не вот так тупо. Несколько людей
 * пусть выбирается»).
 */
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { PeoplePicker } from './PeoplePicker';

import type { EmployeeBrief } from '@/api/types';
import type { Root } from 'react-dom/client';

const staff: EmployeeBrief[] = [
  { id: 'e-1', companyId: 'c', fullName: 'Ким Ирина Сергеевна', fullNameGenitive: 'Ким Ирине Сергеевне', position: 'Бухгалтер', unit: '' },
  { id: 'e-2', companyId: 'c', fullName: 'Ветров Павел Игоревич', fullNameGenitive: 'Ветрову Павлу Игоревичу', position: 'Системный администратор', unit: '' },
  { id: 'e-3', companyId: 'c', fullName: 'Оспанов Нурлан Ерболатович', fullNameGenitive: 'Оспанову Нурлану Ерболатовичу', position: 'Менеджер по закупкам', unit: '' },
];

let container: HTMLDivElement;
let root: Root;
let value = '';

function Harness({ initial }: { initial: string }) {
  const [current, setCurrent] = useState(initial);
  value = current;
  return (
    <PeoplePicker
      id="field-members"
      value={current}
      employees={staff}
      onChange={setCurrent}
      onFocus={() => undefined}
      onBlur={() => undefined}
    />
  );
}

function open(initial = '') {
  act(() => root.render(<Harness initial={initial} />));
}

const inputs = () => [...container.querySelectorAll<HTMLInputElement>('input[type=text]')];

/** Подсказки поля: `list` – идентификатор от useId, в селектор CSS он не годится. */
const suggestions = (input: HTMLInputElement | undefined) =>
  [...(document.getElementById(input?.getAttribute('list') ?? '')?.querySelectorAll('option') ?? [])].map((o) => o.value);

/** Ввод в поле так, как его видит React: через установщик значения и событие. */
function typeInto(input: HTMLInputElement, text: string) {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, text);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function press(label: string, index = 0) {
  const button = [...container.querySelectorAll('button')].filter((b) => b.getAttribute('aria-label') === label || b.textContent?.includes(label) === true)[index];
  if (button === undefined) throw new Error(`нет кнопки «${label}»`);
  act(() => button.click());
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('члены комиссии – выбором из персонала', () => {
  it('сначала одно поле с подсказкой из персонала, как у «Работника»', () => {
    open();
    expect(inputs()).toHaveLength(1);
    expect(inputs()[0]?.id).toBe('field-members');
    expect(suggestions(inputs()[0])).toEqual(staff.map((e) => e.fullName));
    // Галочек больше нет.
    expect(container.querySelector('input[type=checkbox]')).toBeNull();
  });

  it('выбранный из персонала хранится карточкой, людей можно добавить сколько нужно', () => {
    open();
    typeInto(inputs()[0]!, 'Ким Ирина Сергеевна');
    expect(value).toBe('e-1');

    press('Добавить человека');
    expect(inputs()).toHaveLength(2);
    typeInto(inputs()[1]!, 'Оспанов Нурлан Ерболатович');
    expect(value).toBe('e-1\ne-3');

    // Поле показывает ФИО, а не идентификатор.
    expect(inputs().map((i) => i.value)).toEqual(['Ким Ирина Сергеевна', 'Оспанов Нурлан Ерболатович']);
  });

  it('уже выбранного во втором поле не предлагают', () => {
    open('e-1\n');
    expect(suggestions(inputs()[1])).not.toContain('Ким Ирина Сергеевна');
    expect(suggestions(inputs()[1])).toHaveLength(2);
  });

  it('кого нет в персонале, вписывают в то же поле – строка идёт в документ как написана', () => {
    open('e-1');
    press('Добавить человека');
    typeInto(inputs()[1]!, 'Иванов И. И. – внешний эксперт');
    expect(value).toBe('e-1\nИванов И. И. – внешний эксперт');
  });

  it('человека можно убрать, порядок остальных сохраняется', () => {
    open('e-1\ne-2\ne-3');
    press('Убрать', 1);
    expect(value).toBe('e-1\ne-3');
    expect(inputs()).toHaveLength(2);
  });

  it('последнего не убирают, а очищают: поле для выбора остаётся', () => {
    open('e-2');
    press('Убрать', 0);
    expect(value).toBe('');
    expect(inputs()).toHaveLength(1);
  });
});
