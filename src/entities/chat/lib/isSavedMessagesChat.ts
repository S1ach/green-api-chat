import { isSameChat } from '@/shared/lib/chatId';
import type { Chat } from '../model/types';

const SAVED_MESSAGES_TITLE = 'Избранное';

// «Избранное» — чат с самим собой. Пока свой chatId не получен, узнаём по названию
export function isSavedMessagesChat(
  chat: Pick<Chat, 'id' | 'title'>,
  ownChatId: string | null | undefined,
): boolean {
  if (typeof ownChatId === 'string' && isSameChat(ownChatId, chat.id)) {
    return true;
  }
  return chat.title.trim() === SAVED_MESSAGES_TITLE;
}
