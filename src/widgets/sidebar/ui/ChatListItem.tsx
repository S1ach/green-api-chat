import clsx from 'clsx';
import { memo } from 'react';
import { ChatAvatar, type Chat } from '@/entities/chat';
import { formatListStamp } from '@/shared/lib/datetime';
import { Counter } from '@/shared/ui';
import styles from './ChatListItem.module.scss';

interface Props {
  chat: Chat;
  isActive: boolean;
  onSelect: (chatId: string) => void;
}

export const ChatListItem = memo(function ChatListItem({ chat, isActive, onSelect }: Props) {
  return (
    <li>
      <button
        type="button"
        className={clsx(styles.item, isActive && styles.active)}
        aria-current={isActive || undefined}
        onClick={() => onSelect(chat.id)}
      >
        <ChatAvatar chat={chat} size={48} />
        <span className={styles.content}>
          <span className={styles.row}>
            <span className={styles.title}>{chat.title}</span>
            {chat.lastActivity > 0 && (
              <span className={styles.time}>{formatListStamp(chat.lastActivity)}</span>
            )}
          </span>
          <span className={styles.row}>
            <span className={styles.preview}>{chat.lastPreview || 'Нет сообщений'}</span>
            {chat.unreadCount > 0 && (
              <Counter value={chat.unreadCount} label={`Непрочитанных: ${chat.unreadCount}`} />
            )}
          </span>
        </span>
      </button>
    </li>
  );
});
