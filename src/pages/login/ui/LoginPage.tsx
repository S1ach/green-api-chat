import { CredentialsForm } from '@/features/configure-instance';
import styles from './LoginPage.module.scss';

export function LoginPage() {
  return (
    <main className={styles.screen}>
      <section className={styles.card}>
        <header className={styles.header}>
          <h1 className={styles.title}>Вход в чат</h1>
          <p className={styles.hint}>
            Данные инстанса можно посмотреть в личном кабинете{' '}
            <a href="https://console.green-api.com" target="_blank" rel="noreferrer">
              console.green-api.com
            </a>
          </p>
        </header>

        <CredentialsForm />

        <p className={styles.hint}>
          Учётные данные сохраняются только в localStorage вашего браузера и никуда больше не
          передаются.
        </p>
      </section>
    </main>
  );
}
