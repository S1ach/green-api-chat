import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import type { Message } from '@/entities/message';

/** Ближе этого расстояния до низа считаем, что пользователь читает свежие сообщения. */
const NEAR_BOTTOM_PX = 120;

interface ChatScroll {
  ref: RefObject<HTMLDivElement>;
  onScroll: () => void;
  /** Пользователь у конца ленты — кнопка «вниз» не нужна. */
  isAtBottom: boolean;
  /** Сколько входящих пришло, пока пользователь читал историю выше. */
  unseenCount: number;
  scrollToBottom: () => void;
}

interface Snapshot {
  firstId: string;
  lastId: string;
  scrollHeight: number;
}

/**
 * Прокрутка ленты сообщений.
 * - При открытии чата и пока пользователь внизу, лента держится у последнего сообщения.
 * - Собственное сообщение всегда прокручивает ленту вниз.
 * - Если пользователь ушёл читать историю, новые входящие его не перебрасывают —
 *   они считаются и показываются на кнопке «вниз».
 * - При подгрузке более ранних сообщений позиция сохраняется: лента не прыгает.
 */
export function useChatScroll(messages: Message[]): ChatScroll {
  const ref = useRef<HTMLDivElement>(null);
  const snapshot = useRef<Snapshot | null>(null);
  // Ref — для расчётов в эффекте без лишних перерисовок, state — для кнопки «вниз».
  const atBottom = useRef(true);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [unseenCount, setUnseenCount] = useState(0);

  const setAtBottom = useCallback((value: boolean) => {
    atBottom.current = value;
    setIsAtBottom(value);
    if (value) {
      setUnseenCount(0);
    }
  }, []);

  const onScroll = () => {
    const list = ref.current;
    if (list === null) {
      return;
    }
    // Высота ленты могла измениться и без новых сообщений (ширина окна, вложения):
    // запоминаем актуальную, чтобы подгрузка истории компенсировала ровно свой прирост.
    if (snapshot.current !== null) {
      snapshot.current.scrollHeight = list.scrollHeight;
    }
    const isNear = list.scrollHeight - list.scrollTop - list.clientHeight < NEAR_BOTTOM_PX;
    if (isNear !== atBottom.current) {
      setAtBottom(isNear);
    }
  };

  const scrollToBottom = useCallback(() => {
    const list = ref.current;
    if (list !== null) {
      list.scrollTop = list.scrollHeight;
      setAtBottom(true);
    }
  }, [setAtBottom]);

  useLayoutEffect(() => {
    const list = ref.current;
    const first = messages[0];
    const last = messages[messages.length - 1];
    if (list === null || first === undefined || last === undefined) {
      snapshot.current = null;
      return;
    }

    const previous = snapshot.current;
    const hasNewLast = previous?.lastId !== last.id;
    const isOwnNewMessage = hasNewLast && last.direction === 'outgoing';

    if (atBottom.current || isOwnNewMessage) {
      list.scrollTop = list.scrollHeight;
      if (!atBottom.current) {
        setAtBottom(true);
      }
    } else if (previous !== null && !hasNewLast && previous.firstId !== first.id) {
      // Сверху добавились более ранние сообщения: компенсируем прирост высоты.
      list.scrollTop += list.scrollHeight - previous.scrollHeight;
    } else if (previous !== null && hasNewLast) {
      setUnseenCount((count) => count + 1);
    }

    snapshot.current = { firstId: first.id, lastId: last.id, scrollHeight: list.scrollHeight };
  }, [messages, setAtBottom]);

  return { ref, onScroll, isAtBottom, unseenCount, scrollToBottom };
}
