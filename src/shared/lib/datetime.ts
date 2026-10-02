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

const dayFormatter = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' });
const dayWithYearFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/** Начало суток по местному времени — им сравниваются дни. */
function startOfDay(timestamp: number): number {
  const date = new Date(timestamp);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function isSameDay(a: number, b: number): boolean {
  return startOfDay(a) === startOfDay(b);
}

/** Подпись дня в ленте сообщений: «Сегодня», «Вчера», «12 марта», «12 марта 2024 г.». */
export function formatDay(timestamp: number, now: number = Date.now()): string {
  const days = Math.round((startOfDay(now) - startOfDay(timestamp)) / 86_400_000);
  if (days === 0) {
    return 'Сегодня';
  }
  if (days === 1) {
    return 'Вчера';
  }
  const date = new Date(timestamp);
  return date.getFullYear() === new Date(now).getFullYear()
    ? dayFormatter.format(date)
    : dayWithYearFormatter.format(date);
}
