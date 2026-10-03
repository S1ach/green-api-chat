import type { Chat } from '../model/types';

// служебный бот MAX, писать ему нельзя. Признака в API нет — смотрим по типу и имени
export function isReadOnlyChat(chat: Pick<Chat, 'chatType' | 'title'>): boolean {
  return chat.chatType === 'bot' && chat.title.trim() === 'MAX';
}
