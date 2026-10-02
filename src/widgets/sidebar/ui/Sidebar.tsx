import { useState } from 'react';
import { chatSelected, selectActiveChat, selectChats } from '@/entities/chat';
import { selectCredentials } from '@/entities/session';
import { disconnectInstance } from '@/features/configure-instance';
import { CreateChatForm } from '@/features/create-chat';
import { useLoadChats } from '@/features/load-chats';
import { useAppDispatch, useAppSelector } from '@/shared/lib/store';
import { ChatList } from './ChatList';
import { SidebarMenu } from './SidebarMenu';
import styles from './Sidebar.module.scss';

/** Боковая панель: подключённый инстанс, создание чата и список чатов. */
export function Sidebar() {
  const dispatch = useAppDispatch();
  const idInstance = useAppSelector((state) => selectCredentials(state)?.idInstance);
  const chats = useAppSelector(selectChats);
  const activeChatId = useAppSelector((state) => selectActiveChat(state)?.id ?? null);
  const [isCreating, setIsCreating] = useState(false);
  const { isLoading } = useLoadChats();

  return (
    <aside className={styles.sidebar}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Чаты</h1>
          <p className={styles.instance}>Инстанс {idInstance}</p>
        </div>
        <SidebarMenu
          onNewChat={() => setIsCreating(true)}
          onLogout={() => dispatch(disconnectInstance())}
        />
      </header>

      {isCreating && <CreateChatForm onClose={() => setIsCreating(false)} />}

      <ChatList
        chats={chats}
        activeChatId={activeChatId}
        isLoading={isLoading}
        onSelect={(chatId) => dispatch(chatSelected(chatId))}
      />
    </aside>
  );
}
