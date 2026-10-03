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

// null — подпись повторила бы заголовок: у чата без имени в нём уже стоит номер или chatId
function subtitle(chat: Chat): string | null {
  if (chat.phone !== null) {
    const phone = formatPhone(chat.phone);
    return phone === chat.title ? null : phone;
  }
  const label = CHAT_TYPE_LABELS[chat.chatType ?? ''];
  if (label !== undefined) {
    return label;
  }
  return chat.title === chat.id ? null : `chatId: ${chat.id}`;
}

export function ChatHeader({ chat, onClose, onRefresh, isRefreshing }: Props) {
  const caption = subtitle(chat);

  return (
    <header className={styles.header}>
      <IconButton className={styles.close} onClick={onClose} aria-label="Закрыть чат">
        <ArrowLeft size={22} aria-hidden="true" />
      </IconButton>
      <ChatAvatar chat={chat} size={40} />
      <div className={styles.headline}>
        <h2 className={styles.title}>{chat.title}</h2>
        {caption !== null && <p className={styles.subtitle}>{caption}</p>}
      </div>
      <IconButton onClick={onRefresh} disabled={isRefreshing} aria-label="Обновить историю">
        <RefreshCw className={clsx(isRefreshing && styles.spinning)} size={20} aria-hidden="true" />
      </IconButton>
    </header>
  );
}
