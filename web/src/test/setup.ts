/**
 * Подготовка среды тестов.
 *
 * React нужно явно сказать, что он в тестовой среде: иначе `act` работает,
 * но пишет предупреждение в каждый прогон, и настоящие предупреждения в этом
 * шуме теряются.
 */
declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

export {};
