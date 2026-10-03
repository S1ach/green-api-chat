import { useCallback } from 'react';
import {
  chatSelected,
  isReadOnlyChat,
  selectMessages,
  type Chat as ChatModel,
} from '@/entities/chat';
import { useChatHistory } from '@/features/load-history';
import { MessageInput, discardMessage, retryMessage } from '@/features/send-message';
import { useAppDispatch, useAppSelector } from '@/shared/lib/store';
import { Alert, Button } from '@/shared/ui';
import { ChatHeader } from './ChatHeader';
import { MessageList } from './MessageList';
import styles from './Chat.module.scss';

interface Props {
  chat: ChatModel;
}

export function Chat({ chat }: Props) {
  const dispatch = useAppDispatch();
  const messages = useAppSelector((state) => selectMessages(state, chat.id));
  const history = useChatHistory(chat.id);

  const handleRetry = useCallback(
    (messageId: string) => void dispatch(retryMessage(chat.id, messageId)),
    [dispatch, chat.id],
  );
  const handleRemove = useCallback(
    (messageId: string) => dispatch(discardMessage(chat.id, messageId)),
    [dispatch, chat.id],
  );

  return (
    <section className={styles.chat} aria-label={`Чат: ${chat.title}`}>
      <ChatHeader
        chat={chat}
        onClose={() => dispatch(chatSelected(null))}
        onRefresh={history.retry}
        isRefreshing={history.isLoading}
      />
      {history.error !== null && messages.length > 0 && (
        <Alert
          tone="warning"
          className={styles.alert}
          action={
            <Button variant="ghost" size="xsmall" onClick={history.retry}>
              Повторить
            </Button>
          }
        >
          Не удалось обновить историю. {history.error}
        </Alert>
      )}
      <MessageList
        messages={messages}
        isLoading={history.isLoading}
        error={history.error}
        hasMore={history.hasMore}
        onLoadMore={history.loadMore}
        onRetryLoad={history.retry}
        onRetryMessage={handleRetry}
        onRemoveMessage={handleRemove}
      />
      {isReadOnlyChat(chat) ? (
        <p className={styles.readOnly}>
          Это служебный чат MAX — отправлять сообщения в него нельзя.
        </p>
      ) : (
        <MessageInput chatId={chat.id} />
      )}
    </section>
  );
}
