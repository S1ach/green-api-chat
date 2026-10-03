import clsx from 'clsx';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { ChatAvatar, type Chat } from '@/entities/chat';
import { formatPhone } from '@/shared/lib/phone';
import { IconButton } from '@/shared/ui';
import styles from './ChatHeader.module.scss';

interface Props {
  chat: Chat;
  onClose: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

const CHAT_TYPE_LABELS: Record<string, string> = {
  group: 'группа',
  channel: 'канал',
  bot: 'бот',
};

function subtitle(chat: Chat): string {
  if (chat.phone !== null) {
    return formatPhone(chat.phone);
  }
  return CHAT_TYPE_LABELS[chat.chatType ?? ''] ?? `chatId: ${chat.id}`;
}

export function ChatHeader({ chat, onClose, onRefresh, isRefreshing }: Props) {
  return (
    <header className={styles.header}>
      <IconButton className={styles.close} onClick={onClose} aria-label="Закрыть чат">
        <ArrowLeft size={22} aria-hidden="true" />
      </IconButton>
      <ChatAvatar chat={chat} size={40} />
      <div className={styles.headline}>
        <h2 className={styles.title}>{chat.title}</h2>
        <p className={styles.subtitle}>{subtitle(chat)}</p>
      </div>
      <IconButton onClick={onRefresh} disabled={isRefreshing} aria-label="Обновить историю">
        <RefreshCw className={clsx(isRefreshing && styles.spinning)} size={20} aria-hidden="true" />
      </IconButton>
    </header>
  );
}
