import { selectCredentials } from '@/entities/session';
import { ChatPage } from '@/pages/chat';
import { LoginPage } from '@/pages/login';
import { useAppSelector } from '@/shared/lib/store';

export function App() {
  const isConnected = useAppSelector((state) => selectCredentials(state) !== null);
  return isConnected ? <ChatPage /> : <LoginPage />;
}
