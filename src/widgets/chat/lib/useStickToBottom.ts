import { useLayoutEffect, useRef, type RefObject } from 'react';
import type { Message } from '@/entities/message';

/** Ближе этого расстояния до низа считаем, что пользователь читает свежие сообщения. */
const NEAR_BOTTOM_PX = 120;

interface StickToBottom {
  ref: RefObject<HTMLDivElement>;
  onScroll: () => void;
}

/**
 * Автоскролл ленты сообщений. Новые сообщения прокручивают ленту вниз, только если
 * пользователь и так был внизу: тому, кто ушёл читать историю, лента не мешает.
 * Исключение — собственное сообщение: после отправки его нужно показать всегда.
 */
export function useStickToBottom(messages: Message[]): StickToBottom {
  const ref = useRef<HTMLDivElement>(null);
  const isNearBottom = useRef(true);
  const lastSeenId = useRef<string | null>(null);

  const onScroll = () => {
    const list = ref.current;
    if (list !== null) {
      isNearBottom.current =
        list.scrollHeight - list.scrollTop - list.clientHeight < NEAR_BOTTOM_PX;
    }
  };

  useLayoutEffect(() => {
    const list = ref.current;
    const last = messages[messages.length - 1];
    if (list === null || last === undefined) {
      return;
    }
    const isOwnNewMessage = last.direction === 'outgoing' && last.id !== lastSeenId.current;
    lastSeenId.current = last.id;

    if (isNearBottom.current || isOwnNewMessage) {
      list.scrollTop = list.scrollHeight;
      isNearBottom.current = true;
    }
  }, [messages]);

  return { ref, onScroll };
}
