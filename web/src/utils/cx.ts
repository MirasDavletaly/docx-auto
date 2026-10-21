/**
 * Склейка имён классов.
 *
 * Нужна из-за строгих настроек TypeScript: обращение к классу CSS-модуля
 * даёт `string | undefined`, а часть свойств React (например className у
 * NavLink) undefined не принимает. Молча ставить `!` в таких местах нельзя —
 * опечатка в имени класса тогда пройдёт незамеченной, и элемент останется
 * без оформления. Здесь undefined просто отбрасывается.
 */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter((p): p is string => typeof p === 'string' && p !== '').join(' ');
}
