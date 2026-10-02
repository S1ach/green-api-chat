import { act, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHookWithStore } from '@/app/providers/store/testing';
import { selectChats, selectMessages } from '@/entities/chat';
import { mockGreenApi } from '@/shared/lib/test/mockGreenApi';
import { useChatSync } from './useChatSync';

const NOW_SECONDS = Math.floor(Date.now() / 1000);

function journalItem(idMessage: string, chatId: string, textMessage: string, ageSeconds = 0) {
  return {
    type: 'incoming',
    idMessage,
    timestamp: NOW_SECONDS - ageSeconds,
    typeMessage: 'textMessage',
    chatId,
    chatType: 'user',
    textMessage,
    senderName: 'Иван',
  };
}

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

const journalCalls = () => api.methods().filter((method) => method.startsWith('last')).length;

describe('useChatSync', () => {
  it('на новом компьютере (пустой localStorage) получает чаты и последние сообщения с сервера', async () => {
    api.reply('getChats', [
      { chatId: '10000000', name: 'Иван', type: 'user', phoneNumber: 79991234567 },
      { chatId: '10000001', name: 'Мария', type: 'user', phoneNumber: 0 },
    ]);
    api.reply('lastIncomingMessages', [journalItem('in-1', '10000000', 'Старое сообщение', 600)]);
    api.reply('lastOutgoingMessages', [
      { ...journalItem('out-1', '10000001', 'Ответ', 60), type: 'outgoing', statusMessage: 'read' },
    ]);

    const { store } = renderHookWithStore(() => useChatSync());

    await waitFor(() => expect(selectMessages(store.getState(), '10000000')).toHaveLength(1));
    // Превью взяты из журналов: двумя запросами на весь аккаунт, без запроса истории на каждый чат.
    expect(selectChats(store.getState())).toMatchObject([
      { id: '10000001', title: 'Мария', lastPreview: 'Ответ', unreadCount: 0 },
      { id: '10000000', title: 'Иван', lastPreview: 'Старое сообщение', unreadCount: 0 },
    ]);
    expect(api.methods()).not.toContain('getChatHistory');
  });

  it('показывает сообщение из MAX при сверке, даже если очередь уведомлений его не принесла', async () => {
    vi.useFakeTimers();
    api.reply('getChats', []);
    api.reply('lastIncomingMessages', []);
    api.reply('lastOutgoingMessages', []);
    const { store } = renderHookWithStore(() => useChatSync());
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(journalCalls()).toBe(2);

    // Клиент написал в MAX, а уведомление в очередь не попало.
    api.reply('lastIncomingMessages', [journalItem('in-9', '10000000', 'Вы на связи?')]);
    api.reply('lastOutgoingMessages', []);
    await act(() => vi.advanceTimersByTimeAsync(30_000));

    expect(selectChats(store.getState())).toMatchObject([
      { id: '10000000', title: 'Иван', lastPreview: 'Вы на связи?', unreadCount: 1 },
    ]);
    expect(
      api.calls.find((call) => call.method === 'lastIncomingMessages' && call.answered),
    ).toBeDefined();
    expect(api.calls[api.calls.length - 2]?.url).toMatch(
      /lastIncomingMessages\/test-token\?minutes=10$/,
    );
  });

  it('повторная сверка без новых сообщений ничего не меняет', async () => {
    vi.useFakeTimers();
    const journal = [journalItem('in-1', '10000000', 'Привет')];
    api.reply('getChats', []);
    api.reply('lastIncomingMessages', journal);
    api.reply('lastOutgoingMessages', []);
    const { store } = renderHookWithStore(() => useChatSync());
    await act(() => vi.advanceTimersByTimeAsync(0));
    const before = store.getState().chat;

    api.reply('lastIncomingMessages', journal);
    api.reply('lastOutgoingMessages', []);
    await act(() => vi.advanceTimersByTimeAsync(30_000));

    expect(journalCalls()).toBe(4);
    expect(store.getState().chat).toBe(before);
  });

  it('сверяется не чаще раза в 30 секунд и останавливается при размонтировании', async () => {
    vi.useFakeTimers();
    for (let cycle = 0; cycle < 3; cycle += 1) {
      api.reply('lastIncomingMessages', []);
      api.reply('lastOutgoingMessages', []);
    }
    api.reply('getChats', []);
    const { unmount } = renderHookWithStore(() => useChatSync());

    await act(() => vi.advanceTimersByTimeAsync(29_000));
    expect(journalCalls()).toBe(2);

    await act(() => vi.advanceTimersByTimeAsync(31_000));
    expect(journalCalls()).toBe(6);

    unmount();
    await act(() => vi.advanceTimersByTimeAsync(120_000));
    expect(journalCalls()).toBe(6);
  });

  it('сбой одного журнала не мешает использовать второй', async () => {
    api.reply('getChats', []);
    api.reply('lastIncomingMessages', { message: 'Forbidden' }, 403);
    api.reply('lastOutgoingMessages', [
      { ...journalItem('out-1', '10000000', 'Отправлено с телефона'), type: 'outgoing' },
    ]);

    const { store } = renderHookWithStore(() => useChatSync());

    await waitFor(() =>
      expect(selectMessages(store.getState(), '10000000')).toMatchObject([
        { direction: 'outgoing', text: 'Отправлено с телефона' },
      ]),
    );
  });
});
