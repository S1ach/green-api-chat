// РФ/КЗ (7…) и РБ (375…), остальное не распознаём
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

export function formatPhone(phone: string): string {
  if (phone.length === 11 && phone.startsWith('7')) {
    return `+7 (${phone.slice(1, 4)}) ${phone.slice(4, 7)}-${phone.slice(7, 9)}-${phone.slice(9)}`;
  }
  return `+${phone}`;
}

export function fallbackChatId(phone: string): string {
  return `${phone}@c.us`;
}

export function phoneFromChatId(chatId: string): string | null {
  const match = /^(\d{10,15})@c\.us$/.exec(chatId);
  return match ? (match[1] ?? null) : null;
}
