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

/**
 * Служебный бот «MAX» самого мессенджера: сообщения от него только приходят,
 * отвечать ему бессмысленно. Отдельного признака в API нет — узнаём по типу и имени.
 */
export function isReadOnlyChat(chat: { chatType: string | null; title: string }): boolean {
  return chat.chatType === 'bot' && chat.title.trim() === 'MAX';
}

export function isSameChat(a: string | number, b: string | number): boolean {
  return normalizeChatId(a) === normalizeChatId(b);
}
