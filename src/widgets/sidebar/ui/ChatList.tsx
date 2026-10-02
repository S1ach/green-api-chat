import clsx from 'clsx';
import { ChatAvatar, type Chat } from '@/entities/chat';
import { formatListStamp } from '@/shared/lib/datetime';
import { Loader } from '@/shared/ui';
import styles from './ChatList.module.scss';

interface Props {
  chats: Chat[];
  activeChatId: string | null;
  /** Список чатов ещё загружается с сервера. */
  isLoading: boolean;
  onSelect: (chatId: string) => void;
}

export function ChatList({ chats, activeChatId, isLoading, onSelect }: Props) {
  if (chats.length === 0) {
    return isLoading ? (
      <Loader className={styles.empty} label="Загружаем чаты…" />
    ) : (
      <p className={styles.empty}>Чатов пока нет. Создайте первый по номеру телефона.</p>
    );
  }

  return (
    <ul className={styles.list}>
      {chats.map((chat) => (
        <li key={chat.id}>
          <button
            type="button"
            className={clsx(styles.item, chat.id === activeChatId && styles.active)}
            aria-current={chat.id === activeChatId || undefined}
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
