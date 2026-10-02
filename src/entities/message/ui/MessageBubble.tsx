import clsx from 'clsx';
import { formatTime } from '@/shared/lib/datetime';
import type { Message } from '../model/types';
import styles from './MessageBubble.module.scss';

interface Props {
  message: Message;
}

/** Текстовое сообщение в ленте чата: входящие слева, исходящие справа. */
export function MessageBubble({ message }: Props) {
  const isIncoming = message.direction === 'incoming';

  return (
    <li
      className={clsx(styles.message, isIncoming ? styles.incoming : styles.outgoing)}
      aria-label={isIncoming ? 'Входящее сообщение' : 'Ваше сообщение'}
    >
      <div className={styles.bubble}>
        <p className={styles.text}>{message.text}</p>
        <time className={styles.time} dateTime={new Date(message.timestamp).toISOString()}>
          {formatTime(message.timestamp)}
        </time>
      </div>
    </li>
  );
}
