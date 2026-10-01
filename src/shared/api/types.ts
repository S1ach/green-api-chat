/** Учётные данные инстанса GREEN-API. */
export interface Credentials {
  apiUrl: string;
  idInstance: string;
  apiTokenInstance: string;
}

/** Тело запроса SendMessage. */
export interface SendMessageRequest {
  chatId: string;
  message: string;
}

/** Тело запроса GetChatHistory. */
export interface ChatHistoryRequest {
  chatId: string;
  /** Сколько последних сообщений вернуть. */
  count: number;
}

/** Элемент ответа GetChats, приведённый к удобному виду. */
export interface RemoteChat {
  chatId: string;
  /** Имя чата; пустая строка, если API его не отдал. */
  name: string;
  /** user, group, channel или bot; `null`, если API его не отдал. */
  type: string | null;
  /** Номер телефона или `null`, если он скрыт (в API приходит 0). */
  phone: string | null;
}

/** Настройки инстанса (GetSettings), от которых зависит приём уведомлений. */
export interface InstanceSettings {
  /** Должен быть пустым при приёме через HTTP API (ReceiveNotification). */
  webhookUrl: string;
  /** "yes" — входящие сообщения попадают в очередь уведомлений. */
  incomingWebhook: string;
}

export interface InstanceData {
  idInstance: number;
  wid: string;
  typeInstance: string;
}

export interface SenderData {
  chatId: string;
  chatName?: string;
  chatType?: string;
  sender?: string;
  senderName?: string;
  senderType?: string;
  senderContactName?: string;
  senderPhoneNumber?: number;
}

export interface TextMessageData {
  textMessage: string;
  isForwarded?: boolean;
  forwardingScore?: number;
}

export interface ExtendedTextMessageData {
  text: string;
  description?: string;
  title?: string;
  previewType?: string;
  jpegThumbnail?: string;
  forwardingScore?: number;
  isForwarded?: boolean;
}

export interface MessageData {
  typeMessage: string;
  textMessageData?: TextMessageData;
  extendedTextMessageData?: ExtendedTextMessageData;
}

/**
 * Уведомление о входящем сообщении (typeWebhook === 'incomingMessageReceived').
 * Так выглядит `body` из ReceiveNotification по документации; в рантайме тело
 * приходит нетипизированным и проверяется по полям в `entities/message`.
 */
export interface IncomingMessageWebhook {
  typeWebhook: 'incomingMessageReceived';
  instanceData: InstanceData;
  timestamp: number;
  idMessage: string;
  senderData: SenderData;
  messageData: MessageData;
}
