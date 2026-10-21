/**
 * Настройки клиентского кэша.
 *
 * Сроки подобраны по тому, как часто меняются данные: каталог документов —
 * редко, списки — постоянно. Ключи кэша обязаны содержать company_id
 * (CLAUDE.md, п. 3.1), поэтому они собираются в одном месте — queryKeys.
 */
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
