import { greenApi, isGreenApiError } from '@/shared/api';
import type { AppThunk } from '@/shared/lib/store';
import { avatarChecked } from './chatSlice';
import type { Chat, ChatAvatarInfo } from './types';

// у GetAvatar месячная квота, поэтому ссылку держим неделю
const REFRESH_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
const RETRY_AFTER_MS = 60 * 60 * 1000;

type AvatarChat = Pick<Chat, 'id'> & Partial<Pick<Chat, 'chatType'>>;

const inFlight = new Map<string, Promise<void>>();

export function isAvatarStale(avatar: ChatAvatarInfo | undefined, now: number = Date.now()) {
  return avatar === undefined || avatar.refreshAt <= now;
}

// квоты обнуляются первого числа
function startOfNextMonth(now: number): number {
  const date = new Date(now);
  return new Date(date.getFullYear(), date.getMonth() + 1, 1).getTime();
}

function isQuotaError(error: unknown): boolean {
  return isGreenApiError(error) && error.kind === 'quota';
}

// у групп chatId отрицательный, GetContactInfo с ними не работает
function hasContactInfo({ id, chatType }: AvatarChat): boolean {
  return chatType !== 'group' && !id.startsWith('-');
}

// GetAvatar не ответил — пробуем GetContactInfo, у него своя квота
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
