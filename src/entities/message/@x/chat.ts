/**
 * Публичный API сущности message специально для сущности chat (FSD cross-import, `@x`):
 * состояние чатов хранит сообщения, поэтому ему нужны их тип, порядок и слияние без дублей.
 */
export type { Attachment, ChatHint, Message, MessageStatus, ReceivedMessage } from '../model/types';
export { previewText } from '../lib/content';
export { mergeMessages } from '../lib/history';
