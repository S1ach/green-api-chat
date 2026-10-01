import type { Chat } from '../model/types';

/**
 * Служебный бот «MAX» самого мессенджера: сообщения от него только приходят,
 * отвечать ему бессмысленно. Отдельного признака в API нет — узнаём по типу и имени.
 */
export function isReadOnlyChat(chat: Pick<Chat, 'chatType' | 'title'>): boolean {
  return chat.chatType === 'bot' && chat.title.trim() === 'MAX';
}
