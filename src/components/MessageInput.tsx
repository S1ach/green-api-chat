import { useState, type KeyboardEvent } from 'react';
import { MAX_MESSAGE_LENGTH } from '../api/greenApi';
import styles from './MessageInput.module.css';

interface Props {
  onSend: (text: string) => void;
  disabled?: boolean;
}

/** Показываем счётчик, когда до лимита остаётся меньше 200 символов. */
const COUNTER_THRESHOLD = MAX_MESSAGE_LENGTH - 200;

export function MessageInput({ onSend, disabled = false }: Props) {
  const [text, setText] = useState('');
  const trimmed = text.trim();
  const canSend = trimmed !== '' && trimmed.length <= MAX_MESSAGE_LENGTH && !disabled;

  const submit = () => {
    if (!canSend) {
      return;
    }
    onSend(trimmed);
    setText('');
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter отправляет, Shift+Enter переносит строку.
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <div className={styles.wrapper}>
      <textarea
        className={styles.input}
        value={text}
        onChange={(event) => setText(event.target.value.slice(0, MAX_MESSAGE_LENGTH))}
        onKeyDown={handleKeyDown}
        placeholder="Напишите сообщение…"
        rows={1}
        maxLength={MAX_MESSAGE_LENGTH}
        disabled={disabled}
      />
      <div className={styles.side}>
        {text.length > COUNTER_THRESHOLD && (
          <span className={styles.counter}>
            {text.length} / {MAX_MESSAGE_LENGTH}
          </span>
        )}
        <button className={styles.send} type="button" onClick={submit} disabled={!canSend}>
          Отправить
        </button>
      </div>
    </div>
  );
}
