import type { Chat, ChatMessage } from '../types/chat';
import { formatPhone } from '../utils/phone';
import { MessageInput } from './MessageInput';
import { MessageList } from './MessageList';
import styles from './ChatWindow.module.css';

interface Props {
  chat: Chat;
  messages: ChatMessage[];
  onSend: (text: string) => void;
  onBack: () => void;
}

export function ChatWindow({ chat, messages, onSend, onBack }: Props) {
  return (
    <section className={styles.window}>
      <header className={styles.header}>
        <button className={styles.back} type="button" onClick={onBack} aria-label="К списку чатов">
          ←
        </button>
        <div className={styles.headline}>
          <h2 className={styles.title}>{chat.title}</h2>
          <p className={styles.subtitle}>
            {chat.phone !== null ? formatPhone(chat.phone) : `chatId: ${chat.id}`}
          </p>
        </div>
      </header>
      <MessageList messages={messages} />
      <MessageInput onSend={onSend} />
    </section>
  );
}
