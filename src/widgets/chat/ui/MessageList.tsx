import { useEffect, useRef } from 'react';
import type { Message } from '@/entities/message';
import { formatTime } from '@/shared/lib/datetime';
import styles from './MessageList.module.scss';

interface Props {
  messages: Message[];
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
              </div>
            </div>
          </li>
        ))}
      </ul>
      <div ref={bottomRef} />
    </div>
  );
}
