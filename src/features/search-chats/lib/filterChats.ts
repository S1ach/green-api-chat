import type { Chat } from '@/entities/chat';

// «Семён» должен находиться по «семен»
function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/ё/g, 'е');
}

const PHONE_QUERY = /^[\d\s()+-]+$/;

function matchesPhone(phone: string, query: string): boolean {
  const digits = query.replace(/\D/g, '');
  if (digits === '') {
    return false;
  }
  // номера хранятся как 7999…, а ищут и как 8 999…
  return (
    phone.includes(digits) || (digits.startsWith('8') && phone.startsWith(`7${digits.slice(1)}`))
  );
}

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
