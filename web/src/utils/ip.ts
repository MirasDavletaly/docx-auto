/**
 * Проверка записи адреса в списке допуска к админ-панели.
 *
 * Проверяется только запись: адрес IPv4 или IPv6, можно с маской сети
 * («10.0.0.0/8»). Совпадает ли адрес с тем, откуда пришёл человек, решает
 * сервер – браузер своего внешнего адреса не знает.
 */

const IPV4_PART = '(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)';
const IPV4 = new RegExp(`^${IPV4_PART}(\\.${IPV4_PART}){3}(/([0-9]|[12]\\d|3[0-2]))?$`, 'u');

/** IPv6 проверяется грубо: шестнадцатеричные группы через «:», одно «::». */
function isIpv6(raw: string): boolean {
  const [address = '', mask, ...rest] = raw.split('/');
  if (rest.length > 0) return false;
  if (mask !== undefined && !/^(\d|[1-9]\d|1[01]\d|12[0-8])$/u.test(mask)) return false;
  if (!/^[0-9a-f:]+$/iu.test(address) || !address.includes(':')) return false;
  // Сокращение «::» допускается один раз, три двоеточия подряд – нет.
  if (address.includes(':::') || address.split('::').length > 2) return false;
  // Одиночное двоеточие по краю – обрывок, а не сокращение.
  if (/^:[^:]|[^:]:$/u.test(address)) return false;

  const groups = address.split(':').filter((g) => g !== '');
  if (groups.some((g) => g.length > 4)) return false;
  return address.includes('::') ? groups.length < 8 : groups.length === 8;
}

export function isValidAddress(raw: string): boolean {
  const value = raw.trim();
  return IPV4.test(value) || isIpv6(value);
}
