import {
  messageQueued,
  messageRetried,
  messageSendFailed,
  messageSendSucceeded,
  selectMessages,
} from '@/entities/chat';
import { getApiErrorMessage, greenApi } from '@/shared/api';
import type { AppThunk } from '@/shared/lib/store';

let sequence = 0;

/** Временный идентификатор сообщения до ответа SendMessage. */
function createLocalId(): string {
  sequence += 1;
  return `local-${Date.now().toString(36)}-${sequence.toString(36)}`;
}

/** Вызывает SendMessage и переводит сообщение в «отправлено» либо в «ошибку». */
function deliver(chatId: string, localId: string, text: string): AppThunk<Promise<void>> {
  return async (dispatch) => {
    try {
      const { idMessage } = await dispatch(
        greenApi.endpoints.sendMessage.initiate({ chatId, message: text }, { track: false }),
      ).unwrap();
      dispatch(messageSendSucceeded({ chatId, localId, idMessage }));
    } catch (error) {
      dispatch(messageSendFailed({ chatId, localId, error: getApiErrorMessage(error) }));
    }
  };
}

/**
 * Отправка текстового сообщения методом SendMessage.
 * Сообщение сразу появляется в чате со статусом «отправляется»; после ответа API его
 * временный идентификатор заменяется на idMessage — так оно не показывается второй раз,
 * когда то же сообщение приходит из истории или очереди уведомлений.
 */
export function sendTextMessage(chatId: string, text: string): AppThunk<Promise<void>> {
  return (dispatch) => {
    const localId = createLocalId();
    dispatch(
      messageQueued({
        id: localId,
        chatId,
        direction: 'outgoing',
        text,
        timestamp: Date.now(),
        status: 'sending',
      }),
    );
    return dispatch(deliver(chatId, localId, text));
  };
}

/** Повторная отправка сообщения, которое не ушло. */
export function retryMessage(chatId: string, messageId: string): AppThunk<Promise<void>> {
  return (dispatch, getState) => {
    const message = selectMessages(getState(), chatId).find(({ id }) => id === messageId);
    if (message === undefined || message.status !== 'error') {
      return Promise.resolve();
    }
    dispatch(messageRetried({ chatId, localId: messageId }));
    return dispatch(deliver(chatId, messageId, message.text));
  };
}
