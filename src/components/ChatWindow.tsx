import type { Chat, ChatMessage } from '../types/chat';
import { isReadOnlyChat } from '../utils/chatId';
import { formatPhone } from '../utils/phone';
import { ChatAvatar } from './ChatAvatar';
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
        <ChatAvatar chat={chat} size="sm" />
        <div className={styles.headline}>
          <h2 className={styles.title}>{chat.title}</h2>
          <p className={styles.subtitle}>{subtitle(chat)}</p>
        </div>
      </header>
      <MessageList messages={messages} />
      {isReadOnlyChat(chat) ? (
        <p className={styles.readOnly}>
          Это служебный чат MAX — отправлять сообщения в него нельзя.
        </p>
      ) : (
        <MessageInput onSend={onSend} />
      )}
    </section>
  );
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
