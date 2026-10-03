import { useCallback, useState } from 'react';
import { chatSelected, selectActiveChat, selectChats } from '@/entities/chat';
import { selectCredentials } from '@/entities/session';
import { disconnectInstance } from '@/features/configure-instance';
import { CreateChatForm } from '@/features/create-chat';
import { ChatSearch, filterChats } from '@/features/search-chats';
import { useChatSync } from '@/features/sync-chats';
import { useAppDispatch, useAppSelector } from '@/shared/lib/store';
import { ChatList } from './ChatList';
import { SidebarMenu } from './SidebarMenu';
import styles from './Sidebar.module.scss';

export function Sidebar() {
  const dispatch = useAppDispatch();
  const idInstance = useAppSelector((state) => selectCredentials(state)?.idInstance);
  const chats = useAppSelector(selectChats);
  const activeChatId = useAppSelector((state) => selectActiveChat(state)?.id ?? null);
  const [isCreating, setIsCreating] = useState(false);
  const [query, setQuery] = useState('');
  const { isLoading } = useChatSync();

  const isSearching = query.trim() !== '';
  const handleSelect = useCallback((chatId: string) => dispatch(chatSelected(chatId)), [dispatch]);

  return (
    <aside className={styles.sidebar}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <h1 className={styles.title}>Чаты</h1>
          <p className={styles.instance}>Инстанс {idInstance}</p>
        </div>
        <SidebarMenu
          onNewChat={() => setIsCreating(true)}
          onLogout={() => dispatch(disconnectInstance())}
        />
      </header>

      <ChatSearch value={query} onChange={setQuery} />

      {isCreating && <CreateChatForm onClose={() => setIsCreating(false)} />}

      <ChatList
        chats={filterChats(chats, query)}
        activeChatId={activeChatId}
        // при поиске пустой список — это «не найдено», а не загрузка
        isLoading={isLoading && !isSearching}
        emptyText={
          isSearching
            ? 'Ничего не найдено. Поиск идёт по имени и номеру телефона.'
            : 'Чатов пока нет. Создайте первый по номеру телефона.'
        }
        onSelect={handleSelect}
      />
    </aside>
  );
}
