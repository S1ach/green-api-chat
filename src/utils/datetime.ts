const timeFormatter = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' });
const dateFormatter = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit' });

/** ЧЧ:ММ для времени сообщения. */
export function formatTime(timestamp: number): string {
  return timeFormatter.format(new Date(timestamp));
}

/** Время для сегодняшних сообщений и дата для остальных — для списка чатов. */
export function formatListStamp(timestamp: number): string {
  const date = new Date(timestamp);
  const today = new Date();
  const sameDay =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();
  return sameDay ? timeFormatter.format(date) : dateFormatter.format(date);
}
