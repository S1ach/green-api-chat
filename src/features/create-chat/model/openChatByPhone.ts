import { chatOpened, chatSelected, selectChats } from '@/entities/chat';
import { getApiErrorMessage, greenApi, isGreenApiError, type ApiErrorKind } from '@/shared/api';
import { fallbackChatId, formatPhone } from '@/shared/lib/phone';
import type { AppThunk } from '@/shared/lib/store';

export type OpenChatResult =
  | { status: 'opened'; chatId: string; warning: string | null }
  | { status: 'notRegistered' }
  | { status: 'failed'; error: string };

// при таких ошибках запасной chatId не подставляем
const FATAL_CHECK_KINDS = new Set<ApiErrorKind>(['unauthorized', 'quota', 'rateLimit', 'network']);

// CheckAccount недоступен — создаём чат по номер@c.us, SendMessage его тоже принимает
export function openChatByPhone(phone: string): AppThunk<Promise<OpenChatResult>> {
  return async (dispatch, getState) => {
    const existing = selectChats(getState()).find((chat) => chat.phone === phone);
    if (existing) {
      dispatch(chatSelected(existing.id));
      return { status: 'opened', chatId: existing.id, warning: null };
    }

    let chatId = fallbackChatId(phone);
    let warning: string | null = null;

    try {
      const account = await dispatch(
        greenApi.endpoints.checkAccount.initiate({ phoneNumber: phone }, { subscribe: false }),
      ).unwrap();

      if ('status' in account) {
        warning = unavailableWarning(account.reason ?? 'инстанс не готов к работе');
      } else if (!account.exist) {
        return { status: 'notRegistered' };
      } else if (account.chatId) {
        chatId = account.chatId;
      }
    } catch (error) {
      if (!isGreenApiError(error) || FATAL_CHECK_KINDS.has(error.kind)) {
        return { status: 'failed', error: getApiErrorMessage(error) };
      }
      warning = unavailableWarning(error.message);
    }

    dispatch(chatOpened({ chatId, phone, title: formatPhone(phone) }));
    return { status: 'opened', chatId, warning };
  };
}

function unavailableWarning(reason: string): string {
  return `Проверка номера недоступна (${reason}) — чат создан по запасному идентификатору.`;
}
