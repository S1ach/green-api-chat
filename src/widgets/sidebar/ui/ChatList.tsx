import type { Chat } from '@/entities/chat';
import { Loader } from '@/shared/ui';
import { ChatListItem } from './ChatListItem';
import styles from './ChatList.module.scss';

interface Props {
  chats: Chat[];
  activeChatId: string | null;
  isLoading: boolean;
  emptyText: string;
  onSelect: (chatId: string) => void;
}

export function ChatList({ chats, activeChatId, isLoading, emptyText, onSelect }: Props) {
  if (chats.length === 0) {
    return isLoading ? (
      <Loader className={styles.empty} label="Загружаем чаты…" />
    ) : (
      <p className={styles.empty}>{emptyText}</p>
    );
  }

  return (
    <ul className={styles.list}>
      {chats.map((chat) => (
        <ChatListItem
          key={chat.id}
          chat={chat}
          isActive={chat.id === activeChatId}
          onSelect={onSelect}
        />
      ))}
    </ul>
  );
}
