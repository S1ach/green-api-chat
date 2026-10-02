import {
  chatSelected,
  isReadOnlyChat,
  selectMessages,
  type Chat as ChatModel,
} from '@/entities/chat';
import { useChatHistory } from '@/features/load-history';
import { MessageInput } from '@/features/send-message';
import { useAppDispatch, useAppSelector } from '@/shared/lib/store';
import { Alert } from '@/shared/ui';
import { ChatHeader } from './ChatHeader';
import { MessageList } from './MessageList';
import styles from './Chat.module.scss';

interface Props {
  chat: ChatModel;
}

/** Открытый диалог: шапка, лента сообщений и поле ввода. */
export function Chat({ chat }: Props) {
  const dispatch = useAppDispatch();
  const messages = useAppSelector((state) => selectMessages(state, chat.id));
  const history = useChatHistory(chat.id);

  return (
    <section className={styles.chat}>
      <ChatHeader chat={chat} onBack={() => dispatch(chatSelected(null))} />
      {history.error !== null && (
        <Alert tone="warning" className={styles.alert}>
          История чата не загрузилась. {history.error}
        </Alert>
      )}
      {/* key: у каждого чата своя позиция прокрутки, свой черновик и своё состояние отправки. */}
      <MessageList key={`list-${chat.id}`} messages={messages} isLoading={history.isLoading} />
      {isReadOnlyChat(chat) ? (
        <p className={styles.readOnly}>
          Это служебный чат MAX — отправлять сообщения в него нельзя.
        </p>
      ) : (
        <MessageInput key={`input-${chat.id}`} chatId={chat.id} />
      )}
    </section>
  );
}
