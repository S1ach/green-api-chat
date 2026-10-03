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

export function ChatAvatar({ chat, size = 48 }: Props) {
  const dispatch = useAppDispatch();
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

  // ссылка протухла — один раз просим новую
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
