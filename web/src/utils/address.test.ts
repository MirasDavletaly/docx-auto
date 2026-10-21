import { describe, expect, it } from 'vitest';

import { englishAddress } from './address';

describe('адрес на английском, если его нет в карточке', () => {
  it.each([
    [
      'Республика Казахстан, город Атырау, улица Бактыгерей Кулманов, строение 113В',
      'Republic of Kazakhstan, Atyrau city, Baktygerei Kulmanov street, building 113B',
    ],
    [
      'Западно-Казахстанская область, Бурлинский район, город Аксай, 5 микрорайон, дом 20, квартира 113',
      'West Kazakhstan region, Burlin district, Aksai city, microdistrict 5, house 20, apartment 113',
    ],
    ['город Аксай, проспект Абая, 20, офис 1', 'Aksai city, Abaya Ave., 20, office 1'],
    [
      'Z05T3E5, город Астана, район Есиль, проспект Мәңгілік Ел, 55/16, блок C3.1, офисы 333/334',
      'Z05T3E5, Astana city, Esil district, Mangilik El Ave., 55/16, block C3.1, offices 333/334',
    ],
    ['Атырауская область, село Жанибек', 'Atyrau region, Zhanibek village'],
  ])('«%s»', (ru, en) => {
    expect(englishAddress(ru)).toBe(en);
  });
});
