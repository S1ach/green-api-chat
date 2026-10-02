import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithStore, testCredentials } from '@/app/providers/store/testing';
import { selectMessages, type ChatState } from '@/entities/chat';
import { mockGreenApi } from '@/shared/lib/test/mockGreenApi';
import { retryMessage } from '../model/sendMessage';
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
  return { user, store, input, sendButton, messages };
}

beforeEach(() => {
  api = mockGreenApi();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('MessageInput', () => {
  it('не отправляет пустое сообщение и сообщение из одних пробелов', async () => {
    const { user, input, sendButton, messages } = setup();

    expect(sendButton).toBeDisabled();
    await user.type(input, '{Enter}');
    await user.type(input, '   {Enter}');

    expect(sendButton).toBeDisabled();
    expect(api.calls).toHaveLength(0);
    expect(messages()).toHaveLength(0);
  });

  it('по Enter сразу показывает сообщение как отправляемое и очищает поле', async () => {
    // Ответа на sendMessage пока нет — запрос «в полёте».
    const { user, input, messages } = setup();

    await user.type(input, '  Привет!  {Enter}');

    expect(input).toHaveValue('');
    expect(input).toHaveFocus();
    expect(messages()).toMatchObject([
      { chatId: CHAT_ID, direction: 'outgoing', text: 'Привет!', status: 'sending' },
    ]);
    expect(api.methods()).toEqual(['sendMessage']);
  });

  it('после ответа API отмечает сообщение отправленным под его idMessage', async () => {
    api.reply('sendMessage', { idMessage: 'out-1' });
    const { user, input, messages } = setup();

    await user.type(input, 'Привет!{Enter}');

    await waitFor(() =>
      expect(messages()).toMatchObject([{ id: 'out-1', text: 'Привет!', status: 'sent' }]),
    );
  });

  it('отправляет по кнопке', async () => {
    api.reply('sendMessage', { idMessage: 'out-1' });
    const { user, input, sendButton, messages } = setup();

    await user.type(input, 'Привет!');
    await user.click(sendButton);

    await waitFor(() => expect(messages()).toMatchObject([{ id: 'out-1', status: 'sent' }]));
    expect(input).toHaveValue('');
  });

  it('по Shift+Enter переносит строку и ничего не отправляет', async () => {
    const { user, input } = setup();

    await user.type(input, 'Первая{Shift>}{Enter}{/Shift}вторая');

    expect(input).toHaveValue('Первая\nвторая');
    expect(api.calls).toHaveLength(0);
  });

  it('двойное нажатие отправляет сообщение один раз', async () => {
    const { user, input, sendButton, messages } = setup();

    await user.type(input, 'Привет!');
    await user.dblClick(sendButton);
    await user.type(input, '{Enter}{Enter}');

    expect(api.methods()).toEqual(['sendMessage']);
    expect(messages()).toHaveLength(1);
  });

  it('при ошибке оставляет сообщение в чате с причиной, а повтор отправляет его снова', async () => {
    api.reply('sendMessage', { message: 'Bad Request' }, 400);
    const { user, store, input, messages } = setup();

    await user.type(input, 'Привет!{Enter}');

    await waitFor(() => expect(messages()[0]?.status).toBe('error'));
    expect(messages()[0]?.text).toBe('Привет!');
    expect(messages()[0]?.error).toContain('Некорректный запрос (400)');

    api.reply('sendMessage', { idMessage: 'out-2' });
    await store.dispatch(retryMessage(CHAT_ID, messages()[0]?.id ?? ''));

    // Сообщение одно: повтор не создаёт копию.
    expect(messages()).toMatchObject([{ id: 'out-2', text: 'Привет!', status: 'sent' }]);
    expect(api.methods()).toEqual(['sendMessage', 'sendMessage']);
  });
});
