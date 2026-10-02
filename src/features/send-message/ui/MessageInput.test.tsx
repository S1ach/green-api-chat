import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithStore, testCredentials } from '@/app/providers/store/testing';
import { selectMessages, type ChatState } from '@/entities/chat';
import { mockGreenApi } from '@/shared/lib/test/mockGreenApi';
import { MessageInput } from './MessageInput';

const CHAT_ID = '10000000';

const chatState: ChatState = {
  chats: {
    [CHAT_ID]: {
      id: CHAT_ID,
      phone: '79991234567',
      title: 'Иван',
      chatType: 'user',
      unreadCount: 0,
      lastActivity: 0,
      lastPreview: '',
    },
  },
  chatOrder: [CHAT_ID],
  messages: { [CHAT_ID]: [] },
  activeChatId: CHAT_ID,
};

let api: ReturnType<typeof mockGreenApi>;

function setup() {
  const user = userEvent.setup();
  const { store } = renderWithStore(<MessageInput chatId={CHAT_ID} />, {
    preloadedState: { session: { credentials: testCredentials }, chat: chatState },
  });
  const input = screen.getByRole('textbox', { name: 'Текст сообщения' });
  const sendButton = screen.getByRole('button', { name: 'Отправить' });
  const messages = () => selectMessages(store.getState(), CHAT_ID);
  return { user, input, sendButton, messages };
}

beforeEach(() => {
  api = mockGreenApi();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('MessageInput', () => {
  it('не отправляет пустое сообщение и сообщение из одних пробелов', async () => {
    const { user, input, sendButton } = setup();

    expect(sendButton).toBeDisabled();
    await user.type(input, '{Enter}');
    await user.type(input, '   {Enter}');

    expect(sendButton).toBeDisabled();
    expect(api.calls).toHaveLength(0);
  });

  it('отправляет по Enter: сообщение появляется в чате, поле очищается', async () => {
    api.reply('sendMessage', { idMessage: 'out-1' });
    const { user, input, messages } = setup();

    await user.type(input, '  Привет!  {Enter}');

    await waitFor(() => expect(input).toHaveValue(''));
    expect(api.methods()).toEqual(['sendMessage']);
    expect(messages()).toMatchObject([
      { id: 'out-1', chatId: CHAT_ID, direction: 'outgoing', text: 'Привет!' },
    ]);
    expect(input).toHaveFocus();
  });

  it('отправляет по кнопке', async () => {
    api.reply('sendMessage', { idMessage: 'out-1' });
    const { user, input, sendButton, messages } = setup();

    await user.type(input, 'Привет!');
    await user.click(sendButton);

    await waitFor(() => expect(messages()).toHaveLength(1));
    expect(input).toHaveValue('');
  });

  it('по Shift+Enter переносит строку и ничего не отправляет', async () => {
    const { user, input } = setup();

    await user.type(input, 'Первая{Shift>}{Enter}{/Shift}вторая');

    expect(input).toHaveValue('Первая\nвторая');
    expect(api.calls).toHaveLength(0);
  });

  it('при ошибке показывает её, сохраняет текст и позволяет отправить ещё раз', async () => {
    api.reply('sendMessage', { message: 'Too Many Requests' }, 429);
    const { user, input, messages } = setup();

    await user.type(input, 'Привет!{Enter}');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Сообщение не отправлено. Слишком много запросов (429)',
    );
    expect(input).toHaveValue('Привет!');
    expect(messages()).toHaveLength(0);

    api.reply('sendMessage', { idMessage: 'out-2' });
    await user.type(input, '{Enter}');

    await waitFor(() => expect(input).toHaveValue(''));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(messages()).toMatchObject([{ id: 'out-2', text: 'Привет!' }]);
  });

  it('пока запрос выполняется, не даёт отправить сообщение второй раз', async () => {
    // Ответа на sendMessage нет — запрос остаётся «в полёте».
    const { user, input, sendButton } = setup();

    await user.type(input, 'Привет!{Enter}');
    await waitFor(() => expect(sendButton).toBeDisabled());
    await user.type(input, '{Enter}');

    expect(api.methods()).toEqual(['sendMessage']);
    expect(input).toHaveValue('Привет!');
  });
});
