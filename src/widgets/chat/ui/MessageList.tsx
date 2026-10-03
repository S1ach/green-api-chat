import { ChevronDown, MessageCircle } from 'lucide-react';
import { Fragment, useMemo } from 'react';
import { MessageBubble, type Message } from '@/entities/message';
import { Button, Counter, IconButton, Loader } from '@/shared/ui';
import { toMessageRows } from '../lib/messageRows';
import { useChatScroll } from '../lib/useChatScroll';
import styles from './MessageList.module.scss';

interface Props {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  onLoadMore: () => void;
  onRetryLoad: () => void;
  onRetryMessage: (messageId: string) => void;
  onRemoveMessage: (messageId: string) => void;
}

function MessageSkeleton() {
  return (
    <div className={styles.skeleton} role="status" aria-label="Загружаем сообщения">
      {['incoming', 'incoming', 'outgoing', 'incoming', 'outgoing', 'outgoing'].map(
        (side, index) => (
          <span key={index} className={side === 'incoming' ? styles.boneIn : styles.boneOut} />
        ),
      )}
    </div>
  );
}

export function MessageList({
  messages,
  isLoading,
  error,
  hasMore,
  onLoadMore,
  onRetryLoad,
  onRetryMessage,
  onRemoveMessage,
}: Props) {
  const { ref, onScroll, isAtBottom, unseenCount, scrollToBottom } = useChatScroll(messages);
  const rows = useMemo(() => toMessageRows(messages), [messages]);
  const isEmpty = messages.length === 0;

  return (
    <div className={styles.wrapper}>
      <div
        ref={ref}
        className={styles.scroll}
        onScroll={onScroll}
        role="log"
        aria-label="Сообщения чата"
      >
        {isEmpty && isLoading && <MessageSkeleton />}

        {isEmpty && !isLoading && error !== null && (
          <div className={styles.state} role="alert">
            <p className={styles.stateTitle}>Не удалось загрузить сообщения</p>
            <p className={styles.stateText}>{error}</p>
            <Button variant="secondary" onClick={onRetryLoad}>
              Повторить
            </Button>
          </div>
        )}

        {isEmpty && !isLoading && error === null && (
          <div className={styles.state}>
            <MessageCircle className={styles.stateIcon} size={40} strokeWidth={1.5} aria-hidden />
            <p className={styles.stateTitle}>Сообщений пока нет</p>
            <p className={styles.stateText}>Начните диалог</p>
          </div>
        )}

        {!isEmpty && (
          <>
            <div className={styles.top}>
              {isLoading && (
                <div className={styles.chip}>
                  <Loader label="Загружаем сообщения…" />
                </div>
              )}
              {!isLoading && hasMore && (
                <div className={styles.chip}>
                  <Button variant="ghost" size="xsmall" onClick={onLoadMore}>
                    Показать более ранние
                  </Button>
                </div>
              )}
            </div>
            <ul className={styles.list}>
              {rows.map(({ message, dayLabel, isGroupEnd }) => (
                <Fragment key={message.id}>
                  {dayLabel !== null && (
                    <li className={styles.day} role="presentation">
                      <span>{dayLabel}</span>
                    </li>
                  )}
                  <MessageBubble
                    message={message}
                    isGroupEnd={isGroupEnd}
                    onRetry={onRetryMessage}
                    onRemove={onRemoveMessage}
                  />
                </Fragment>
              ))}
            </ul>
          </>
        )}
      </div>

      {!isAtBottom && (
        <div className={styles.jump}>
          {unseenCount > 0 && (
            <Counter
              className={styles.jumpCounter}
              value={unseenCount}
              label={`Новых сообщений: ${unseenCount}`}
            />
          )}
          <IconButton
            className={styles.jumpButton}
            variant="secondary"
            onClick={scrollToBottom}
            aria-label="К последним сообщениям"
          >
            <ChevronDown size={22} aria-hidden="true" />
          </IconButton>
        </div>
      )}
    </div>
  );
}
