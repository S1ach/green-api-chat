import { useState } from 'react';
import { ChatList } from './components/ChatList';
import { ChatWindow } from './components/ChatWindow';
import { LoginForm } from './components/LoginForm';
import { NewChatForm } from './components/NewChatForm';
import { useAuth } from './store/authContext';
import { useChat } from './store/chatContext';
import styles from './App.module.css';

function Workspace() {
  const { credentials, logout } = useAuth();
  const { chats, activeChat, activeMessages, pollingError, selectChat, closeChat, sendText } =
    useChat();
  const [isCreating, setIsCreating] = useState(false);

  return (
    <div className={styles.layout} data-view={activeChat === null ? 'list' : 'chat'}>
      <aside className={styles.sidebar}>
        <header className={styles.sidebarHeader}>
          <div>
            <h1 className={styles.brand}>Чаты</h1>
            <p className={styles.instance}>Инстанс {credentials?.idInstance}</p>
          </div>
          <button className={styles.logout} type="button" onClick={logout}>
            Выйти
          </button>
        </header>

        <div className={styles.newChatRow}>
          <button
            className={styles.newChat}
            type="button"
            onClick={() => setIsCreating((value) => !value)}
          >
            {isCreating ? 'Закрыть' : '+ Новый чат'}
          </button>
        </div>
        {isCreating && <NewChatForm onClose={() => setIsCreating(false)} />}

        <ChatList
          chats={chats}
          activeChatId={activeChat?.id ?? null}
          onSelect={(chatId) => selectChat(chatId)}
        />
      </aside>

      <main className={styles.main}>
        {pollingError !== null && (
          <p className={styles.banner} role="status">
            Приём сообщений прерван: {pollingError} Повторяем автоматически.
          </p>
        )}
        {activeChat === null ? (
          <div className={styles.placeholder}>
            <p>Выберите чат слева или создайте новый по номеру телефона.</p>
          </div>
        ) : (
          <ChatWindow
            chat={activeChat}
            messages={activeMessages}
            onSend={(text) => void sendText(text)}
            onBack={closeChat}
          />
        )}
      </main>
    </div>
  );
}

export default function App() {
  const { credentials } = useAuth();
  return credentials === null ? <LoginForm /> : <Workspace />;
}
