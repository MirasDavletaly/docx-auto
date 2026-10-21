/**
 * Разделы каталога.
 *
 * Повторяет catalog/sections.yaml. Когда появится эндпоинт каталога, этот
 * файл уйдёт: сайт получит те же данные с сервера, уже отфильтрованные
 * по правам пользователя.
 */
import type { Section } from '@/api/types';

export const sections: Section[] = [
  {
    id: 'hr',
    title: 'Отдел кадров',
    short: 'Кадры',
    subsections: [
      { id: 'hr-personnel-orders', title: 'Приказы по личному составу' },
      { id: 'hr-activity-orders', title: 'Приказы по основной деятельности' },
      { id: 'hr-documents', title: 'Кадровые документы' },
      { id: 'hr-policies', title: 'Локальные акты' },
    ],
  },
  {
    id: 'legal',
    title: 'Юридический отдел',
    short: 'Юристы',
    subsections: [
      { id: 'legal-contracts', title: 'Договоры' },
      { id: 'legal-claims', title: 'Претензионная и судебная работа' },
      { id: 'legal-powers', title: 'Доверенности' },
      { id: 'legal-other', title: 'Прочее' },
    ],
  },
  {
    id: 'corporate',
    title: 'Корпоративное управление',
    short: 'Корпоративное',
    subsections: [
      { id: 'corporate-founding', title: 'Учредительные документы' },
      { id: 'corporate-decisions', title: 'Решения органов управления' },
      { id: 'corporate-policies', title: 'Внутренние положения' },
      { id: 'corporate-orders', title: 'Приказы руководителя' },
    ],
  },
  {
    id: 'finance',
    title: 'Финансы и бухгалтерия',
    short: 'Финансы',
    subsections: [
      { id: 'finance-orders', title: 'Приказы' },
      { id: 'finance-primary', title: 'Первичные документы' },
      { id: 'finance-planning', title: 'Планирование и казначейство' },
      { id: 'finance-reporting', title: 'Отчётность и регистры' },
      { id: 'finance-policies', title: 'Положения' },
    ],
  },
  {
    id: 'procurement-sales',
    title: 'Закупки и продажи',
    short: 'Закупки',
    subsections: [
      { id: 'procurement', title: 'Закупки и снабжение' },
      { id: 'sales', title: 'Продажи' },
    ],
  },
  {
    id: 'warehouse',
    title: 'Склад и логистика',
    short: 'Склад',
    subsections: [],
  },
  {
    id: 'administration',
    title: 'Административно-хозяйственный отдел',
    short: 'АХО',
    subsections: [
      { id: 'administration-records', title: 'Делопроизводство' },
      { id: 'administration-facilities', title: 'Хозяйственная часть' },
    ],
  },
  {
    id: 'projects',
    title: 'Проекты',
    short: 'Проекты',
    subsections: [
      { id: 'projects-initiation', title: 'Инициация' },
      { id: 'projects-planning', title: 'Планирование' },
      { id: 'projects-execution', title: 'Исполнение и контроль' },
      { id: 'projects-closing', title: 'Закрытие' },
      { id: 'projects-construction', title: 'Строительные и инженерные проекты' },
      { id: 'projects-policies', title: 'Положения' },
    ],
  },
  {
    id: 'it-security',
    title: 'ИТ и информационная безопасность',
    short: 'ИТ и ИБ',
    subsections: [
      { id: 'it', title: 'ИТ' },
      { id: 'security', title: 'Информационная безопасность' },
    ],
  },
  {
    id: 'hse',
    title: 'Охрана труда и экология',
    short: 'HSE',
    subsections: [
      { id: 'hse-general', title: 'Общие документы' },
      { id: 'hse-labour', title: 'Охрана труда' },
      { id: 'hse-incidents', title: 'Несчастные случаи и происшествия' },
      { id: 'hse-fire', title: 'Пожарная и промышленная безопасность' },
      { id: 'hse-ecology', title: 'Экология' },
    ],
  },
  {
    id: 'marketing',
    title: 'Маркетинг',
    short: 'Маркетинг',
    subsections: [],
  },
];

export function findSection(id: string): Section | undefined {
  return sections.find((s) => s.id === id);
}
