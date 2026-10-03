import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithStore, testCredentials } from '@/app/providers/store/testing';
import type { Chat, ChatState } from '@/entities/chat';
import { mockGreenApi } from '@/shared/lib/test/mockGreenApi';
import { ChatPage } from './ChatPage';

function chat(id: string, title: string): Chat {
  return {
    id,
    title,
    phone: null,
    chatType: 'user',
    unreadCount: 0,
    lastActivity: 0,
    lastPreview: '',
  };
}

// как на новом компьютере: чаты есть, сообщений в памяти нет
const chatState: ChatState = {
  chats: { a: chat('a', 'Анна'), b: chat('b', 'Борис'), c: chat('c', 'Вера') },
  chatOrder: ['a', 'b', 'c'],
  messages: {},
  activeChatId: null,
};

function historyItem(chatId: string, idMessage: string, textMessage: string, timestamp = 100) {
  return {
    type: 'incoming',
    idMessage,
    timestamp,
    typeMessage: 'textMessage',
    chatId,
    textMessage,
  };
}

let api: ReturnType<typeof mockGreenApi>;

function setup() {
  const user = userEvent.setup();
  const view = renderWithStore(<ChatPage />, {
    preloadedState: { session: { credentials: testCredentials }, chat: chatState },
  });
  const open = (title: string) =>
    user.click(screen.getByRole('button', { name: new RegExp(title) }));
  const texts = () =>
    within(screen.getByRole('log'))
      .queryAllByRole('listitem')
      .map((item) => item.querySelector('p')?.firstChild?.textContent);
  return { user, open, texts, ...view };
}

const LONG = { timeout: 4000 };

beforeEach(() => {
  api = mockGreenApi();
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('ChatPage: история сообщений', () => {
  it('без локального кэша загружает историю с сервера и показывает её по порядку', async () => {
    api.reply('getChatHistory', [
      historyItem('a', '1002', 'Второе', 200),
      historyItem('a', '1001', 'Первое', 100),
    ]);
    const { open, texts } = setup();

    await open('Анна');

    expect(screen.getByRole('status', { name: 'Загружаем сообщения' })).toBeInTheDocument();
    await waitFor(() => expect(texts()).toEqual(['Первое', 'Второе']));
    expect(api.callsOf('getChatHistory')[0]?.body).toEqual({ chatId: 'a', count: 100 });
  });

  it('если историю получить не удалось, показывает ошибку и повторяет по кнопке', async () => {
    api.reply('getChatHistory', { message: 'Internal error' }, 500);
    const { user, open, texts } = setup();

    await open('Анна');
    expect(await screen.findByText('Не удалось загрузить сообщения')).toBeInTheDocument();

    api.reply('getChatHistory', [historyItem('a', '1001', 'Теперь загрузилось')]);
    await user.click(screen.getByRole('button', { name: 'Повторить' }));

    await waitFor(() => expect(texts()).toEqual(['Теперь загрузилось']), LONG);
    expect(screen.queryByText('Не удалось загрузить сообщения')).not.toBeInTheDocument();
  });

  it('при ответе 429 сам повторяет запрос: пользователь видит ожидание, а не ошибку', async () => {
    api.reply('getChatHistory', { message: 'Too Many Requests' }, 429);
    api.reply('getChatHistory', [historyItem('a', '1001', 'Загрузилось после паузы')]);
    const { open, texts } = setup();

    await open('Анна');

    expect(
      await screen.findByText(/Слишком много запросов. Повторная попытка через \d+ с\./),
    ).toBeInTheDocument();
    await waitFor(() => expect(texts()).toEqual(['Загрузилось после паузы']), LONG);
    expect(screen.queryByText('Не удалось загрузить сообщения')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText(/Слишком много запросов/)).toBeNull(), LONG);
  });

  it('при быстром переключении чатов сообщения не смешиваются, а лишних запросов нет', async () => {
    const { open, texts } = setup();

    // Чат A: ответ истории задерживается.
    await open('Анна');
    await waitFor(() => expect(api.pending('getChatHistory')).toHaveLength(1));

    // Пользователь уже ушёл в чат B, и его история пришла первой.
    api.reply('getChatHistory', [historyItem('b', '2001', 'Сообщение Бориса')]);
    await open('Борис');
    await waitFor(() => expect(texts()).toEqual(['Сообщение Бориса']), LONG);

    // Запоздавший ответ чата A не должен попасть в открытый чат B.
    api.callsOf('getChatHistory')[0]?.release([historyItem('a', '1001', 'Сообщение Анны')]);
    await waitFor(() => expect(api.pending('getChatHistory')).toHaveLength(0));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(texts()).toEqual(['Сообщение Бориса']);

    // Возврат в чат A: его сообщения на месте, повторного запроса нет.
    await open('Анна');
    await waitFor(() => expect(texts()).toEqual(['Сообщение Анны']));

    api.reply('getChatHistory', []);
    await open('Вера');
    expect(await screen.findByText('Сообщений пока нет', {}, LONG)).toBeInTheDocument();

    expect(api.callsOf('getChatHistory').map((call) => call.body)).toEqual([
      { chatId: 'a', count: 100 },
      { chatId: 'b', count: 100 },
      { chatId: 'c', count: 100 },
    ]);
  });

  it('подгружает более ранние сообщения, запрашивая больше', async () => {
    const page = Array.from({ length: 100 }, (_, index) =>
      historyItem('a', String(2000 - index), `Сообщение ${100 - index}`, 2000 - index),
    );
    const older = [historyItem('a', '1000', 'Самое раннее', 1)];
    api.reply('getChatHistory', page);
    const { user, open, texts } = setup();

    await open('Анна');
    await waitFor(() => expect(texts()).toHaveLength(100));

    api.reply('getChatHistory', [...page, ...older]);
    await user.click(screen.getByRole('button', { name: 'Показать более ранние' }));

    await waitFor(() => expect(texts()).toHaveLength(101), LONG);
    expect(texts()[0]).toBe('Самое раннее');
    expect(api.callsOf('getChatHistory')[1]?.body).toEqual({ chatId: 'a', count: 200 });
  });
});

describe('ChatPage: закрытие чата', () => {
  it('кнопка в шапке закрывает чат и возвращает к экрану «Выберите чат»', async () => {
    api.reply('getChatHistory', [historyItem('a', '1001', 'Первое')]);
    const { user, open, store } = setup();
    expect(screen.getByText('Выберите чат')).toBeInTheDocument();

    await open('Анна');
    expect(screen.queryByText('Выберите чат')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Закрыть чат' }));

    expect(screen.getByText('Выберите чат')).toBeInTheDocument();
    expect(screen.queryByRole('log')).not.toBeInTheDocument();
    expect(store.getState().chat.activeChatId).toBeNull();
  });
});

describe('ChatPage: настройки приёма сообщений', () => {
  it('объясняет, почему не приходят сообщения из MAX, и включает нужные уведомления', async () => {
    api.reply('getSettings', { webhookUrl: '', incomingWebhook: 'no' });
    const { user } = setup();

    expect(
      await screen.findByText(/выключено получение уведомлений о входящих/),
    ).toBeInTheDocument();

    api.reply('setSettings', { saveSettings: true });
    api.reply('getSettings', { webhookUrl: '', incomingWebhook: 'yes' });
    await user.click(screen.getByRole('button', { name: 'Включить' }));

    expect(await screen.findByText(/Настройки сохранены/)).toBeInTheDocument();
    expect(api.callsOf('setSettings')[0]?.body).toEqual({
      incomingWebhook: 'yes',
      outgoingMessageWebhook: 'yes',
      outgoingWebhook: 'yes',
    });
    expect(screen.queryByText(/выключено получение уведомлений/)).not.toBeInTheDocument();
  });

  it('про чужой webhookUrl только сообщает: стирать его приложение не предлагает', async () => {
    api.reply('getSettings', { webhookUrl: 'https://example.com/hook', incomingWebhook: 'yes' });
    setup();

    expect(await screen.findByText(/задан webhookUrl/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Включить' })).not.toBeInTheDocument();
  });

  it('не показывает предупреждений, когда настройки в порядке', async () => {
    api.reply('getSettings', { webhookUrl: '', incomingWebhook: 'yes' });
    setup();

    await waitFor(() => expect(api.callsOf('getSettings')[0]?.answered).toBe(true));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByText('Выберите чат')).toBeInTheDocument();
  });
});
