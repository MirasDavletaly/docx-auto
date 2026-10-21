import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from '@/app/App';

import '@/styles/fonts.css';
import '@/theme/tokens.css';
import '@/styles/base.css';
import '@/styles/print.css';

const container = document.getElementById('root');
if (container === null) {
  throw new Error('Не найден корневой элемент #root');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
