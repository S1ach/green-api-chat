import { useState } from 'react';
import { chatSelected, selectActiveChat, selectChats } from '@/entities/chat';
import { selectCredentials } from '@/entities/session';
import { disconnectInstance } from '@/features/configure-instance';
import { NewChatForm } from '@/features/create-chat';
import { useLoadChats } from '@/features/load-chats';
import { useNotificationPolling, useSettingsWarning } from '@/features/receive-message';
import { useAppDispatch, useAppSelector } from '@/shared/lib/store';
import { ChatWindow } from '@/widgets/chat';
import { ChatList, SidebarMenu } from '@/widgets/sidebar';
import styles from './ChatPage.module.scss';

export function ChatPage() {
  const dispatch = useAppDispatch();
  const credentials = useAppSelector(selectCredentials);
  const chats = useAppSelector(selectChats);
  const activeChat = useAppSelector(selectActiveChat);
  const [isCreating, setIsCreating] = useState(false);

  // Фоновая работа страницы: один цикл приёма уведомлений и загрузка списка чатов.
  const { error: pollingError } = useNotificationPolling();
  const settingsWarning = useSettingsWarning();
  useLoadChats();

  return (
    <div className={styles.layout} data-view={activeChat === null ? 'list' : 'chat'}>
      <aside className={styles.sidebar}>
        <header className={styles.sidebarHeader}>
          <div>
            <h1 className={styles.brand}>Чаты</h1>
            <p className={styles.instance}>Инстанс {credentials?.idInstance}</p>
          </div>
          <SidebarMenu
            onNewChat={() => setIsCreating(true)}
            onLogout={() => dispatch(disconnectInstance())}
          />
        </header>

        {isCreating && <NewChatForm onClose={() => setIsCreating(false)} />}

        <ChatList
          chats={chats}
          activeChatId={activeChat?.id ?? null}
          onSelect={(chatId) => dispatch(chatSelected(chatId))}
        />
      </aside>

      <main className={styles.main}>
        {pollingError !== null && (
          <p className={styles.banner} role="status">
            Приём сообщений прерван: {pollingError} Повторяем автоматически.
          </p>
        )}
        {settingsWarning !== null && (
          <p className={styles.banner} role="status">
            Входящие сообщения не будут приходить: {settingsWarning}
          </p>
        )}
        {activeChat === null ? (
          <div className={styles.placeholder}>
            <p>Выберите чат слева или создайте новый по номеру телефона.</p>
          </div>
        ) : (
          <ChatWindow chat={activeChat} onBack={() => dispatch(chatSelected(null))} />
        )}
      </main>
    </div>
  );
}
