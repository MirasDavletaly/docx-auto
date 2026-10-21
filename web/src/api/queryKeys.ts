/**
 * Ключи клиентского кэша.
 *
 * Каждый ключ начинается с company_id. Без этого данные одной компании
 * покажутся в другой после переключения — это та же утечка между компаниями,
 * только на стороне браузера (CLAUDE.md, п. 3.1).
 */
export const queryKeys = {
  catalog: (companyId: string) => ['catalog', companyId] as const,
  template: (companyId: string, templateId: string) =>
    ['template', companyId, templateId] as const,
  documents: (companyId: string) => ['documents', companyId] as const,
  document: (companyId: string, documentId: string) =>
    ['document', companyId, documentId] as const,
  directory: (companyId: string) => ['directory', companyId] as const,
} as const;
