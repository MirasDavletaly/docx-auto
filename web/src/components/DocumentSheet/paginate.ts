/**
 * Раскладка документа по листам A4.
 *
 * Документ режется на куски – блок бланка или строка таблицы – и куски
 * по порядку укладываются на лист, пока помещаются. Не поместился – новый
 * лист, как в Word («Тест день 2»: «если на один лист не вмещается, создать
 * вторую страницу A4»).
 *
 * Строка тела приказа может быть длиннее остатка листа. Тогда она, как в
 * Word, разрывается: верх остаётся на этом листе, продолжение уходит на
 * следующий. Резать можно только между строками текста (`cuts`), чтобы ни
 * одна строка не разошлась пополам. Остальные блоки – подпись, шапку, лист
 * ознакомления – не режем: они переносятся целиком.
 */

/** Высота поля для текста на листе: 297 мм минус поля по 12,7 мм сверху и снизу. */
export const PAGE_CONTENT_MM = 297 - 2 * 12.7;

/** То же на альбомном листе: высота листа – 210 мм (накладная З-2, КП). */
export const PAGE_CONTENT_LANDSCAPE_MM = 210 - 2 * 12.7;

/** Миллиметры в CSS-пикселях: в CSS дюйм – ровно 96 пикселей и 25,4 мм. */
export const PX_PER_MM = 96 / 25.4;

/**
 * Место, где кусок можно разорвать: `at` – низ строки текста, `resume` –
 * верх следующей строки, с которой продолжается следующий лист.
 */
export interface Cut {
  at: number;
  resume: number;
}

export interface Piece {
  height: number;
  /** Где кусок можно разорвать. Нет – кусок переносится только целиком. */
  cuts?: Cut[];
}

/** Часть куска на листе: от `from` до `to` пикселей от верха куска. */
export interface Slice {
  index: number;
  from: number;
  to: number;
}

/**
 * Раскладка кусков по листам.
 *
 * Нулевые высоты (разметка ещё не посчитана, или это тест без раскладки)
 * дают один лист: лучше показать всё на одном, чем разрезать наугад.
 * Кусок выше листа, который резать нельзя, занимает свой лист целиком –
 * лист вытягивается, а не обрезает текст.
 */
export function layoutPages(pieces: Piece[], pageHeight: number): Slice[][] {
  const pages: Slice[][] = [];
  let current: Slice[] = [];
  let used = 0;

  const nextPage = () => {
    pages.push(current);
    current = [];
    used = 0;
  };

  pieces.forEach((piece, index) => {
    let from = 0;

    for (;;) {
      const rest = piece.height - from;
      const room = pageHeight - used;

      if (rest <= room) {
        current.push({ index, from, to: piece.height });
        used += rest;
        return;
      }

      // Не помещается. Можно ли разорвать так, чтобы хоть одна строка
      // осталась на этом листе?
      const cut = (piece.cuts ?? [])
        .filter((c) => c.at > from && c.at - from <= room && c.resume < piece.height)
        .at(-1);

      if (cut !== undefined) {
        current.push({ index, from, to: cut.at });
        nextPage();
        from = cut.resume;
        continue;
      }

      if (current.length === 0) {
        // Лист пустой, а кусок всё равно не лезет и не режется: ставим
        // целиком, лист вытянется.
        current.push({ index, from, to: piece.height });
        used += rest;
        return;
      }

      nextPage();
    }
  });

  if (current.length > 0 || pages.length === 0) pages.push(current);
  return pages;
}

/** Та же раскладка – чтобы не перерисовывать лист без причины. */
export function sameLayout(a: Slice[][] | null, b: Slice[][]): boolean {
  if (a === null || a.length !== b.length) return false;
  return a.every((page, i) => {
    const other = b[i];
    return (
      other !== undefined &&
      page.length === other.length &&
      page.every(
        (s, j) =>
          s.index === other[j]?.index &&
          Math.abs(s.from - (other[j]?.from ?? 0)) < 0.5 &&
          Math.abs(s.to - (other[j]?.to ?? 0)) < 0.5,
      )
    );
  });
}

/**
 * Где можно разорвать кусок: по низу строк текста, через которые не
 * проходит ни одна другая строка – ни в этой колонке, ни в соседних.
 *
 * `lines` – строки текста куска (верх и низ от верха куска).
 *
 * Считается на каждое нажатие клавиши в форме, а строк в длинном приказе –
 * сотни, поэтому проход один: кандидаты идут по возрастанию, и всё, что
 * нужно про остальные строки, ведётся на ходу (12.10: перебор каждой строки
 * против каждой давал до четверти секунды на нажатие). Результат тот же,
 * что у прямого перебора, – это проверяет тест.
 */
export function cutsBetweenLines(lines: Array<{ top: number; bottom: number }>): Cut[] {
  const byBottom = [...lines].sort((a, b) => a.bottom - b.bottom);
  const byTop = [...lines].sort((a, b) => a.top - b.top);
  const cuts: Cut[] = [];

  // Строки, начавшиеся выше кандидата, и самый низкий низ среди них: через
  // кандидата проходит строка, если этот низ ниже его.
  let started = 0;
  let lowest = Number.NEGATIVE_INFINITY;

  for (const line of byBottom) {
    const at = line.bottom;
    for (; started < byTop.length; started++) {
      const other = byTop[started];
      if (other === undefined || other.top >= at - 0.5) break;
      lowest = Math.max(lowest, other.bottom);
    }
    const crossed = lowest > at + 0.5;
    // Разрывы идут по возрастанию: ближайший к кандидату – последний.
    const last = cuts[cuts.length - 1];
    if (crossed || (last !== undefined && Math.abs(last.at - at) < 0.5)) continue;

    // Первая строка, начавшаяся не выше кандидата, – с неё продолжение.
    cuts.push({ at, resume: byTop[firstTopFrom(byTop, at - 0.5)]?.top ?? at });
  }

  return cuts;
}

/** Номер первой строки (по верху), начинающейся не выше `top`. */
function firstTopFrom(byTop: Array<{ top: number }>, top: number): number {
  let low = 0;
  let high = byTop.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if ((byTop[middle]?.top ?? Number.POSITIVE_INFINITY) >= top) high = middle;
    else low = middle + 1;
  }
  return low;
}
