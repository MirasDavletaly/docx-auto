import { QueryClientProvider } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { BrowserRouter } from 'react-router-dom';

import { queryClient } from '@/api/queryClient';
import { AppRoutes } from '@/app/router';
import { readLanguage, setLanguage, t } from '@/i18n';
import { SessionProvider, useSession } from '@/store/session';
import { CompanyTheme } from '@/theme/CompanyTheme';

import type { Lang } from '@/i18n';
import type { ReactNode } from 'react';

interface LanguageValue {
  lang: Lang;
  switchTo: (next: Lang) => void;
}

const LanguageContext = createContext<LanguageValue | null>(null);

export function useLanguage(): LanguageValue {
  const value = useContext(LanguageContext);
  if (value === null) throw new Error('useLanguage вызван вне App');
  return value;
}

export function App() {
  const [lang, setLang] = useState<Lang>(readLanguage);

  const switchTo = useCallback((next: Lang) => {
    // Словарь подменяется до перерисовки: компоненты читают `t` во время
    // отрисовки, и к моменту следующего прохода он уже новый.
    setLanguage(next);
    setLang(next);
  }, []);

  const language = useMemo<LanguageValue>(() => ({ lang, switchTo }), [lang, switchTo]);

  // Пароли проверяются через WebCrypto, а браузер даёт его только на
  // защищённых страницах: https:// или localhost. Открытый по http://IP сайт
  // падал бы на первом входе непонятной ошибкой – говорим прямо, в чём дело.
  if (window.isSecureContext === false) {
    return (
      <main className="insecure" lang={lang}>
        <h1>{t.errors.insecureTitle}</h1>
        <p>{t.errors.insecureBody}</p>
      </main>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <LanguageContext.Provider value={language}>
        <SessionProvider>
          <BrowserRouter>
            <ThemeBridge />
            {/* Смена языка перерисовывает экраны, но не пересоздаёт их:
                раньше дерево пересоздавалось по ключу языка, и начатая
                правка (реквизиты, сотрудник, загрузка в архив) пропадала
                при переключении («Тест день 2»). Строки экраны читают из
                `t` при отрисовке, поэтому новой отрисовки достаточно. */}
            <LanguageBoundary lang={lang}>
              <AppRoutes />
            </LanguageBoundary>
          </BrowserRouter>
        </SessionProvider>
      </LanguageContext.Provider>
    </QueryClientProvider>
  );
}

function LanguageBoundary({ lang, children }: { lang: Lang; children: ReactNode }) {
  return (
    <div className="languageRoot" lang={lang}>
      {children}
    </div>
  );
}

/** Отдельный компонент: тема берёт компанию из сессии, а не из пропсов. */
function ThemeBridge() {
  const { company } = useSession();
  return <CompanyTheme company={company} />;
}
