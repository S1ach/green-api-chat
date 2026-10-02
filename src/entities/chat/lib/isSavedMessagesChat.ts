import { isSameChat } from '@/shared/lib/chatId';
import type { Chat } from '../model/types';

/** Так чат с самим собой называет MAX. */
const SAVED_MESSAGES_TITLE = 'Избранное';

/**
 * «Избранное» — чат аккаунта с самим собой. Основной признак — chatId самого аккаунта
 * из GetAccountSettings. Пока он не получен (или API его не отдал), узнаём чат по имени,
 * под которым его отдаёт GetChats.
 */
export function isSavedMessagesChat(
  chat: Pick<Chat, 'id' | 'title'>,
  ownChatId: string | null | undefined,
): boolean {
  if (typeof ownChatId === 'string' && isSameChat(ownChatId, chat.id)) {
    return true;
  }
  return chat.title.trim() === SAVED_MESSAGES_TITLE;
}
