/** Учётные данные инстанса GREEN-API. */
export interface Credentials {
  apiUrl: string;
  idInstance: string;
  apiTokenInstance: string;
}

/** Ответ getStateInstance. */
export interface StateInstanceResponse {
  stateInstance: string;
}

/** Ответ CheckAccount, когда инстанс готов. */
export interface CheckAccountResult {
  exist: boolean;
  chatId: string;
  fromCache?: boolean;
}

/** Ответ CheckAccount, когда инстанс ещё не авторизован. */
export interface CheckAccountNotReady {
  status: false;
  reason: string;
}

export type CheckAccountResponse = CheckAccountResult | CheckAccountNotReady;

/** Ответ SendMessage. */
export interface SendMessageResponse {
  idMessage: string;
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

/** Ответ ReceiveNotification: либо `null` (очередь пуста), либо конверт с квитанцией. */
export interface NotificationEnvelope {
  receiptId: number;
  /** Тело уведомления приходит нетипизированным — разбирается в `utils/notification.ts`. */
  body: unknown;
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

/** Уведомление о входящем сообщении (typeWebhook === 'incomingMessageReceived'). */
export interface IncomingMessageWebhook {
  typeWebhook: 'incomingMessageReceived';
  instanceData: InstanceData;
  timestamp: number;
  idMessage: string;
  senderData: SenderData;
  messageData: MessageData;
}
