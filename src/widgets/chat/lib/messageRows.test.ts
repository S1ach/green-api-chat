import { describe, expect, it } from 'vitest';
import type { Message } from '@/entities/message';
import { toMessageRows } from './messageRows';

const NOW = new Date(2025, 2, 12, 15, 0).getTime();
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

function message(
  id: string,
  timestamp: number,
  direction: Message['direction'] = 'incoming',
): Message {
  return { id, chatId: '1', direction, text: id, timestamp };
}

describe('toMessageRows', () => {
  it('ставит разделитель перед первым сообщением каждого дня', () => {
    const rows = toMessageRows(
      [
        message('a', NOW - 40 * DAY),
        message('b', NOW - DAY),
        message('c', NOW - DAY + MINUTE),
        message('d', NOW - MINUTE),
      ],
      NOW,
    );

    expect(rows.map((row) => row.dayLabel)).toEqual(['31 января', 'Вчера', null, 'Сегодня']);
  });

  it('пишет год, если сообщение не из текущего года', () => {
    const [row] = toMessageRows([message('a', new Date(2024, 11, 31, 12).getTime())], NOW);

    expect(row?.dayLabel).toMatch(/31 декабря 2024/);
  });

  it('объединяет в серию соседние сообщения одного автора', () => {
    const rows = toMessageRows(
      [
        message('a', NOW - 10 * MINUTE),
        message('b', NOW - 9 * MINUTE),
        message('c', NOW - 8 * MINUTE, 'outgoing'),
        message('d', NOW - 7 * MINUTE, 'outgoing'),
      ],
      NOW,
    );

    // Серию заканчивает последнее сообщение автора: у него «хвостик».
    expect(rows.map((row) => row.isGroupEnd)).toEqual([false, true, false, true]);
  });

  it('разрывает серию паузой дольше пяти минут и сменой дня', () => {
    const yesterdayEvening = new Date(2025, 2, 11, 23, 59).getTime();
    const rows = toMessageRows(
      [
        message('a', yesterdayEvening),
        message('b', yesterdayEvening + 2 * MINUTE),
        message('c', NOW - 20 * MINUTE),
        message('d', NOW - MINUTE),
      ],
      NOW,
    );

    expect(rows.map((row) => row.isGroupEnd)).toEqual([true, true, true, true]);
  });

  it('возвращает пустой список для пустой ленты', () => {
    expect(toMessageRows([], NOW)).toEqual([]);
  });
});
