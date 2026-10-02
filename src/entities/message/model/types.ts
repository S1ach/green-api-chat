export type MessageDirection = 'incoming' | 'outgoing';

/**
 * Состояние исходящего сообщения.
 * `sending` и `error` — локальные (сообщение ещё не принято GREEN-API или отклонено),
 * `sent`, `delivered`, `read` — статусы MAX из истории и уведомлений.
 */
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'error';

export type AttachmentKind =
  'image' | 'video' | 'audio' | 'document' | 'sticker' | 'location' | 'contact' | 'poll';

/** Вложение сообщения. Сами файлы приложение не показывает — только что они есть и где открыть. */
export interface Attachment {
  kind: AttachmentKind;
  /** Ссылка на файл или на карту с геопозицией; `null`, если её нет (контакт, опрос). */
  url: string | null;
  /** Подпись под названием вложения: имя файла, имя контакта, координаты. */
  name: string | null;
}

/** Сообщение чата — внутренняя модель, с которой работает UI. */
export interface Message {
  /**
   * idMessage из GREEN-API: по нему убираются дубли. У сообщения, которое ещё отправляется,
   * здесь временный локальный идентификатор — после ответа API он заменяется на idMessage.
   */
  id: string;
  chatId: string;
  direction: MessageDirection;
  /** Текст либо подпись к вложению; может быть пустым, если есть вложение. */
  text: string;
  /** Время в миллисекундах. */
  timestamp: number;
  /** Только у исходящих. */
  status?: MessageStatus;
  /** Почему сообщение не отправлено — при `status: 'error'`. */
  error?: string;
  attachment?: Attachment;
}

/** Что известно о чате из самого сообщения: хватит, чтобы завести чат, которого ещё нет в списке. */
export interface ChatHint {
  name: string | null;
  phone: string | null;
  /** user, group, channel, bot. */
  type: string | null;
}

/** Сообщение, полученное из GREEN-API, вместе со сведениями о его чате. */
export interface ReceivedMessage {
  message: Message;
  chat: ChatHint;
}
