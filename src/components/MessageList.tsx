import { useEffect, useRef } from 'react';
import type { ChatMessage } from '../types/chat';
import { formatTime } from '../utils/datetime';
import styles from './MessageList.module.css';

const STATUS_LABEL: Record<ChatMessage['status'], string> = {
  sending: 'отправляется…',
  sent: 'отправлено',
  error: 'ошибка',
};

interface Props {
  messages: ChatMessage[];
}

export function MessageList({ messages }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  return (
    <div className={styles.scroll}>
      {messages.length === 0 && (
        <p className={styles.empty}>Сообщений пока нет — напишите первым.</p>
      )}
      <ul className={styles.list}>
        {messages.map((message) => (
          <li
            key={message.id}
            className={message.direction === 'incoming' ? styles.incoming : styles.outgoing}
          >
            <div className={styles.bubble}>
              <p className={styles.text}>{message.text}</p>
              <div className={styles.meta}>
                <span>{formatTime(message.timestamp)}</span>
                {message.direction === 'outgoing' && (
                  <span
                    className={message.status === 'error' ? styles.statusError : styles.status}
                    title={message.error}
                  >
                    {STATUS_LABEL[message.status]}
                  </span>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
      <div ref={bottomRef} />
    </div>
  );
}
