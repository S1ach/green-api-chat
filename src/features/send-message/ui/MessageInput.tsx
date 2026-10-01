import { useState, type KeyboardEvent } from 'react';
import { MAX_MESSAGE_LENGTH } from '@/shared/config';
import { useSendMessage } from '../model/useSendMessage';
import styles from './MessageInput.module.scss';

interface Props {
  chatId: string;
}

/** Показываем счётчик, когда до лимита остаётся меньше 200 символов. */
const COUNTER_THRESHOLD = MAX_MESSAGE_LENGTH - 200;

export function MessageInput({ chatId }: Props) {
  const [text, setText] = useState('');
  const { send, isSending, error } = useSendMessage(chatId);

  const trimmed = text.trim();
  const canSend = trimmed !== '' && trimmed.length <= MAX_MESSAGE_LENGTH && !isSending;

  const submit = async () => {
    if (!canSend) {
      return;
    }
    // Поле очищается только после подтверждения отправки: при ошибке текст остаётся для повтора.
    if (await send(trimmed)) {
      setText('');
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter отправляет, Shift+Enter переносит строку.
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  };

  return (
    <div className={styles.wrapper}>
      {error !== null && (
        <p className={styles.error} role="alert">
          Сообщение не отправлено: {error}
        </p>
      )}
      <div className={styles.row}>
        <textarea
          className={styles.input}
          value={text}
          onChange={(event) => setText(event.target.value.slice(0, MAX_MESSAGE_LENGTH))}
          onKeyDown={handleKeyDown}
          placeholder="Напишите сообщение…"
          rows={1}
          maxLength={MAX_MESSAGE_LENGTH}
          readOnly={isSending}
        />
        <div className={styles.side}>
          {text.length > COUNTER_THRESHOLD && (
            <span className={styles.counter}>
              {text.length} / {MAX_MESSAGE_LENGTH}
            </span>
          )}
          <button
            className={styles.send}
            type="button"
            onClick={() => void submit()}
            disabled={!canSend}
          >
            {isSending ? 'Отправляем…' : 'Отправить'}
          </button>
        </div>
      </div>
    </div>
  );
}
