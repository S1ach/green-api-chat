import { createContext, useContext } from 'react';
import type { Chat, ChatMessage } from '../types/chat';

export interface OpenChatResult {
  chatId: string;
  /** Непустое значение — чат создан, но с оговоркой (например, CheckAccount недоступен). */
  warning: string | null;
}

export interface ChatContextValue {
  chats: Chat[];
  activeChat: Chat | null;
  activeMessages: ChatMessage[];
  /** Ошибка фонового опроса уведомлений, если он сейчас не работает. */
  pollingError: string | null;
  /** Ошибка загрузки истории открытого чата через GetChatHistory. */
  historyError: string | null;
  /** Настройки инстанса мешают приёму входящих (webhookUrl / incomingWebhook). */
  settingsWarning: string | null;
  openChatByPhone: (input: string) => Promise<OpenChatResult>;
  selectChat: (chatId: string) => void;
  closeChat: () => void;
  sendText: (text: string) => Promise<void>;
}

export const ChatContext = createContext<ChatContextValue | null>(null);

export function useChat(): ChatContextValue {
  const context = useContext(ChatContext);
  if (context === null) {
    throw new Error('useChat доступен только внутри ChatProvider');
  }
  return context;
}
