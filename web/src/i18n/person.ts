/**
 * Имя человека на языке интерфейса.
 *
 * «Тест день 3»: «документ и снизу имя, кто создал, должны быть на
 * английском, если стоит английский, если на русском – на русском. По-моему,
 * везде так». Имена – данные, а не строки интерфейса, поэтому переводятся
 * здесь, по правилам `docs/translation-rules.md`:
 *
 *  - английский – латиницей: написание из карточки, если оно вписано,
 *    иначе транслитерация «Имя Фамилия»;
 *  - русский – без казахских букв: «Нұрлан» – «Нурлан».
 *
 * В документ это не идёт: колонки на трёх языках решает бланк.
 */
import { lang } from './index';
import { englishName, russianLetters } from '@/utils/names';

import type { DocumentRecord } from '@/api/types';

interface Card {
  fullName: string;
  fullNameEn?: string;
}

/** Имя на языке интерфейса. `card` – карточка персонала, если она известна. */
export function personName(name: string, card?: Card): string {
  if (name.trim() === '') return name;
  if (lang === 'en') {
    const own = card?.fullNameEn?.trim();
    return own !== undefined && own !== '' ? own : englishName(name);
  }
  return russianLetters(name);
}

/**
 * «Для кого» документа на языке интерфейса.
 *
 * Если человек выбран из справочника, в снимке документа лежит его
 * карточка, а в ней – написание латиницей по паспорту. Оно точнее
 * транслитерации, поэтому ищется первым.
 */
export function documentSubject(doc: DocumentRecord): string {
  const target = russianLetters(doc.subject.trim());
  const card = Object.values(doc.peopleSnapshot ?? {}).find(
    (person) => russianLetters(person.fullName.trim()) === target,
  );
  return personName(doc.subject, card);
}
