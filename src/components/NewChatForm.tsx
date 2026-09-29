import { useState, type FormEvent } from 'react';
import { toUserMessage } from '../api/errors';
import { useChat } from '../store/chatContext';
import styles from './NewChatForm.module.css';

interface Props {
  onClose: () => void;
}

export function NewChatForm({ onClose }: Props) {
  const { openChatByPhone } = useChat();
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsPending(true);
    try {
      const { warning } = await openChatByPhone(phone);
      if (warning !== null) {
        // Чат создан, но проверка номера не прошла — предупреждаем и оставляем форму открытой.
        setError(warning);
        return;
      }
      setPhone('');
      onClose();
    } catch (openError) {
      setError(toUserMessage(openError));
    } finally {
      setIsPending(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={(event) => void handleSubmit(event)}>
      <input
        className={styles.input}
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
        placeholder="+7 999 123-45-67"
        inputMode="tel"
        autoFocus
        required
      />
      <div className={styles.actions}>
        <button className={styles.primary} type="submit" disabled={isPending}>
          {isPending ? 'Проверяем…' : 'Создать чат'}
        </button>
        <button className={styles.secondary} type="button" onClick={onClose}>
          Отмена
        </button>
      </div>
      {error !== null && <p className={styles.error}>{error}</p>}
    </form>
  );
}
