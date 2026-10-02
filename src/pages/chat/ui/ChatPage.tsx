import { MessageCircle } from 'lucide-react';
import { selectActiveChat } from '@/entities/chat';
import { useNotificationPolling, useReceivingSetup } from '@/features/receive-message';
import { useRateLimitCountdown } from '@/shared/api';
import { useAppSelector } from '@/shared/lib/store';
import { Alert, Button } from '@/shared/ui';
import { Chat } from '@/widgets/chat';
import { Sidebar } from '@/widgets/sidebar';
import styles from './ChatPage.module.scss';

/** Плашки о состоянии связи с GREEN-API: что мешает получать сообщения и что с этим делать. */
function ConnectionNotices() {
  // Приём входящих живёт столько же, сколько страница: один цикл опроса на всю сессию.
  const polling = useNotificationPolling();
  const setup = useReceivingSetup();
  const retryInSeconds = useRateLimitCountdown();

  return (
    <div className={styles.notices}>
      {retryInSeconds !== null && (
        <Alert tone="info">
          Слишком много запросов. Повторная попытка через {retryInSeconds} с.
        </Alert>
      )}
      {polling.error !== null && (
        <Alert tone="warning">
          Приём сообщений прерван. {polling.error} Повторяем автоматически.
        </Alert>
      )}
      {setup.isApplying ? (
        <Alert tone="info">
          Настройки сохранены. Инстанс перезапускается и применяет их — это занимает до 5 минут.
        </Alert>
      ) : (
        setup.problem !== null && (
          <Alert
            tone="warning"
            action={
              setup.problem.canFix && (
                <Button
                  variant="ghost"
                  size="xsmall"
                  onClick={setup.fix}
                  isLoading={setup.isFixing}
                >
                  Включить
                </Button>
              )
            }
          >
            {setup.problem.message}
          </Alert>
        )
      )}
      {setup.fixError !== null && (
        <Alert>Не удалось изменить настройки инстанса. {setup.fixError}</Alert>
      )}
    </div>
  );
}

export function ChatPage() {
  const activeChat = useAppSelector(selectActiveChat);

  return (
    // На узком экране видно либо список чатов, либо переписку — см. data-view в стилях.
    <div className={styles.layout} data-view={activeChat === null ? 'list' : 'chat'}>
      <div className={styles.sidebar}>
        <Sidebar />
      </div>

      <main className={styles.main}>
        <ConnectionNotices />
        {activeChat === null ? (
          <div className={styles.placeholder}>
            <MessageCircle size={48} strokeWidth={1.5} aria-hidden="true" />
            <p className={styles.placeholderTitle}>Выберите чат</p>
            <p>Или создайте новый по номеру телефона</p>
          </div>
        ) : (
          // key: у каждого чата своя прокрутка, свой черновик и своя глубина истории.
          <Chat key={activeChat.id} chat={activeChat} />
        )}
      </main>
    </div>
  );
}
