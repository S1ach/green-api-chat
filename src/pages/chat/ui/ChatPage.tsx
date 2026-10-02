import { MessageSquare } from 'lucide-react';
import { selectActiveChat } from '@/entities/chat';
import { useNotificationPolling, useSettingsWarning } from '@/features/receive-message';
import { useAppSelector } from '@/shared/lib/store';
import { Alert } from '@/shared/ui';
import { Chat } from '@/widgets/chat';
import { Sidebar } from '@/widgets/sidebar';
import styles from './ChatPage.module.scss';

export function ChatPage() {
  const activeChat = useAppSelector(selectActiveChat);
  // Приём входящих живёт столько же, сколько страница: один цикл опроса на всю сессию.
  const polling = useNotificationPolling();
  const settingsWarning = useSettingsWarning();

  return (
    // На узком экране видно либо список чатов, либо переписку — см. data-view в стилях.
    <div className={styles.layout} data-view={activeChat === null ? 'list' : 'chat'}>
      <div className={styles.sidebar}>
        <Sidebar />
      </div>

      <main className={styles.main}>
        {polling.error !== null && (
          <Alert tone="warning" className={styles.alert}>
            Приём сообщений прерван. {polling.error} Повторяем автоматически.
          </Alert>
        )}
        {settingsWarning !== null && (
          <Alert tone="warning" className={styles.alert}>
            Входящие сообщения не будут приходить: {settingsWarning}
          </Alert>
        )}
        {activeChat === null ? (
          <div className={styles.placeholder}>
            <MessageSquare size={40} strokeWidth={1.5} aria-hidden="true" />
            <p>Выберите чат слева или создайте новый по номеру телефона.</p>
          </div>
        ) : (
          <Chat chat={activeChat} />
        )}
      </main>
    </div>
  );
}
