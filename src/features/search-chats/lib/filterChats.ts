import type { Chat } from '@/entities/chat';

/** Регистр и «ё» не должны мешать поиску: «Семён» находится по «семен». */
function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/ё/g, 'е');
}

/** Запрос похож на номер телефона: только цифры и знаки форматирования. */
const PHONE_QUERY = /^[\d\s()+-]+$/;

function matchesPhone(phone: string, query: string): boolean {
  const digits = query.replace(/\D/g, '');
  if (digits === '') {
    return false;
  }
  // Номера хранятся с кодом страны (79991234567), а ищут их и как «8 999…».
  return (
    phone.includes(digits) || (digits.startsWith('8') && phone.startsWith(`7${digits.slice(1)}`))
  );
}

/**
 * Поиск по списку чатов: по имени собеседника и по номеру телефона.
 * Номер можно вводить в любом виде — `+7 999`, `8 (999)`, `999 123`.
 * Пустой запрос возвращает список без изменений; порядок чатов сохраняется.
 */
export function filterChats(chats: Chat[], query: string): Chat[] {
  const text = normalize(query);
  if (text === '') {
    return chats;
  }
  const isPhoneQuery = PHONE_QUERY.test(text);

  return chats.filter(
    (chat) =>
      normalize(chat.title).includes(text) ||
      (isPhoneQuery && chat.phone !== null && matchesPhone(chat.phone, text)),
  );
}
