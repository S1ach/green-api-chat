import { act, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHookWithStore } from '@/app/providers/store/testing';
import { selectChats, selectMessages } from '@/entities/chat';
import { mockGreenApi } from '@/shared/lib/test/mockGreenApi';
import { useNotificationPolling } from './useNotificationPolling';

const incomingText = {
  typeWebhook: 'incomingMessageReceived',
  timestamp: 1_763_115_112,
  idMessage: 'msg-1',
  senderData: { chatId: '10000000', senderName: 'Иван', senderPhoneNumber: 79991234567 },
  messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: 'Привет!' } },
};

let api: ReturnType<typeof mockGreenApi>;

beforeEach(() => {
  api = mockGreenApi();
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('useNotificationPolling', () => {
  it('получает сообщение, удаляет уведомление и только потом запрашивает следующее', async () => {
    api.reply('receiveNotification', { receiptId: 7, body: incomingText });
    api.reply('deleteNotification', { result: true });

    const { store } = renderHookWithStore(() => useNotificationPolling());

    await waitFor(() =>
      expect(api.methods()).toEqual([
        'receiveNotification',
        'deleteNotification',
        'receiveNotification',
      ]),
    );
    expect(api.calls[1]?.url).toMatch(/\/deleteNotification\/test-token\/7$/);
    expect(selectMessages(store.getState(), '10000000')).toEqual([
      {
        id: 'msg-1',
        chatId: '10000000',
        direction: 'incoming',
        text: 'Привет!',
        timestamp: 1_763_115_112_000,
      },
    ]);
  });

  it('не показывает неподдерживаемое уведомление, но удаляет его из очереди', async () => {
    api.reply('receiveNotification', {
      receiptId: 8,
      body: { typeWebhook: 'outgoingMessageStatus', status: 'delivered' },
    });
    api.reply('deleteNotification', { result: true });

    const { store } = renderHookWithStore(() => useNotificationPolling());

    await waitFor(() => expect(api.methods()).toContain('deleteNotification'));
    expect(selectChats(store.getState())).toEqual([]);
  });

  it('показывает сообщение, отправленное с телефона, и обновляет его статус по уведомлению', async () => {
    api.reply('receiveNotification', {
      receiptId: 10,
      body: { ...incomingText, typeWebhook: 'outgoingMessageReceived', idMessage: 'out-1' },
    });
    api.reply('deleteNotification', { result: true });
    api.reply('receiveNotification', {
      receiptId: 11,
      body: {
        typeWebhook: 'outgoingMessageStatus',
        chatId: '10000000',
        idMessage: 'out-1',
        status: 'read',
      },
    });
    api.reply('deleteNotification', { result: true });

    const { store } = renderHookWithStore(() => useNotificationPolling());

    await waitFor(() => expect(api.methods()).toHaveLength(5));
    expect(selectMessages(store.getState(), '10000000')).toMatchObject([
      { id: 'out-1', direction: 'outgoing', text: 'Привет!', status: 'read' },
    ]);
    // Своё сообщение непрочитанным не считается.
    expect(selectChats(store.getState())[0]?.unreadCount).toBe(0);
  });

  it('показывает входящее сообщение с файлом вместо того, чтобы потерять его', async () => {
    api.reply('receiveNotification', {
      receiptId: 12,
      body: {
        ...incomingText,
        messageData: {
          typeMessage: 'imageMessage',
          fileMessageData: { downloadUrl: 'https://storage.example/a.webp', caption: '' },
        },
      },
    });
    api.reply('deleteNotification', { result: true });

    const { store } = renderHookWithStore(() => useNotificationPolling());

    await waitFor(() => expect(api.methods()).toContain('deleteNotification'));
    expect(selectChats(store.getState())[0]).toMatchObject({ lastPreview: 'Фото', unreadCount: 1 });
  });

  it('не превращает пустые ответы очереди в поток запросов', async () => {
    vi.useFakeTimers();
    // Сервер отвечает «пусто» мгновенно, не дожидаясь receiveTimeout.
    for (let index = 0; index < 50; index += 1) {
      api.reply('receiveNotification');
    }

    renderHookWithStore(() => useNotificationPolling());
    await act(() => vi.advanceTimersByTimeAsync(3500));

    // Не больше одного запроса в секунду вместо пятидесяти подряд.
    expect(api.calls.length).toBeLessThanOrEqual(4);
  });

  it('не дублирует сообщение, если уведомление доставлено повторно', async () => {
    api.reply('receiveNotification', { receiptId: 7, body: incomingText });
    api.reply('deleteNotification', { result: true });
    api.reply('receiveNotification', { receiptId: 9, body: incomingText });
    api.reply('deleteNotification', { result: true });

    const { store } = renderHookWithStore(() => useNotificationPolling());

    await waitFor(() => expect(api.methods()).toHaveLength(5));
    expect(selectMessages(store.getState(), '10000000')).toHaveLength(1);
  });

  it('держит один цикл опроса даже при двойном монтировании эффектов (StrictMode)', async () => {
    renderHookWithStore(() => useNotificationPolling(), { strict: true });

    await waitFor(() => expect(api.pending('receiveNotification')).toHaveLength(1));
    // Первый цикл отменён вместе со своим запросом, работает только второй.
    expect(api.calls).toHaveLength(2);
    expect(api.calls[0]?.signal.aborted).toBe(true);
  });

  it('останавливается при размонтировании: отменяет запрос и не шлёт новых', async () => {
    const { unmount } = renderHookWithStore(() => useNotificationPolling());
    await waitFor(() => expect(api.pending('receiveNotification')).toHaveLength(1));

    unmount();

    expect(api.pending('receiveNotification')).toHaveLength(0);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(api.calls).toHaveLength(1);
  });

  it('сообщает об ошибке и после паузы повторяет запрос', async () => {
    vi.useFakeTimers();
    api.fail('receiveNotification');

    const { result } = renderHookWithStore(() => useNotificationPolling());

    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(result.current.error).toMatch(/Не удалось связаться с GREEN-API/);
    expect(api.calls).toHaveLength(1);

    api.reply('receiveNotification');
    await act(() => vi.advanceTimersByTimeAsync(1000));

    expect(result.current.error).toBeNull();
    expect(api.calls.length).toBeGreaterThanOrEqual(2);
  });
});
