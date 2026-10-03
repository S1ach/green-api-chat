export type MessageDirection = 'incoming' | 'outgoing';

// sending и error — локальные, остальные приходят из MAX
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'error';

export type AttachmentKind =
  'image' | 'video' | 'audio' | 'document' | 'sticker' | 'location' | 'contact' | 'poll';

export interface Attachment {
  kind: AttachmentKind;
  url: string | null;
  name: string | null;
}

export interface Message {
  // idMessage; у ещё не отправленного — временный local-…
  id: string;
  chatId: string;
  direction: MessageDirection;
  text: string;
  // мс
  timestamp: number;
  status?: MessageStatus;
  error?: string;
  attachment?: Attachment;
}

export interface ChatHint {
  name: string | null;
  phone: string | null;
  type: string | null;
}

export interface ReceivedMessage {
  message: Message;
  chat: ChatHint;
}
