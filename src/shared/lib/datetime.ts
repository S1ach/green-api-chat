const timeFormatter = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' });
const dateFormatter = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit' });

export function formatTime(timestamp: number): string {
  return timeFormatter.format(new Date(timestamp));
}

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

function startOfDay(timestamp: number): number {
  const date = new Date(timestamp);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function isSameDay(a: number, b: number): boolean {
  return startOfDay(a) === startOfDay(b);
}

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
