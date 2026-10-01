/**
 * Публичный API сущности message специально для сущности chat (FSD cross-import, `@x`):
 * состояние чатов хранит сообщения, поэтому ему нужны их тип и слияние без дублей.
 */
export type { Message } from '../model/types';
export { mergeMessages } from '../lib/history';
export type { IncomingTextMessage } from '../lib/notification';
