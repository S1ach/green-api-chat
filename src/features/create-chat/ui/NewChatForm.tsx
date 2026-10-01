import { useState, type FormEvent } from 'react';
import { formatPhone, normalizePhone } from '@/shared/lib/phone';
import { useAppDispatch } from '@/shared/lib/store';
import { openChatByPhone } from '../model/openChatByPhone';
import styles from './NewChatForm.module.scss';

interface Props {
  onClose: () => void;
}

export function NewChatForm({ onClose }: Props) {
  const dispatch = useAppDispatch();
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = normalizePhone(phone);
    if (normalized === null) {
      setError('Не удалось распознать номер. Пример: +7 999 123-45-67.');
      return;
    }

    setError(null);
    setIsPending(true);
    const result = await dispatch(openChatByPhone(normalized));
    setIsPending(false);

    if (result.status === 'failed') {
      setError(result.error);
    } else if (result.status === 'notRegistered') {
      setError(`Номер ${formatPhone(normalized)} не зарегистрирован в MAX.`);
    } else if (result.warning !== null) {
      // Чат создан, но проверка номера не прошла — предупреждаем и оставляем форму открытой.
      setError(result.warning);
    } else {
      onClose();
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
