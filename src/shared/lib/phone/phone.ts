// РФ/КЗ (7…) и РБ (375…), остальное не распознаём
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  if (digits === '') {
    return null;
  }

  const withCountryCode = addCountryCode(digits);

  if (withCountryCode.length === 11 && withCountryCode.startsWith('7')) {
    return withCountryCode;
  }
  if (withCountryCode.length === 12 && withCountryCode.startsWith('375')) {
    return withCountryCode;
  }
  return null;
}

// местная запись без кода страны. Код оператора в Беларуси начинается с нуля,
// в России и Казахстане — никогда, по нему и различаем
function addCountryCode(digits: string): string {
  // 8 029 123-45-67 → 375291234567
  if (digits.length === 11 && digits.startsWith('80')) {
    return `375${digits.slice(2)}`;
  }
  // 029 123-45-67 → 375291234567
  if (digits.length === 10 && digits.startsWith('0')) {
    return `375${digits.slice(1)}`;
  }
  // 8 (999) 123-45-67 → 79991234567
  if (digits.length === 11 && digits.startsWith('8')) {
    return `7${digits.slice(1)}`;
  }
  if (digits.length === 10) {
    return `7${digits}`;
  }
  return digits;
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
