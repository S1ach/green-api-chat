/** Учётные данные инстанса GREEN-API. */
export interface Credentials {
  apiUrl: string;
  /**
   * Хост для отправки файлов из личного кабинета GREEN-API. Необязателен:
   * без него файлы отправляются через apiUrl.
   */
  mediaUrl?: string;
  idInstance: string;
  apiTokenInstance: string;
}

/** Тело запроса SendMessage. */
export interface SendMessageRequest {
  chatId: string;
  message: string;
}

/** Параметры SendFileByUpload: файл уходит формой multipart/form-data. */
export interface SendFileRequest {
  chatId: string;
  file: File;
  /** Подпись к файлу; пустая строка — без подписи. */
  caption: string;
}

/** Тело запроса SendLocation. */
export interface SendLocationRequest {
  chatId: string;
  latitude: number;
  longitude: number;
}

/** Параметры SendContact: контакт должен быть в списке контактов инстанса (GetContacts). */
export interface SendContactRequest {
  chatId: string;
  /** chatId контакта, которым делятся. */
  contactChatId: string;
}

/** Элемент ответа GetContacts, приведённый к удобному виду. */
export interface RemoteContact {
  chatId: string;
  /** Имя из записной книжки либо из профиля; пустая строка, если API его не отдал. */
  name: string;
  /** Номер телефона или `null`, если он скрыт (в API приходит 0). */
  phone: string | null;
}

/** Тело запроса GetChatHistory. */
export interface ChatHistoryRequest {
  chatId: string;
  /** Сколько последних сообщений вернуть. */
  count: number;
}

/** Параметры журналов LastIncomingMessages / LastOutgoingMessages. */
export interface JournalRequest {
  /** За сколько последних минут вернуть сообщения. */
  minutes: number;
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
  /** "yes" — приходят статусы отправленных сообщений (доставлено, прочитано). */
  outgoingWebhook: string;
  /** "yes" — приходят сообщения, отправленные с телефона и из других клиентов MAX. */
  outgoingMessageWebhook: string;
}

/** Настройки для SetSettings: передаются выборочно, остальные не меняются. */
export type InstanceSettingsPatch = Partial<
  Record<'incomingWebhook' | 'outgoingWebhook' | 'outgoingMessageWebhook', 'yes' | 'no'>
>;

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
