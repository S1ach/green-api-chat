import { ChatAvatar, type Chat } from '@/entities/chat';
import { formatListStamp } from '@/shared/lib/datetime';
import styles from './ChatList.module.scss';

interface Props {
  chats: Chat[];
  activeChatId: string | null;
  onSelect: (chatId: string) => void;
}

export function ChatList({ chats, activeChatId, onSelect }: Props) {
  if (chats.length === 0) {
    return <p className={styles.empty}>Чатов пока нет. Создайте первый по номеру телефона.</p>;
  }

  return (
    <ul className={styles.list}>
      {chats.map((chat) => (
        <li key={chat.id}>
          <button
            type="button"
            className={chat.id === activeChatId ? `${styles.item} ${styles.active}` : styles.item}
            onClick={() => onSelect(chat.id)}
          >
            <ChatAvatar chat={chat} />
            <span className={styles.body}>
              <span className={styles.row}>
                <span className={styles.title}>{chat.title}</span>
                {chat.lastActivity > 0 && (
                  <span className={styles.stamp}>{formatListStamp(chat.lastActivity)}</span>
                )}
              </span>
              <span className={styles.row}>
                <span className={styles.preview}>{chat.lastPreview || 'Нет сообщений'}</span>
                {chat.unreadCount > 0 && (
                  <span className={styles.badge} aria-label={`Непрочитанных: ${chat.unreadCount}`}>
                    {chat.unreadCount}
                  </span>
                )}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
