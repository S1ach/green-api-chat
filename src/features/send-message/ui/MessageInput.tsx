import { Send } from 'lucide-react';
import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { MAX_MESSAGE_LENGTH } from '@/shared/config';
import { Alert, Loader } from '@/shared/ui';
import { useSendMessage } from '../model/useSendMessage';
import styles from './MessageInput.module.scss';

interface Props {
  chatId: string;
}

/** Показываем счётчик, когда до лимита остаётся меньше 200 символов. */
const COUNTER_THRESHOLD = MAX_MESSAGE_LENGTH - 200;

/** Поле ввода сообщения: Enter отправляет, Shift+Enter переносит строку. */
export function MessageInput({ chatId }: Props) {
  // Черновик — локальное состояние компонента: больше он никому не нужен.
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { send, isSending, error } = useSendMessage(chatId);

  const trimmed = text.trim();
  const canSend = trimmed !== '' && !isSending;

  const submit = async () => {
    if (!canSend) {
      return;
    }
    // Поле очищается только после подтверждения отправки: при ошибке текст остаётся для повтора.
    if (await send(trimmed)) {
      setText('');
    }
    inputRef.current?.focus();
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submit();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  };

  return (
    <form className={styles.wrapper} onSubmit={handleSubmit}>
      {error !== null && <Alert className={styles.error}>Сообщение не отправлено. {error}</Alert>}
      <div className={styles.row}>
        <textarea
          ref={inputRef}
          className={styles.input}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Напишите сообщение…"
          aria-label="Текст сообщения"
          rows={1}
          maxLength={MAX_MESSAGE_LENGTH}
          readOnly={isSending}
          autoFocus
        />
        {text.length > COUNTER_THRESHOLD && (
          <span className={styles.counter}>
            {text.length} / {MAX_MESSAGE_LENGTH}
          </span>
        )}
        <button className={styles.send} type="submit" disabled={!canSend} aria-label="Отправить">
          {isSending ? <Loader size={20} /> : <Send size={20} aria-hidden="true" />}
        </button>
      </div>
    </form>
  );
}
