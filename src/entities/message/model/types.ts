export type MessageDirection = 'incoming' | 'outgoing';

/** Текстовое сообщение чата — внутренняя модель, с которой работает UI. */
export interface Message {
  /** idMessage из GREEN-API: по нему убираются дубли. */
  id: string;
  chatId: string;
  direction: MessageDirection;
  text: string;
  /** Время в миллисекундах. */
  timestamp: number;
}
