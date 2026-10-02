import { describe, expect, it } from 'vitest';
import { fallbackChatId, formatPhone, normalizePhone, phoneFromChatId } from './phone';

describe('normalizePhone', () => {
  it.each([
    '+79991234567',
    '79991234567',
    '89991234567',
    '8 (999) 123-45-67',
    '+7 999 123 45 67',
    '  +7 (999) 123-45-67  ',
  ])('приводит «%s» к формату GREEN-API', (input) => {
    expect(normalizePhone(input)).toBe('79991234567');
  });

  it('убирает форматирование и оставляет только цифры', () => {
    expect(normalizePhone('+7 (999) 123-45-67')).toBe('79991234567');
  });

  it('заменяет ведущую восьмёрку на семёрку', () => {
    expect(normalizePhone('8 999 123 45 67')).toBe('79991234567');
  });

  it('дополняет десятизначный номер кодом страны', () => {
    expect(normalizePhone('9991234567')).toBe('79991234567');
  });

  it('поддерживает белорусские номера', () => {
    expect(normalizePhone('+375 29 123-45-67')).toBe('375291234567');
  });

  it('возвращает null для пустой строки и некорректной длины', () => {
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone('   ')).toBeNull();
    expect(normalizePhone('123')).toBeNull();
    expect(normalizePhone('+1 202 555 0143')).toBeNull();
  });
});

describe('formatPhone', () => {
  it('форматирует российский номер', () => {
    expect(formatPhone('79991234567')).toBe('+7 (999) 123-45-67');
  });

  it('для остальных номеров добавляет только плюс', () => {
    expect(formatPhone('375291234567')).toBe('+375291234567');
  });
});

describe('chatId и номер', () => {
  it('строит запасной chatId', () => {
    expect(fallbackChatId('79991234567')).toBe('79991234567@c.us');
  });

  it('достаёт номер из chatId вида номер@c.us', () => {
    expect(phoneFromChatId('79991234567@c.us')).toBe('79991234567');
  });

  it('не принимает числовой chatId MAX за номер', () => {
    expect(phoneFromChatId('10000000')).toBeNull();
  });
});
