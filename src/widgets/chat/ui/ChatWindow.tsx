import { ChatAvatar, isReadOnlyChat, selectMessages, type Chat } from '@/entities/chat';
import { useChatHistory } from '@/features/load-history';
import { MessageInput } from '@/features/send-message';
import { formatPhone } from '@/shared/lib/phone';
import { useAppSelector } from '@/shared/lib/store';
import { MessageList } from './MessageList';
import styles from './ChatWindow.module.scss';

interface Props {
  chat: Chat;
  onBack: () => void;
}

export function ChatWindow({ chat, onBack }: Props) {
  const messages = useAppSelector((state) => selectMessages(state, chat.id));
  const { error: historyError } = useChatHistory(chat.id);

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
      {historyError !== null && (
        <p className={styles.banner} role="status">
          История чата не загрузилась: {historyError}
        </p>
      )}
      <MessageList messages={messages} />
      {isReadOnlyChat(chat) ? (
        <p className={styles.readOnly}>
          Это служебный чат MAX — отправлять сообщения в него нельзя.
        </p>
      ) : (
        // key: у каждого чата свой черновик и своё состояние отправки.
        <MessageInput key={chat.id} chatId={chat.id} />
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
