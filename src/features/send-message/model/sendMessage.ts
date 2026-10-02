import {
  messageQueued,
  messageRemoved,
  messageRetried,
  messageSendFailed,
  messageSendSucceeded,
  selectMessages,
} from '@/entities/chat';
import {
  attachmentKindOfFile,
  contactAttachment,
  locationAttachment,
  safeUrl,
  type Message,
} from '@/entities/message';
import { getApiErrorMessage, greenApi } from '@/shared/api';
import type { AppThunk } from '@/shared/lib/store';

/** Что именно отправляется — от этого зависит метод GREEN-API. */
type Outgoing =
  | { type: 'text'; text: string }
  | { type: 'file'; file: File; caption: string }
  | { type: 'location'; latitude: number; longitude: number }
  | { type: 'contact'; contactChatId: string };

/** Контакт, которым делятся: chatId из GetContacts и имя для показа в ленте. */
export interface SharedContact {
  chatId: string;
  name: string;
}

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * Вложения сообщений, которые ещё не отправлены, — чтобы повторить отправку после ошибки.
 * Хранятся вне Redux: `File` не сериализуется и не переживает перезагрузку страницы.
 * Ключ — временный идентификатор сообщения.
 */
const outbox = new Map<string, Outgoing>();

let sequence = 0;

/** Временный идентификатор сообщения до ответа GREEN-API. */
function createLocalId(): string {
  sequence += 1;
  return `local-${Date.now().toString(36)}-${sequence.toString(36)}`;
}

interface Sent {
  idMessage: string;
  /** Ссылка на загруженный файл — только у SendFileByUpload. */
  fileUrl?: string | null;
}

/** Вызывает метод GREEN-API, которым отправляется такое сообщение. */
function request(chatId: string, outgoing: Outgoing): AppThunk<Promise<Sent>> {
  return async (dispatch) => {
    const options = { track: false } as const;
    const { endpoints } = greenApi;

    switch (outgoing.type) {
      case 'text':
        return dispatch(
          endpoints.sendMessage.initiate({ chatId, message: outgoing.text }, options),
        ).unwrap();
      case 'file': {
        const { file, caption } = outgoing;
        const { idMessage, urlFile } = await dispatch(
          endpoints.sendFileByUpload.initiate({ chatId, file, caption }, options),
        ).unwrap();
        return { idMessage, fileUrl: safeUrl(urlFile) };
      }
      case 'location': {
        const { latitude, longitude } = outgoing;
        return dispatch(
          endpoints.sendLocation.initiate({ chatId, latitude, longitude }, options),
        ).unwrap();
      }
      case 'contact': {
        const { contactChatId } = outgoing;
        return dispatch(
          endpoints.sendContact.initiate({ chatId, contactChatId }, options),
        ).unwrap();
      }
    }
  };
}

/** Отправляет сообщение и переводит его в «отправлено» либо в «ошибку». */
function deliver(chatId: string, localId: string, outgoing: Outgoing): AppThunk<Promise<void>> {
  return async (dispatch) => {
    try {
      const { idMessage, fileUrl } = await dispatch(request(chatId, outgoing));
      outbox.delete(localId);
      dispatch(messageSendSucceeded({ chatId, localId, idMessage, fileUrl }));
    } catch (error) {
      dispatch(messageSendFailed({ chatId, localId, error: getApiErrorMessage(error) }));
    }
  };
}

/**
 * Сообщение сразу появляется в чате со статусом «отправляется»; после ответа API его
 * временный идентификатор заменяется на idMessage — так оно не показывается второй раз,
 * когда то же сообщение приходит из истории или очереди уведомлений.
 */
function enqueue(
  chatId: string,
  outgoing: Outgoing,
  content: Pick<Message, 'text' | 'attachment'>,
): AppThunk<Promise<void>> {
  return (dispatch) => {
    const localId = createLocalId();
    // Текст для повтора есть в самом сообщении, вложение — только здесь.
    if (outgoing.type !== 'text') {
      outbox.set(localId, outgoing);
    }
    dispatch(
      messageQueued({
        id: localId,
        chatId,
        direction: 'outgoing',
        timestamp: Date.now(),
        status: 'sending',
        ...content,
      }),
    );
    return dispatch(deliver(chatId, localId, outgoing));
  };
}

/** Текстовое сообщение — SendMessage. */
export function sendTextMessage(chatId: string, text: string): AppThunk<Promise<void>> {
  return enqueue(chatId, { type: 'text', text }, { text });
}

/** Файл с диска и подпись к нему — SendFileByUpload. */
export function sendFileMessage(
  chatId: string,
  file: File,
  caption: string,
): AppThunk<Promise<void>> {
  return enqueue(
    chatId,
    { type: 'file', file, caption },
    // Ссылка появится в ответе API; какой это тип сообщения, MAX решит сам — история уточнит.
    {
      text: caption,
      attachment: { kind: attachmentKindOfFile(file.type), url: null, name: file.name },
    },
  );
}

/** Геопозиция — SendLocation. */
export function sendLocationMessage(
  chatId: string,
  { latitude, longitude }: Coordinates,
): AppThunk<Promise<void>> {
  return enqueue(
    chatId,
    { type: 'location', latitude, longitude },
    { text: '', attachment: locationAttachment(latitude, longitude) },
  );
}

/** Контакт из списка контактов инстанса — SendContact. */
export function sendContactMessage(
  chatId: string,
  contact: SharedContact,
): AppThunk<Promise<void>> {
  return enqueue(
    chatId,
    { type: 'contact', contactChatId: contact.chatId },
    { text: '', attachment: contactAttachment(contact.name) },
  );
}

/** Повторная отправка сообщения, которое не ушло. */
export function retryMessage(chatId: string, messageId: string): AppThunk<Promise<void>> {
  return (dispatch, getState) => {
    const message = selectMessages(getState(), chatId).find(({ id }) => id === messageId);
    if (message === undefined || message.status !== 'error') {
      return Promise.resolve();
    }
    const outgoing: Outgoing | undefined =
      outbox.get(messageId) ??
      (message.attachment === undefined ? { type: 'text', text: message.text } : undefined);
    if (outgoing === undefined) {
      // Страницу перезагрузили: сообщение восстановлено из кэша, а само вложение — нет.
      dispatch(
        messageSendFailed({
          chatId,
          localId: messageId,
          error: 'Вложение не сохранилось после перезагрузки страницы — отправьте его заново.',
        }),
      );
      return Promise.resolve();
    }
    dispatch(messageRetried({ chatId, localId: messageId }));
    return dispatch(deliver(chatId, messageId, outgoing));
  };
}

/** Пользователь убрал неотправленное сообщение: вместе с ним забываем и его вложение. */
export function discardMessage(chatId: string, messageId: string): AppThunk {
  return (dispatch) => {
    outbox.delete(messageId);
    dispatch(messageRemoved({ chatId, id: messageId }));
  };
}
