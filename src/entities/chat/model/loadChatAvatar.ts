import { greenApi, isGreenApiError } from '@/shared/api';
import type { AppThunk } from '@/shared/lib/store';
import { avatarChecked } from './chatSlice';
import type { Chat, ChatAvatarInfo } from './types';

/** Полученную ссылку считаем актуальной неделю: аватары меняют редко, а запросы на счету. */
const REFRESH_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
/** После сбоя (сеть, 429, 5xx) пробуем снова не раньше чем через час. */
const RETRY_AFTER_MS = 60 * 60 * 1000;

type AvatarChat = Pick<Chat, 'id'> & Partial<Pick<Chat, 'chatType'>>;

/** Запросы, которые сейчас в полёте: список чатов и шапка не запрашивают один аватар дважды. */
const inFlight = new Map<string, Promise<void>>();

/** Пора ли запрашивать аватар: его ещё не запрашивали либо срок ссылки вышел. */
export function isAvatarStale(avatar: ChatAvatarInfo | undefined, now: number = Date.now()) {
  return avatar === undefined || avatar.refreshAt <= now;
}

/** Месячные квоты тарифа обновляются первого числа — раньше повторять запрос бессмысленно. */
function startOfNextMonth(now: number): number {
  const date = new Date(now);
  return new Date(date.getFullYear(), date.getMonth() + 1, 1).getTime();
}

function isQuotaError(error: unknown): boolean {
  return isGreenApiError(error) && error.kind === 'quota';
}

/** GetContactInfo не работает с группами: их chatId отрицательный. */
function hasContactInfo({ id, chatType }: AvatarChat): boolean {
  return chatType !== 'group' && !id.startsWith('-');
}

/**
 * Запрашивает аватар чата и сохраняет ссылку в самом чате — вместе с ним она попадает
 * в localStorage. Поэтому аватар запрашивается раз в неделю, а не при каждой загрузке
 * страницы: на бесплатном тарифе у GetAvatar квота 100 запросов в месяц, и перезагрузки
 * исчерпывали её за день.
 *
 * Если GetAvatar не ответил, для личного чата и бота ссылку берём из GetContactInfo —
 * у него отдельная квота. Когда не удалось и это, прежняя ссылка остаётся, а следующую
 * попытку откладываем: при исчерпанной квоте — до начала месяца, иначе на час.
 */
export function loadChatAvatar(chat: AvatarChat): AppThunk<Promise<void>> {
  return (dispatch, getState) => {
    const key = `${getState().session.credentials?.idInstance ?? ''}:${chat.id}`;
    const running = inFlight.get(key);
    if (running !== undefined) {
      return running;
    }

    const request = { chatId: chat.id };
    const options = { subscribe: false, forceRefetch: true } as const;
    const { getAvatar, getContactInfo } = greenApi.endpoints;

    const load = async (): Promise<void> => {
      const now = Date.now();
      let url: string | null = null;
      let isQuotaExceeded = false;
      try {
        url = await dispatch(getAvatar.initiate(request, options)).unwrap();
      } catch (avatarError) {
        isQuotaExceeded = isQuotaError(avatarError);
        if (hasContactInfo(chat)) {
          try {
            url = await dispatch(getContactInfo.initiate(request, options)).unwrap();
          } catch (contactError) {
            isQuotaExceeded ||= isQuotaError(contactError);
          }
        }
      }

      if (url !== null) {
        dispatch(avatarChecked({ chatId: chat.id, url, refreshAt: now + REFRESH_AFTER_MS }));
      } else {
        const refreshAt = isQuotaExceeded ? startOfNextMonth(now) : now + RETRY_AFTER_MS;
        dispatch(avatarChecked({ chatId: chat.id, url: null, refreshAt }));
      }
    };

    const promise = load().finally(() => inFlight.delete(key));
    inFlight.set(key, promise);
    return promise;
  };
}
