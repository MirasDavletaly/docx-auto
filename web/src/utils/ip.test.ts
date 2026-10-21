import { describe, expect, it } from 'vitest';

import { isValidAddress } from './ip';

describe('адрес в списке допуска', () => {
  it.each(['203.0.113.7', '10.0.0.0/8', '192.168.1.0/24', '2001:db8::1', '::1', 'fe80::/10'])(
    '«%s» записан верно',
    (ip) => {
      expect(isValidAddress(ip)).toBe(true);
    },
  );

  it.each(['256.1.1.1', '1.2.3', '10.0.0.0/33', 'офис', '2001:db8:::1', '1.2.3.4/8/8', ''])(
    '«%s» записан неверно',
    (ip) => {
      expect(isValidAddress(ip)).toBe(false);
    },
  );
});
