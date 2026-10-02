import clsx from 'clsx';
import {
  ChartColumn,
  Check,
  CheckCheck,
  CircleAlert,
  Clock3,
  FileText,
  Image,
  MapPin,
  Music,
  Sticker,
  User,
  Video,
  type LucideIcon,
} from 'lucide-react';
import { memo, type ReactNode } from 'react';
import { formatTime } from '@/shared/lib/datetime';
import { attachmentLabel } from '../lib/content';
import type { Attachment, AttachmentKind, Message, MessageStatus } from '../model/types';
import styles from './MessageBubble.module.scss';

const ATTACHMENT_ICONS: Record<AttachmentKind, LucideIcon> = {
  image: Image,
  video: Video,
  audio: Music,
  document: FileText,
  sticker: Sticker,
  location: MapPin,
  contact: User,
  poll: ChartColumn,
};

/** Статусы, которые показываются значком рядом со временем. Ошибка выводится отдельной строкой. */
const STATUS_ICONS: Partial<Record<MessageStatus, { icon: LucideIcon; label: string }>> = {
  sending: { icon: Clock3, label: 'Отправляется' },
  sent: { icon: Check, label: 'Отправлено' },
  delivered: { icon: CheckCheck, label: 'Доставлено' },
  read: { icon: CheckCheck, label: 'Прочитано' },
};

const URL_PATTERN = /(https?:\/\/[^\s<>"']+)/g;

/** Текст приходит от собеседника: в разметку превращаются только http(s)-ссылки. */
function withLinks(text: string): ReactNode[] {
  return text.split(URL_PATTERN).map((part, index) =>
    index % 2 === 1 ? (
      <a key={index} href={part} target="_blank" rel="noreferrer noopener">
        {part}
      </a>
    ) : (
      part
    ),
  );
}

function AttachmentView({ attachment }: { attachment: Attachment }) {
  const Icon = ATTACHMENT_ICONS[attachment.kind];
  const content = (
    <>
      <span className={styles.attachmentIcon}>
        <Icon size={20} aria-hidden="true" />
      </span>
      <span className={styles.attachmentText}>
        <span className={styles.attachmentLabel}>{attachmentLabel(attachment)}</span>
        {attachment.fileName !== null && (
          <span className={styles.attachmentName}>{attachment.fileName}</span>
        )}
      </span>
    </>
  );

  // Сами файлы приложение не показывает: вложение можно открыть по ссылке из GREEN-API.
  return attachment.url === null ? (
    <span className={styles.attachment}>{content}</span>
  ) : (
    <a
      className={styles.attachment}
      href={attachment.url}
      target="_blank"
      rel="noreferrer noopener"
    >
      {content}
    </a>
  );
}

interface Props {
  message: Message;
  /** Последнее в серии сообщений одного автора: у него «хвостик» и отступ до следующей серии. */
  isGroupEnd?: boolean;
  /** Повторить отправку сообщения с ошибкой. */
  onRetry?: (messageId: string) => void;
  /** Убрать неотправленное сообщение. */
  onRemove?: (messageId: string) => void;
}

/** Сообщение в ленте чата: входящие слева, исходящие справа. */
export const MessageBubble = memo(function MessageBubble({
  message,
  isGroupEnd = true,
  onRetry,
  onRemove,
}: Props) {
  const isIncoming = message.direction === 'incoming';
  const status = message.status === undefined ? undefined : STATUS_ICONS[message.status];

  return (
    <li
      className={clsx(
        styles.message,
        isIncoming ? styles.incoming : styles.outgoing,
        isGroupEnd && styles.groupEnd,
      )}
      aria-label={isIncoming ? 'Входящее сообщение' : 'Ваше сообщение'}
    >
      <div className={clsx(styles.bubble, message.status === 'error' && styles.failed)}>
        {message.attachment !== undefined && <AttachmentView attachment={message.attachment} />}
        <p className={styles.text}>
          {withLinks(message.text)}
          {/* Время «плавает» справа в последней строке текста, а если не помещается — под ним. */}
          <span className={styles.meta}>
            <time dateTime={new Date(message.timestamp).toISOString()}>
              {formatTime(message.timestamp)}
            </time>
            {status !== undefined && (
              <span
                className={clsx(styles.status, message.status === 'read' && styles.read)}
                role="img"
                aria-label={status.label}
              >
                <status.icon size={14} aria-hidden="true" />
              </span>
            )}
          </span>
        </p>
      </div>

      {message.status === 'error' && (
        <p className={styles.error} role="alert">
          <CircleAlert size={14} aria-hidden="true" />
          <span>Не отправлено. {message.error}</span>
          {onRetry !== undefined && (
            <button type="button" onClick={() => onRetry(message.id)}>
              Повторить
            </button>
          )}
          {onRemove !== undefined && (
            <button type="button" onClick={() => onRemove(message.id)}>
              Удалить
            </button>
          )}
        </p>
      )}
    </li>
  );
});
