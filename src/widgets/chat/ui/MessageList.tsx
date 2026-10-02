import { MessageBubble, type Message } from '@/entities/message';
import { Loader } from '@/shared/ui';
import { useStickToBottom } from '../lib/useStickToBottom';
import styles from './MessageList.module.scss';

interface Props {
  messages: Message[];
  /** История чата ещё загружается с сервера. */
  isLoading: boolean;
}

export function MessageList({ messages, isLoading }: Props) {
  const { ref, onScroll } = useStickToBottom(messages);

  return (
    <div
      ref={ref}
      className={styles.scroll}
      onScroll={onScroll}
      role="log"
      aria-label="Сообщения чата"
    >
      {messages.length === 0 &&
        (isLoading ? (
          <Loader className={styles.empty} label="Загружаем историю…" />
        ) : (
          <p className={styles.empty}>Сообщений пока нет — напишите первым.</p>
        ))}
      <ul className={styles.list}>
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
      </ul>
    </div>
  );
}
