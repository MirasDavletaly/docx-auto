/**
 * Должности и подразделения на казахском и английском.
 *
 * Имя можно записать латиницей по правилам, а должность и подразделение –
 * только перевести. Здесь – словарь самых частых в группе названий: если
 * русское название совпадает с записью словаря, перевод подставляется сам
 * («имена сотрудников и подразделение не переводятся на английский»).
 * Нет в словаре – перевод вписывают в карточку или в форму, выдумывать его
 * программа не будет.
 *
 * Казахские названия – на проверку носителю языка (docs/questions.md).
 */

type Pair = { kk: string; en: string };

const TITLES: Record<string, Pair> = {
  // ── Должности ──────────────────────────────────────────────────────────
  'генеральный директор': { kk: 'Бас директор', en: 'General Director' },
  'директор': { kk: 'Директор', en: 'Director' },
  'заместитель директора': { kk: 'Директордың орынбасары', en: 'Deputy Director' },
  'главный бухгалтер': { kk: 'Бас бухгалтер', en: 'Chief Accountant' },
  'бухгалтер': { kk: 'Бухгалтер', en: 'Accountant' },
  'экономист': { kk: 'Экономист', en: 'Economist' },
  'юрист': { kk: 'Заңгер', en: 'Lawyer' },
  'юрисконсульт': { kk: 'Заң кеңесшісі', en: 'Legal Counsel' },
  'инженер': { kk: 'Инженер', en: 'Engineer' },
  'инженер-проектировщик': { kk: 'Жобалаушы инженер', en: 'Design Engineer' },
  'главный инженер': { kk: 'Бас инженер', en: 'Chief Engineer' },
  'менеджер': { kk: 'Менеджер', en: 'Manager' },
  'менеджер по закупкам': { kk: 'Сатып алу жөніндегі менеджер', en: 'Procurement Manager' },
  'менеджер по продажам': { kk: 'Сату жөніндегі менеджер', en: 'Sales Manager' },
  'офис-менеджер': { kk: 'Офис-менеджер', en: 'Office Manager' },
  'специалист по кадрам': { kk: 'Кадрлар жөніндегі маман', en: 'HR Specialist' },
  'специалист по охране труда': { kk: 'Еңбекті қорғау жөніндегі маман', en: 'Occupational Safety Specialist' },
  'системный администратор': { kk: 'Жүйелік әкімші', en: 'System Administrator' },
  'программист': { kk: 'Бағдарламашы', en: 'Programmer' },
  'руководитель проекта': { kk: 'Жоба жетекшісі', en: 'Project Manager' },
  'начальник отдела': { kk: 'Бөлім бастығы', en: 'Head of Department' },
  'помощник руководителя': { kk: 'Басшының көмекшісі', en: 'Executive Assistant' },
  'секретарь': { kk: 'Хатшы', en: 'Secretary' },
  'переводчик': { kk: 'Аудармашы', en: 'Translator' },
  'маркетолог': { kk: 'Маркетолог', en: 'Marketing Specialist' },
  'водитель': { kk: 'Жүргізуші', en: 'Driver' },
  'кладовщик': { kk: 'Қоймашы', en: 'Storekeeper' },
  'электрик': { kk: 'Электрик', en: 'Electrician' },
  'сварщик': { kk: 'Дәнекерлеуші', en: 'Welder' },
  'охранник': { kk: 'Күзетші', en: 'Security Guard' },

  // ── Подразделения ──────────────────────────────────────────────────────
  'администрация': { kk: 'Әкімшілік', en: 'Administration' },
  'бухгалтерия': { kk: 'Бухгалтерия', en: 'Accounting Department' },
  'финансовый отдел': { kk: 'Қаржы бөлімі', en: 'Finance Department' },
  'юридический отдел': { kk: 'Заң бөлімі', en: 'Legal Department' },
  'отдел кадров': { kk: 'Кадрлар бөлімі', en: 'HR Department' },
  'проектный отдел': { kk: 'Жобалау бөлімі', en: 'Design Department' },
  'отдел снабжения': { kk: 'Жабдықтау бөлімі', en: 'Procurement Department' },
  'отдел продаж': { kk: 'Сату бөлімі', en: 'Sales Department' },
  'отдел маркетинга': { kk: 'Маркетинг бөлімі', en: 'Marketing Department' },
  'ит-служба': { kk: 'АТ қызметі', en: 'IT Service' },
  'служба охраны труда': { kk: 'Еңбекті қорғау қызметі', en: 'Occupational Safety Service' },
  'склад': { kk: 'Қойма', en: 'Warehouse' },
};

/**
 * Перевод должности или подразделения, если оно есть в словаре. Регистр
 * первой буквы – как у русского написания: «бухгалтер» в середине фразы
 * остаётся со строчной и в казахском.
 */
export function translateJobTitle(ru: string, lang: 'kk' | 'en'): string | undefined {
  const key = ru.trim().toLocaleLowerCase('ru');
  const pair = TITLES[key];
  if (pair === undefined) return undefined;

  const translated = pair[lang];
  const first = ru.trim().charAt(0);
  const lowercase = first !== '' && first === first.toLocaleLowerCase('ru') && lang === 'kk';
  return lowercase ? translated.charAt(0).toLocaleLowerCase('kk') + translated.slice(1) : translated;
}
