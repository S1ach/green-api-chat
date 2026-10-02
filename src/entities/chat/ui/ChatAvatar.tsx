import { Bookmark } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useGetAccountSettingsQuery } from '@/shared/api';
import { useAppDispatch } from '@/shared/lib/store';
import { Avatar } from '@/shared/ui';
import { isSavedMessagesChat } from '../lib/isSavedMessagesChat';
import { isAvatarStale, loadChatAvatar } from '../model/loadChatAvatar';
import type { Chat } from '../model/types';

interface Props {
  chat: Pick<Chat, 'id' | 'title'> & Partial<Pick<Chat, 'chatType' | 'avatar'>>;
  size?: number;
}

/**
 * Аватар чата. Ссылка хранится в самом чате и переживает перезагрузку страницы;
 * у API она запрашивается, только когда её ещё нет или она устарела (см. `loadChatAvatar`).
 * Аватар — украшение: пока ссылки нет и при любой ошибке показываем инициалы.
 * У «Избранного» вместо аватара закладка — как в самом MAX.
 */
export function ChatAvatar({ chat, size = 48 }: Props) {
  const dispatch = useAppDispatch();
  // Один запрос на всё приложение: кэш общий для всех аватаров.
  const { data: ownChatId } = useGetAccountSettingsQuery();
  const isSavedMessages = isSavedMessagesChat(chat, ownChatId);
  const hasRetried = useRef(false);
  const { id, chatType, avatar } = chat;

  useEffect(() => {
    if (!isSavedMessages && isAvatarStale(avatar)) {
      void dispatch(loadChatAvatar({ id, chatType }));
    }
  }, [dispatch, isSavedMessages, id, chatType, avatar]);

  if (isSavedMessages) {
    return (
      <Avatar
        name={chat.title}
        seed={id}
        size={size}
        icon={<Bookmark size={Math.round(size * 0.46)} fill="currentColor" />}
      />
    );
  }

  // Сохранённая ссылка перестала открываться: один раз запрашиваем новую, не дожидаясь срока.
  const handleError = () => {
    if (!hasRetried.current) {
      hasRetried.current = true;
      void dispatch(loadChatAvatar({ id, chatType }));
    }
  };

  return (
    <Avatar name={chat.title} seed={id} src={avatar?.url ?? ''} size={size} onError={handleError} />
  );
}
