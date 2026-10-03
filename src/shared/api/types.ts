export interface Credentials {
  apiUrl: string;
  mediaUrl?: string;
  idInstance: string;
  apiTokenInstance: string;
}

export interface SendMessageRequest {
  chatId: string;
  message: string;
}

export interface SendFileRequest {
  chatId: string;
  file: File;
  caption: string;
}

export interface SendLocationRequest {
  chatId: string;
  latitude: number;
  longitude: number;
}

export interface SendContactRequest {
  chatId: string;
  contactChatId: string;
}

export interface RemoteContact {
  chatId: string;
  name: string;
  // null, если номер скрыт
  phone: string | null;
}

export interface ChatHistoryRequest {
  chatId: string;
  count: number;
}

export interface JournalRequest {
  minutes: number;
}

export interface RemoteChat {
  chatId: string;
  name: string;
  type: string | null;
  phone: string | null;
}

export interface InstanceSettings {
  // должен быть пустым, иначе очередь HTTP API не работает
  webhookUrl: string;
  incomingWebhook: string;
  outgoingWebhook: string;
  outgoingMessageWebhook: string;
}

export type InstanceSettingsPatch = Partial<
  Record<'incomingWebhook' | 'outgoingWebhook' | 'outgoingMessageWebhook', 'yes' | 'no'>
>;
