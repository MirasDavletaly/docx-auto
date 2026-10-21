/**
 * Компании группы.
 *
 * Все шесть заведены по настоящим реквизитам (ответ на Q16,
 * `docs/questions.md`). У каждой БИН проверен по контрольной цифре, все
 * счета — по mod-97, БИК соответствует банку.
 *
 * Компаний шесть, а `CLAUDE.md` и `docs/architecture.md` говорят о группе из
 * четырёх. Для кода это ничего не меняет — изоляция устроена по `company_id`,
 * а не по их числу, — но расхождение отмечено в Q22. ТОО NOVALLIANCE убрана
 * по просьбе человека 25.09; в браузерах, где она уже заведена, её убирает
 * `store/db.ts` при чтении базы (`REMOVED_COMPANY_IDS`).
 *
 * Логотипы присланы отдельно и лежат в `src/assets/logos`. Они печатаются
 * в шапке каждого документа – там же, где стоят на ваших бланках. Файл
 * подключается импортом, а не строкой base64: так он попадает в сборку
 * отдельной частью и не раздувает исходник.
 *
 * Вымышленных компаний здесь больше нет. Если появится новая и её реквизиты
 * ещё не пришли, ей ставится `placeholder: true` — тогда интерфейс скажет,
 * что данные условные, и документ от её имени подписывать нельзя.
 */
import effegiLogo from '@/assets/logos/effegi-eurasia.png';
import algoritmiLogo from '@/assets/logos/algoritmi-kz.png';
import exlumenLogo from '@/assets/logos/exlumen.png';
import greenSparkLimitedLogo from '@/assets/logos/green-spark-limited.png';
import greenSparkPowerLogo from '@/assets/logos/green-spark-power-01.png';
import kntLogo from '@/assets/logos/kazakhstan-new-technologies.png';

import type { Company } from '@/api/types';

export const companies: Company[] = [
  {
    id: 'c-exlumen',
    name: 'ТОО «ExLumen»',
    nameEn: 'ExLumen LLP',
    legalName: 'Товарищество с ограниченной ответственностью «ExLumen»',
    // Форма собственности записана так же, как в присланных бланках ТОО.
    // Само наименование – имя собственное и не переводится.
    legalNameKk: 'ЖАУАПКЕРШІЛІГІ ШЕКТЕУЛІ СЕРІКТЕСТІК «ExLumen»',
    legalNameEn: '«ExLumen» LLP',
    bin: '251040008414',
    kbe: '17',
    postalCode: '060011',
    address: 'Республика Казахстан, город Атырау, улица Бактыгерей Кулманов, строение 113В',
    // Английское написание – как у ТОО «Algoritmi KZ» по тому же адресу.
    addressEn: 'Republic of Kazakhstan, Atyrau city, Baktigerei Kulmanov street, 113B',
    directorName: 'Хамит Нурдаулет Алмазович',
    directorNameShort: 'Хамит Н.А.',
    // Латиница взята из карточки ТОО «EFFEGI EURASIA»: там тот же человек
    // записан как «Nurdaulet Khamit». Написание ФИО в двух компаниях
    // расходится – docs/questions.md, Q23.
    directorNameEn: 'Nurdaulet Khamit',
    directorTitle: 'Генеральный директор',
    directorTitleKk: 'Бас директор',
    directorTitleEn: 'General Director',
    // Падежи заполнены по общему правилу и ждут подтверждения человека:
    // ошибка здесь попадает прямо в текст приказа (docs/questions.md, Q18).
    directorTitleGenitive: 'Генерального директора',
    directorNameGenitive: 'Хамита Нурдаулета Алмазовича',
    // Основание полномочий не прислано; «Устава» — обычное для директора ТОО,
    // но это предположение, а не реквизит. Тоже Q18.
    directorBasis: 'Устава',
    city: 'Атырау',
    cityKk: 'Атырау',
    cityEn: 'Atyrau',
    // Фирменный цвет не прислан: пока стоит цвет самой системы.
    accent: '#2f3b8f',
    monogram: 'EL',
    logo: exlumenLogo,
    bank: {
      name: 'АО «Банк ЦентрКредит»',
      bik: 'KCJBKZKX',
      accounts: [
        { iban: 'KZ848562203149704674', currency: 'KZT' },
        { iban: 'KZ688562203249707694', currency: 'USD' },
        { iban: 'KZ718562203249707737', currency: 'EUR' },
      ],
    },
  },
  {
    id: 'c-knt',
    name: 'Kazakhstan New Technologies LLP',
    nameEn: 'Kazakhstan New Technologies LLP',
    // Шапка взята из приказа «AL Nurdaulet KNT»: наименование на трёх
    // языках стоит там тремя строками подряд.
    legalNameKk: 'ЖАУАПКЕРШІЛІГІ ШЕКТЕУЛІ СЕРІКТЕСТІК «KAZAKHSTAN NEW TECHNOLOGIES LLP»',
    directorTitleKk: 'Бас директор',
    directorTitleEn: 'General Director',
    // В присланных реквизитах первая буква «К» — кириллическая (U+041A)
    // внутри латинского слова, и в русском, и в английском написании.
    // Здесь записана латиница: иначе поиск по «Kazakhstan» компанию не
    // найдёт, а на бумаге разница неразличима. Ждёт сверки с уставом
    // (docs/questions.md, Q19).
    legalName: 'Партнерство с ограниченной ответственностью «Kazakhstan New Technologies LLP»',
    legalNameEn: '«Kazakhstan New Technologies» Limited Liability Partnership',
    bin: '200840900077',
    postalCode: 'Z05T3F2',
    address: 'город Астана, проспект Мәңгілік Ел, 55/16, офис 333-334',
    addressEn: 'Astana city, Mangilik El Ave., 55/16, office 333-334',
    directorName: 'Гезини Алессандро',
    directorNameShort: 'Ихсанова С.Т.',
    employerCaption: true,
    directorNameEn: 'Ghesini Alessandro',
    directorTitle: 'Генеральный директор',
    directorTitleGenitive: 'Генерального директора',
    // Итальянские «Гезини» и «Алессандро» в русском не склоняются, поэтому
    // родительный падеж совпадает с именительным. Это тот случай, ради
    // которого падежи и хранятся данными, а не вычисляются.
    directorNameGenitive: 'Гезини Алессандро',
    // Основание полномочий не прислано. Для ПОО учредительный документ
    // может называться иначе, чем «Устав», поэтому здесь пусто: в тексте
    // доверенности останется видимый пропуск, а не выдуманное слово.
    directorBasis: '',
    city: 'Астана',
    cityKk: 'Астана',
    cityEn: 'Astana city',
    // Фирменный цвет и логотип не присланы.
    accent: '#1f5c4a',
    monogram: 'KN',
    logo: kntLogo,
    bank: {
      name: 'АО «Банк ЦентрКредит»',
      bik: 'KCJBKZKX',
      accounts: [
        { iban: 'KZ478562203110208007', currency: 'KZT' },
        { iban: 'KZ938562203210208068', currency: 'USD' },
        { iban: 'KZ258562203210208128', currency: 'EUR' },
      ],
    },
  },
  {
    id: 'c-algoritmi',
    name: 'ТОО «Algoritmi KZ»',
    nameEn: 'Algoritmi KZ LLP',
    // Из приказа «Order EA Dinara Kakimova». Там же город — Астана,
    // а не Атырау, как записано ниже (расхождение в docs/questions.md).
    legalNameKk: 'ЖАУАПКЕРШІЛІГІ ШЕКТЕУЛІ СЕРІКТЕСТІК «Algoritmi Kz»',
    directorTitleKk: 'Бас Директор',
    directorTitleEn: 'General Director',
    legalName: 'Товарищество с ограниченной ответственностью «Algoritmi KZ (Алгоритми КЗ)»',
    legalNameEn: 'Limited Liability Partnership Algoritmi KZ',
    bin: '131040015313',
    postalCode: '060011',
    address:
      'Республика Казахстан, Атырауская область, город Атырау, улица Бактыгерей Кулманов, строение 113В',
    addressEn:
      'Republic of Kazakhstan, Atyrau region, Atyrau city, Baktigerei Kulmanov street, 113B',
    phone: '+7 705 735 40 79',
    directorName: 'Қабыл Нұрмахамбет Маханбетханұлы',
    directorNameShort: 'Қабыл Н.М.',
    employerCaption: false,
    directorNameEn: 'Kabyl Nurmakhambet',
    directorTitle: 'Генеральный директор',
    directorTitleGenitive: 'Генерального директора',
    // Падеж не прислан: вписан по общему правилу и ждёт подтверждения.
    // В делопроизводстве РК казахские имена склоняют не всегда — Q20.
    directorNameGenitive: 'Қабыла Нұрмахамбета Маханбетханұлы',
    // Основание полномочий не прислано; «Устава» — обычное для ТОО. Q20.
    directorBasis: 'Устава',
    // Город в шапке приказа не заполнен намеренно: здесь записан Атырау, а в
    // присланном приказе «Order EA Dinara Kakimova» стоит Астана. Пока
    // расхождение не решено (docs/questions.md, Q26), в бланк идёт одно
    // значение отсюда, а не выдуманная тройка.
    city: 'Атырау',
    // Город взят из карточки, а не из присланного приказа: там стоит
    // Астана. Какой верен – docs/questions.md, Q26.
    cityKk: 'Атырау',
    cityEn: 'Atyrau city',
    // Фирменный цвет и логотип не присланы.
    accent: '#8a4b1f',
    monogram: 'AK',
    logo: algoritmiLogo,
    bank: {
      name: 'АО «Банк ЦентрКредит»',
      bik: 'KCJBKZKX',
      accounts: [
        { iban: 'KZ708562203127904467', currency: 'KZT' },
        { iban: 'KZ588562203227904990', currency: 'USD' },
        { iban: 'KZ378562203227905077', currency: 'EUR' },
      ],
    },
    taxOffice: {
      name: 'РГУ «УГД по городу Атырау ДГД по Атырауской области КГД МФ РК»',
      bin: '090440011223',
    },
  },
  {
    id: 'c-greenspark-power',
    name: 'ТОО «GREEN SPARK POWER 01»',
    nameEn: 'GREEN SPARK POWER 01 LLP',
    // Из приказа «Приказ EA Aliya».
    legalNameKk: 'ЖАУАПКЕРШІЛІГІ ШЕКТЕУЛІ СЕРІКТЕСТІК «GREEN SPARK POWER 01»',
    directorTitleKk: 'Бас директор',
    directorTitleEn: 'General Director',
    legalName:
      'Товарищество с ограниченной ответственностью «GREEN SPARK POWER 01» (ГРИН СПАРК ПАУЕР 01)',
    legalNameEn: '«GREEN SPARK POWER 01» LLP',
    bin: '250340002027',
    postalCode: '090500',
    address:
      'Республика Казахстан, Западно-Казахстанская область, Жанибекский район, Жанибекский сельский округ, село Жанибек, улица Мусина, дом 10, квартира 2',
    addressEn:
      'Republic of Kazakhstan, West Kazakhstan Region, Zhanibek District, Zhanibek village, Musin Street, house 10, apartment 2',
    // Представительство в Астане, по тому же адресу, что и Kazakhstan New
    // Technologies LLP.
    actualAddress:
      'Z05T3E5, город Астана, район Есиль, проспект Мәңгілік Ел, 55/16, блок C3.1, офисы 333/334',
    // Написание проспекта – как у Kazakhstan New Technologies LLP в том же здании.
    actualAddressEn:
      'Z05T3E5, Astana city, Yesil district, Mangilik El Ave., 55/16, block C3.1, offices 333/334',
    phone: '+7 (7172) 73-49-72',
    email: 'info@green-spark.net',
    directorName: 'Танатаров Амир Маратович',
    directorNameShort: 'Танатаров А.М.',
    // Латиница из приказа «Приказ EA Aliya»: «Танатаров А. М. / Amir Tanatarov».
    directorNameEn: 'Amir Tanatarov',
    directorTitle: 'Генеральный директор',
    directorTitleGenitive: 'Генерального директора',
    // Падеж вписан по общему правилу, ждёт подтверждения — Q22.
    directorNameGenitive: 'Танатарова Амира Маратовича',
    // Основание полномочий не прислано. Q22.
    directorBasis: 'Устава',
    // Место составления документов: взят юридический адрес. Если документы
    // составляются в астанинском представительстве — поменяется. Q22.
    // Здесь Жанибек, в присланном приказе «Приказ EA Aliya» — Аксай.
    // Расхождение не решено (docs/questions.md, Q26).
    city: 'Жанибек',
    // Здесь Жанибек, в присланном приказе «Приказ EA Aliya» – Аксай.
    // Расхождение не решено (docs/questions.md, Q26).
    cityKk: 'Жәнібек',
    cityEn: 'Zhanibek',
    // Фирменный цвет и логотип не присланы.
    accent: '#1f6b4a',
    monogram: 'GS',
    logo: greenSparkPowerLogo,
    bank: {
      name: 'АО «Народный Банк Казахстана»',
      bik: 'HSBKKZKX',
      accounts: [
        { iban: 'KZ15601A181017418051', currency: 'KZT' },
        { iban: 'KZ17601A181018104581', currency: 'USD' },
        { iban: 'KZ63601A181017850971', currency: 'EUR' },
      ],
    },
  },
  {
    id: 'c-greensparklimited',
    name: 'ТОО «GREENSPARKLIMITED»',
    nameEn: 'GREENSPARKLIMITED LLP',
    // Из приказов «AL Maksut», «Order EA Дидар Сагын», «unpaid leave Dias».
    // В них наименование пишется с пробелами — «GREEN SPARK LIMITED».
    legalNameKk: 'ЖАУАПКЕРШІЛІГІ ШЕКТЕУЛІ СЕРІКТЕСТІК «GREEN SPARK LIMITED»',
    directorTitleKk: 'Бас Директоры',
    directorTitleEn: 'General Director',
    legalName:
      'Товарищество с ограниченной ответственностью «GREENSPARKLIMITED» (ГРИНСПАРКЛИМИТЕД)',
    legalNameEn: '«GREENSPARKLIMITED» LLP',
    bin: '170340025267',
    postalCode: '090300',
    address:
      'Республика Казахстан, Западно-Казахстанская область, Бурлинский район, город Аксай, Промышленная зона, здание 225Н',
    // Буква в «225Н» прислана кириллической (U+041D) внутри латинской
    // строки. В реквизитах EFFEGI EURASIA — то же здание — она латинская
    // «H», и на вид это одно и то же. Приведено к «225H», чтобы одно
    // здание не значилось в системе двумя разными строками. Сверка — Q22.
    addressEn:
      'West Kazakhstan Region, Burlin district, Aksai city, Industrial Zone, building 225H',
    phone: '+7 (71133) 41-228, вн. 144',
    directorName: 'Самал Кабешова',
    directorNameShort: 'Кабешова С.А.',
    employerCaption: false,
    directorNameEn: 'Samal Kabeshova',
    directorTitle: 'Генеральный директор',
    directorTitleGenitive: 'Генерального директора',
    // Имя прислано в порядке «имя фамилия», в отличие от остальных компаний.
    // «Самал» в русском не склоняется, фамилия склоняется. Ждёт проверки — Q22.
    directorNameGenitive: 'Самал Кабешовой',
    // Основание полномочий не прислано. Q22.
    directorBasis: 'Устава',
    city: 'Аксай',
    cityKk: 'Ақсай',
    cityEn: 'Aksai',
    // Фирменный цвет и логотип не присланы.
    accent: '#3d7a2f',
    monogram: 'GL',
    logo: greenSparkLimitedLogo,
    bank: {
      name: 'АО «Банк ЦентрКредит»',
      bik: 'KCJBKZKX',
      accounts: [
        { iban: 'KZ348562203102127074', currency: 'KZT' },
        { iban: 'KZ878562203202127106', currency: 'USD' },
        { iban: 'KZ078562203202127091', currency: 'EUR' },
      ],
    },
    vat: {
      series: '27001',
      number: '1004155',
      issuedAt: '2017-04-10',
    },
  },
  {
    id: 'c-effegi',
    name: 'ТОО «EFFEGI EURASIA»',
    nameEn: 'EFFEGI EURASIA LLP',
    legalName: 'Товарищество с ограниченной ответственностью «EFFEGI EURASIA»',
    legalNameKk: 'ЖАУАПКЕРШІЛІГІ ШЕКТЕУЛІ СЕРІКТЕСТІК «EFFEGI EURASIA»',
    legalNameEn: '«EFFEGI EURASIA» LLP',
    bin: '250740021286',
    postalCode: '090300',
    // То же здание, что у ТОО «GREENSPARKLIMITED».
    address:
      'Республика Казахстан, Западно-Казахстанская область, Бурлинский район, город Аксай, Промышленная зона, здание 225Н',
    addressEn:
      'West Kazakhstan Region, Aksai, Industrial Zone, building 225H',
    phone: '+7 707 444 15 75',
    email: 'info@effegi.kz',
    directorName: 'Нурдаулет Хамит',
    directorNameShort: 'Хамит Н.',
    directorNameEn: 'Nurdaulet Khamit',
    directorTitle: 'Генеральный директор',
    directorTitleKk: 'Бас директор',
    directorTitleEn: 'General Director',
    directorTitleGenitive: 'Генерального директора',
    // Тот же человек руководит ТОО «ExLumen», но там он записан как
    // «Хамит Нурдаулет Алмазович» — фамилия первой и с отчеством. Падеж
    // вписан по присланному здесь порядку и ждёт сверки — Q23.
    directorNameGenitive: 'Нурдаулета Хамита',
    // Основание полномочий не прислано. Q23.
    directorBasis: 'Устава',
    city: 'Аксай',
    cityKk: 'Ақсай',
    cityEn: 'Aksai',
    // Фирменный цвет и логотип не присланы.
    accent: '#6b2f3b',
    monogram: 'EE',
    logo: effegiLogo,
    bank: {
      name: 'АО «Банк ЦентрКредит»',
      bik: 'KCJBKZKX',
      accounts: [
        { iban: 'KZ308562203148625357', currency: 'KZT' },
        { iban: 'KZ428562203248625739', currency: 'USD' },
        { iban: 'KZ028562203248625780', currency: 'EUR' },
      ],
    },
    vat: {
      series: '27001',
      number: '2002070',
      issuedAt: '2025-07-18',
    },
    headOffice: {
      address: 'Via Lombardia 2/A, 20068 Peschiera Borromeo (MI), Italy',
      phone: '+39 041 54 77 444',
      email: 'effegi@effegigroup.it',
      pec: 'effegisistemiidrodinamicisrl@legalmail.it',
    },
  },
];

export function findCompany(id: string): Company | undefined {
  return companies.find((c) => c.id === id);
}
