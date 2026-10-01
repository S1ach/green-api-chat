import { describe, expect, it } from 'vitest';
import { isSameChat, normalizeChatId } from './chatId';

describe('normalizeChatId', () => {
  it('приводит разные записи одного чата к общему виду', () => {
    expect(normalizeChatId(' 10000000 ')).toBe('10000000');
    expect(normalizeChatId(10000000)).toBe('10000000');
    expect(isSameChat('79991234567@c.us', '79991234567')).toBe(true);
    expect(isSameChat('10000000', '79991234567')).toBe(false);
  });
});
