import type { Message } from '@/entities/message';
import { formatDay, isSameDay } from '@/shared/lib/datetime';

/** Сообщения одного автора, идущие с меньшим разрывом, выглядят одной серией. */
const GROUP_GAP_MS = 5 * 60_000;

export interface MessageRow {
  message: Message;
  /** Подпись дня перед сообщением — у первого сообщения каждого дня. */
  dayLabel: string | null;
  /** Последнее сообщение серии: у него «хвостик» и отступ до следующей серии. */
  isGroupEnd: boolean;
}

/**
 * Раскладывает ленту на строки: где поставить разделитель дня и где заканчивается серия
 * сообщений одного автора. Серию обрывает смена автора, новый день или пауза дольше 5 минут.
 */
export function toMessageRows(messages: Message[], now: number = Date.now()): MessageRow[] {
  return messages.map((message, index) => {
    const previous = messages[index - 1];
    const next = messages[index + 1];

    return {
      message,
      dayLabel:
        previous === undefined || !isSameDay(previous.timestamp, message.timestamp)
          ? formatDay(message.timestamp, now)
          : null,
      isGroupEnd:
        next === undefined ||
        next.direction !== message.direction ||
        next.timestamp - message.timestamp > GROUP_GAP_MS ||
        !isSameDay(next.timestamp, message.timestamp),
    };
  });
}
