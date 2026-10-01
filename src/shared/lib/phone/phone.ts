/** Работа с номерами телефонов: нормализация, отображение, связь с chatId. */

/**
 * Приводит введённый номер к формату GREEN-API (только цифры).
 * Поддерживаются РФ/КЗ (11 цифр, начинается с 7) и РБ (12 цифр, начинается с 375).
 * Возвращает `null`, если номер распознать не удалось.
 */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  if (digits === '') {
    return null;
  }

  // 8 (999) 123-45-67 → 79991234567
  const withCountryCode =
    digits.length === 11 && digits.startsWith('8')
      ? `7${digits.slice(1)}`
      : digits.length === 10
        ? `7${digits}`
        : digits;

  if (withCountryCode.length === 11 && withCountryCode.startsWith('7')) {
    return withCountryCode;
  }
  if (withCountryCode.length === 12 && withCountryCode.startsWith('375')) {
    return withCountryCode;
  }
  return null;
}

/** Номер для показа в интерфейсе: +7 (999) 123-45-67. */
export function formatPhone(phone: string): string {
  if (phone.length === 11 && phone.startsWith('7')) {
    return `+7 (${phone.slice(1, 4)}) ${phone.slice(4, 7)}-${phone.slice(7, 9)}-${phone.slice(9)}`;
  }
  return `+${phone}`;
}

/** Запасной chatId, если CheckAccount недоступен. */
export function fallbackChatId(phone: string): string {
  return `${phone}@c.us`;
}

/** Достаёт номер из chatId вида "79991234567@c.us"; для числовых chatId вернёт null. */
export function phoneFromChatId(chatId: string): string | null {
  const match = /^(\d{10,15})@c\.us$/.exec(chatId);
  return match ? (match[1] ?? null) : null;
}
