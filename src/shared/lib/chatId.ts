// chatId может прийти числом, с пробелами или с @c.us
export function normalizeChatId(chatId: string | number): string {
  return String(chatId)
    .trim()
    .replace(/@c\.us$/i, '');
}

export function isSameChat(a: string | number, b: string | number): boolean {
  return normalizeChatId(a) === normalizeChatId(b);
}
