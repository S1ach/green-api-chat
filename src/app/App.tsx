import { selectCredentials } from '@/entities/session';
import { LoginForm } from '@/features/configure-instance';
import { ChatPage } from '@/pages/chat';
import { useAppSelector } from '@/shared/lib/store';

export function App() {
  const isConnected = useAppSelector((state) => selectCredentials(state) !== null);
  return isConnected ? <ChatPage /> : <LoginForm />;
}
