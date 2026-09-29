export type MessageDirection = 'incoming' | 'outgoing';

export type MessageStatus = 'sending' | 'sent' | 'error';

export interface ChatMessage {
  /** Локальный идентификатор; для отправленных заменяется на idMessage из API. */
  id: string;
  chatId: string;
  direction: MessageDirection;
  text: string;
  /** Время в миллисекундах. */
  timestamp: number;
  status: MessageStatus;
  error?: string;
}

export interface Chat {
  /** chatId из CheckAccount (числовой) либо "номер@c.us". */
  id: string;
  /** Нормализованный номер, если известен. */
  phone: string | null;
  title: string;
  unreadCount: number;
  lastActivity: number;
  lastPreview: string;
}
