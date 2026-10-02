import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockGreenApi } from '@/shared/lib/test/mockGreenApi';
import { App } from './App';
import { renderWithStore } from './providers/store/testing';

let api: ReturnType<typeof mockGreenApi>;

beforeEach(() => {
  api = mockGreenApi();
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('App: сценарий из ТЗ', () => {
  it('подключение → новый чат → отправка → получение ответа → выход', async () => {
    const user = userEvent.setup();
    api.reply('getStateInstance', { stateInstance: 'authorized' });
    api.reply('getSettings', { webhookUrl: '', incomingWebhook: 'yes' });
    api.reply('getChats', []);
    api.reply('checkAccount', { exist: true, chatId: '10000000' });
    api.reply('getAvatar', { urlAvatar: '' });
    api.reply('getChatHistory', []);
    api.reply('sendMessage', { idMessage: 'out-1' });

    // StrictMode, как в приложении: эффекты монтируются дважды.
    const { store } = renderWithStore(<App />, { preloadedState: {}, strict: true });

    // 1. Пользователь вводит учётные данные инстанса.
    await user.type(screen.getByLabelText('idInstance'), '1101000001');
    await user.type(screen.getByLabelText('apiTokenInstance'), 'test-token');
    await user.click(screen.getByRole('button', { name: 'Войти' }));
    expect(
      await screen.findByText('Чатов пока нет. Создайте первый по номеру телефона.'),
    ).toBeInTheDocument();
    expect(screen.getByText(/Выберите чат слева/)).toBeInTheDocument();

    // 2. Создаёт чат по номеру телефона получателя.
    await user.click(screen.getByRole('button', { name: 'Меню' }));
    await user.click(screen.getByRole('menuitem', { name: 'Новый чат' }));
    await user.type(screen.getByLabelText('Номер телефона получателя'), '+7 999 123-45-67');
    await user.click(screen.getByRole('button', { name: 'Создать чат' }));
    expect(await screen.findByRole('heading', { name: '+7 (999) 123-45-67' })).toBeInTheDocument();
    expect(await screen.findByText('Сообщений пока нет — напишите первым.')).toBeInTheDocument();

    // 3. Отправляет текстовое сообщение.
    const input = screen.getByRole('textbox', { name: 'Текст сообщения' });
    await user.type(input, 'Привет!{Enter}');
    const log = screen.getByRole('log');
    expect(await within(log).findByRole('listitem', { name: 'Ваше сообщение' })).toHaveTextContent(
      'Привет!',
    );
    expect(input).toHaveValue('');

    // 4. Получатель отвечает: ответ приходит через очередь уведомлений.
    await waitFor(() => expect(api.pending('receiveNotification')).toHaveLength(1));
    api.reply('receiveNotification', {
      receiptId: 1,
      body: {
        typeWebhook: 'incomingMessageReceived',
        timestamp: Math.floor(Date.now() / 1000) + 60,
        idMessage: 'in-1',
        senderData: { chatId: '10000000', senderName: 'Иван', senderPhoneNumber: 79991234567 },
        messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: 'И тебе!' } },
      },
    });
    api.reply('deleteNotification', { result: true });
    // Long polling: текущий «висящий» запрос завершается пустым ответом, следующий отдаёт уведомление.
    api.pending('receiveNotification')[0]?.release();

    expect(
      await within(log).findByRole('listitem', { name: 'Входящее сообщение' }),
    ).toHaveTextContent('И тебе!');
    await waitFor(() => expect(api.methods()).toContain('deleteNotification'));
    expect(within(log).getAllByRole('listitem')).toHaveLength(2);

    // Цикл опроса по-прежнему один.
    await waitFor(() => expect(api.pending('receiveNotification')).toHaveLength(1));

    // 5. Выход останавливает опрос и очищает состояние.
    await user.click(screen.getByRole('button', { name: 'Меню' }));
    await user.click(screen.getByRole('menuitem', { name: 'Выйти' }));

    expect(await screen.findByRole('button', { name: 'Войти' })).toBeInTheDocument();
    expect(api.pending('receiveNotification')).toHaveLength(0);
    expect(store.getState().chat.chatOrder).toEqual([]);
    expect(store.getState().session.credentials).toBeNull();
  });
});
