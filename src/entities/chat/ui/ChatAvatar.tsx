import { useGetAvatarQuery } from '@/shared/api';
import { Avatar } from '@/shared/ui';
import type { Chat } from '../model/types';

interface Props {
  chat: Pick<Chat, 'id' | 'title'>;
  size?: number;
}

/**
 * Аватар собеседника из GetAvatar. RTK Query кэширует ответ по chatId, поэтому список
 * чатов и шапка делят один запрос. Аватар — украшение: при любой ошибке показываем инициалы.
 */
export function ChatAvatar({ chat, size }: Props) {
  const { data: url = '' } = useGetAvatarQuery({ chatId: chat.id });
  return <Avatar name={chat.title} seed={chat.id} src={url} size={size} />;
}
