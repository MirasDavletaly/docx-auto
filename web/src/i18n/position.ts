/**
 * Должность на языке интерфейса: из словаря должностей, иначе как записана.
 *
 * Отдельно от `person.ts`: имя нужно боковой панели на каждом экране, а
 * словарь должностей – только админ-панели и странице документа. Так он не
 * попадает в главную часть сборки.
 */
import { lang } from './index';
import { translateJobTitle } from '@/utils/jobTitles';

export function positionName(position: string): string {
  return lang === 'en' ? (translateJobTitle(position, 'en') ?? position) : position;
}
