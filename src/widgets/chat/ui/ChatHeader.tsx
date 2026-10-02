import { ArrowLeft } from 'lucide-react';
import { ChatAvatar, type Chat } from '@/entities/chat';
import { formatPhone } from '@/shared/lib/phone';
import styles from './ChatHeader.module.scss';

interface Props {
  chat: Chat;
  /** Возврат к списку чатов — кнопка видна только на узком экране. */
  onBack: () => void;
}

function subtitle(chat: Chat): string {
  if (chat.phone !== null) {
    return formatPhone(chat.phone);
  }
  if (chat.chatType === 'bot') {
    return 'бот';
  }
  return `chatId: ${chat.id}`;
}

export function ChatHeader({ chat, onBack }: Props) {
  return (
    <header className={styles.header}>
      <button className={styles.back} type="button" onClick={onBack} aria-label="К списку чатов">
        <ArrowLeft size={20} aria-hidden="true" />
      </button>
      <ChatAvatar chat={chat} size="sm" />
      <div className={styles.headline}>
        <h2 className={styles.title}>{chat.title}</h2>
        <p className={styles.subtitle}>{subtitle(chat)}</p>
      </div>
    </header>
  );
}
