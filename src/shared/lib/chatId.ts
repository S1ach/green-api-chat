/**
 * Единый формат chatId для сравнения.
 *
 * В MAX chatId личного чата — числовая строка ("10000000"), но API и старые данные
 * могут дать то же значение числом, с пробелами или с суффиксом "@c.us"
 * (запасной формат приложения, когда CheckAccount недоступен).
 * Номер телефона и числовой chatId MAX — разные сущности, их этот helper не сопоставляет:
 * для этого есть поиск по номеру в `resolveChatId`.
 */
export function normalizeChatId(chatId: string | number): string {
  return String(chatId)
    .trim()
    .replace(/@c\.us$/i, '');
}

export function isSameChat(a: string | number, b: string | number): boolean {
  return normalizeChatId(a) === normalizeChatId(b);
}
