import { ArrowUp } from 'lucide-react';
import { useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { MAX_MESSAGE_LENGTH } from '@/shared/config';
import { useAppDispatch } from '@/shared/lib/store';
import { IconButton } from '@/shared/ui';
import { sendTextMessage } from '../model/sendMessage';
import styles from './MessageInput.module.scss';

interface Props {
  chatId: string;
}

/** Показываем счётчик, когда до лимита остаётся меньше 200 символов. */
const COUNTER_THRESHOLD = MAX_MESSAGE_LENGTH - 200;
/** Поле растёт вместе с текстом до этой высоты, дальше появляется прокрутка. */
const MAX_HEIGHT_PX = 160;

/** Поле ввода сообщения: Enter отправляет, Shift+Enter переносит строку. */
export function MessageInput({ chatId }: Props) {
  const dispatch = useAppDispatch();
  // Черновик — локальное состояние компонента: больше он никому не нужен.
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const trimmed = text.trim();
  const canSend = trimmed !== '';

  // Высота поля подстраивается под текст.
  useLayoutEffect(() => {
    const input = inputRef.current;
    if (input !== null) {
      input.style.height = 'auto';
      input.style.height = `${Math.min(input.scrollHeight, MAX_HEIGHT_PX)}px`;
    }
  }, [text]);

  const submit = () => {
    if (!canSend) {
      return;
    }
    // Поле очищается сразу, поэтому повторное нажатие не отправит то же сообщение ещё раз.
    // Само сообщение уже в ленте: со статусом «отправляется», а при ошибке — с кнопкой повтора.
    void dispatch(sendTextMessage(chatId, trimmed));
    setText('');
    inputRef.current?.focus();
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submit();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // isComposing: Enter, которым подтверждают ввод в IME, сообщение не отправляет.
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.field}>
        <textarea
          ref={inputRef}
          className={styles.input}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Сообщение"
          aria-label="Текст сообщения"
          rows={1}
          maxLength={MAX_MESSAGE_LENGTH}
          autoFocus
        />
        {text.length > COUNTER_THRESHOLD && (
          <span className={styles.counter}>
            {text.length} / {MAX_MESSAGE_LENGTH}
          </span>
        )}
      </div>
      <IconButton variant="primary" type="submit" disabled={!canSend} aria-label="Отправить">
        <ArrowUp size={22} strokeWidth={2.4} aria-hidden="true" />
      </IconButton>
    </form>
  );
}
