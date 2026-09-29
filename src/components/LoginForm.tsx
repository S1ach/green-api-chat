import { useState, type FormEvent } from 'react';
import { toUserMessage } from '../api/errors';
import { useAuth } from '../store/authContext';
import styles from './LoginForm.module.css';

const DEFAULT_API_URL = 'https://api.green-api.com';

export function LoginForm() {
  const { login } = useAuth();
  const [apiUrl, setApiUrl] = useState(DEFAULT_API_URL);
  const [idInstance, setIdInstance] = useState('');
  const [apiTokenInstance, setApiTokenInstance] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsPending(true);
    try {
      await login({
        apiUrl: apiUrl.trim(),
        idInstance: idInstance.trim(),
        apiTokenInstance: apiTokenInstance.trim(),
      });
    } catch (loginError) {
      setError(toUserMessage(loginError));
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className={styles.screen}>
      <form className={styles.card} onSubmit={(event) => void handleSubmit(event)}>
        <h1 className={styles.title}>Вход в чат MAX</h1>
        <p className={styles.subtitle}>
          Данные инстанса можно посмотреть в личном кабинете{' '}
          <a href="https://console.green-api.com" target="_blank" rel="noreferrer">
            console.green-api.com
          </a>
          .
        </p>

        <label className={styles.field}>
          <span className={styles.label}>apiUrl</span>
          <input
            className={styles.input}
            value={apiUrl}
            onChange={(event) => setApiUrl(event.target.value)}
            placeholder={DEFAULT_API_URL}
            autoComplete="off"
            required
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>idInstance</span>
          <input
            className={styles.input}
            value={idInstance}
            onChange={(event) => setIdInstance(event.target.value)}
            placeholder="1101000001"
            inputMode="numeric"
            autoComplete="off"
            required
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>apiTokenInstance</span>
          <input
            className={styles.input}
            type="password"
            value={apiTokenInstance}
            onChange={(event) => setApiTokenInstance(event.target.value)}
            placeholder="d75b3a66374942c5b3c019c698abc2067e151558acbd412345"
            autoComplete="off"
            required
          />
        </label>

        {error !== null && <p className={styles.error}>{error}</p>}

        <button className={styles.submit} type="submit" disabled={isPending}>
          {isPending ? 'Проверяем…' : 'Войти'}
        </button>

        <p className={styles.hint}>
          Учётные данные сохраняются только в localStorage вашего браузера и никуда больше не
          передаются.
        </p>
      </form>
    </div>
  );
}
