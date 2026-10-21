/**
 * Расчёт производных цветов от акцента компании.
 *
 * Компания задаёт один цвет, а интерфейсу нужны пять: наведение, нажатие,
 * подложка, линия и цвет текста на акценте. Считаем их здесь, а не просим
 * у компании пять значений: иначе четыре компании неизбежно настроят их
 * вразнобой и получат нечитаемые сочетания.
 */

interface Rgb {
  r: number;
  g: number;
  b: number;
}

function parseHex(hex: string): Rgb {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;

  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16),
  };
}

function toHex({ r, g, b }: Rgb): string {
  const part = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0');
  return `#${part(r)}${part(g)}${part(b)}`;
}

/** Смешивает цвет с чёрным или белым. amount от 0 до 1. */
function mix(color: Rgb, target: Rgb, amount: number): Rgb {
  return {
    r: color.r + (target.r - color.r) * amount,
    g: color.g + (target.g - color.g) * amount,
    b: color.b + (target.b - color.b) * amount,
  };
}

const BLACK: Rgb = { r: 0, g: 0, b: 0 };
const WHITE: Rgb = { r: 255, g: 255, b: 255 };

/**
 * Относительная яркость по WCAG. Нужна, чтобы выбрать цвет текста на акценте:
 * на светлом фирменном цвете белые буквы нечитаемы.
 */
function luminance({ r, g, b }: Rgb): number {
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export interface AccentPalette {
  accent: string;
  hover: string;
  active: string;
  soft: string;
  line: string;
  on: string;
}

export function buildAccentPalette(hex: string): AccentPalette {
  const base = parseHex(hex);

  return {
    accent: toHex(base),
    hover: toHex(mix(base, BLACK, 0.14)),
    active: toHex(mix(base, BLACK, 0.28)),
    soft: toHex(mix(base, WHITE, 0.92)),
    line: toHex(mix(base, WHITE, 0.62)),
    on: luminance(base) > 0.45 ? '#15181d' : '#ffffff',
  };
}
