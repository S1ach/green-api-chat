import { messageSent } from '@/entities/chat';
import { getApiErrorMessage, useSendMessageMutation } from '@/shared/api';
import { useAppDispatch } from '@/shared/lib/store';

interface SendMessage {
  /** Отправляет текст; `true` — GREEN-API подтвердил отправку. */
  send: (text: string) => Promise<boolean>;
  isSending: boolean;
  /** Текст ошибки последней попытки; `null`, если её не было. */
  error: string | null;
}

/**
 * Отправка текстового сообщения в чат методом SendMessage.
 * Сообщение появляется в чате только после подтверждения API — с его idMessage.
 */
export function useSendMessage(chatId: string): SendMessage {
  const dispatch = useAppDispatch();
  const [sendMessage, { isLoading, error }] = useSendMessageMutation();

  const send = async (text: string): Promise<boolean> => {
    try {
      const { idMessage } = await sendMessage({ chatId, message: text }).unwrap();
      dispatch(
        messageSent({ id: idMessage, chatId, direction: 'outgoing', text, timestamp: Date.now() }),
      );
      return true;
    } catch {
      // Причина остаётся в `error` мутации и показывается под полем ввода.
      return false;
    }
  };

  return {
    send,
    isSending: isLoading,
    error: error === undefined ? null : getApiErrorMessage(error),
  };
}
