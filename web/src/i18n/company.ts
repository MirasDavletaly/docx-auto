/**
 * Реквизиты компании на языке интерфейса.
 *
 * Реквизиты – данные, а не строки интерфейса: у компании есть наименование,
 * город и руководитель на английском, и на английском интерфейсе видны они
 * («Тест день 2»: «на английском выборе компании её информация не
 * переводится»). Чего нет в карточке, собирается транслитерацией – это
 * лучше кириллицы посреди английского экрана.
 *
 * В документ это не идёт: бланк сам решает, что печатать в каждой колонке.
 */
import { tc } from './content';
import { lang } from './index';
import { englishName, transliterate } from '@/utils/names';

import type { Company } from '@/api/types';

/** Краткое наименование: «ExLumen LLP» вместо «ТОО «ExLumen»». */
export function companyName(company: Company): string {
  if (lang !== 'en') return company.name;
  if (company.nameEn !== undefined && company.nameEn.trim() !== '') return company.nameEn;
  // Новая компания без английского наименования: «ТОО «X»» – «X LLP».
  const bare = company.name.replace(/^ТОО\s+/u, '').replace(/[«»"]/gu, '');
  return company.name.startsWith('ТОО') ? `${transliterate(bare)} LLP` : transliterate(bare);
}

/** Город без приписки «city»: в строке «Astana · …» она лишняя. */
export function companyCity(company: Company): string {
  if (lang !== 'en') return company.city;
  const city = company.cityEn ?? transliterate(company.city);
  return city.replace(/\s+city$/iu, '');
}

export function companyDirector(company: Company): string {
  if (lang !== 'en') return company.directorName;
  return company.directorNameEn ?? englishName(company.directorName);
}

/** «Устава» – «the Charter»: основание полномочий записано в родительном падеже. */
const BASIS_EN: Record<string, string> = {
  Устава: 'the Charter',
  Решения: 'the Decision',
  Доверенности: 'a Power of Attorney',
};

export function companyBasis(company: Company): string {
  if (lang !== 'en') return company.directorBasis;
  return BASIS_EN[company.directorBasis] ?? company.directorBasis;
}

export function companyDirectorTitle(company: Company): string {
  if (lang !== 'en') return company.directorTitle;
  return company.directorTitleEn ?? tc(company.directorTitle);
}
