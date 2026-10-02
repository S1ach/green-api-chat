import { fireEvent, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithStore, testCredentials } from '@/app/providers/store/testing';
import { useAppSelector } from '@/shared/lib/store';
import { mockGreenApi } from '@/shared/lib/test/mockGreenApi';
import { isSavedMessagesChat } from '../lib/isSavedMessagesChat';
import type { Chat, ChatAvatarInfo } from '../model/types';
import { ChatAvatar } from './ChatAvatar';

const DAY = 24 * 60 * 60 * 1000;
const CHAT_ID = '10000001';

let api: ReturnType<typeof mockGreenApi>;

/** Аватар чата из store — так его получают список чатов и шапка. */
function StoredChatAvatar() {
  const chat = useAppSelector((state) => state.chat.chats[CHAT_ID]);
  return chat ? <ChatAvatar chat={chat} /> : null;
}

function setup(overrides: Partial<Chat> = {}) {
  const chat: Chat = {
    id: CHAT_ID,
    title: 'Иван',
    phone: null,
    chatType: 'user',
    unreadCount: 0,
    lastActivity: 0,
    lastPreview: '',
    ...overrides,
  };
  const { store, container } = renderWithStore(<StoredChatAvatar />, {
    preloadedState: {
      session: { credentials: testCredentials },
      chat: { chats: { [CHAT_ID]: chat }, chatOrder: [CHAT_ID], messages: {}, activeChatId: null },
    },
  });
  return {
    container,
    image: () => container.querySelector('img'),
    saved: (): ChatAvatarInfo | undefined => store.getState().chat.chats[CHAT_ID]?.avatar,
  };
}

beforeEach(() => {
  api = mockGreenApi();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('isSavedMessagesChat', () => {
  it('узнаёт «Избранное» по chatId самого аккаунта', () => {
    expect(isSavedMessagesChat({ id: '10000000', title: 'Заметки' }, '10000000')).toBe(true);
    expect(isSavedMessagesChat({ id: '10000001', title: 'Иван' }, '10000000')).toBe(false);
  });

  it('пока chatId аккаунта неизвестен, узнаёт чат по имени из MAX', () => {
    expect(isSavedMessagesChat({ id: '10000000', title: 'Избранное' }, undefined)).toBe(true);
    expect(isSavedMessagesChat({ id: '10000001', title: 'Иван' }, undefined)).toBe(false);
  });
});

describe('ChatAvatar', () => {
  it('пока ссылки нет, показывает инициалы; получив её из GetAvatar — картинку', async () => {
    api.reply('getAvatar', { urlAvatar: 'https://i.example/ivan.jpg' });
    const { container, image, saved } = setup();

    expect(container).toHaveTextContent('И');

    await waitFor(() => expect(image()).toHaveAttribute('src', 'https://i.example/ivan.jpg'));
    expect(api.callsOf('getAvatar')[0]?.body).toEqual({ chatId: CHAT_ID });
    // Ссылка сохранена в чате на неделю — вместе с ним она попадёт в localStorage.
    expect(saved()?.url).toBe('https://i.example/ivan.jpg');
    expect(saved()?.refreshAt).toBeGreaterThan(Date.now() + 6 * DAY);
  });

  it('сохранённую свежую ссылку показывает сразу и к API не обращается', async () => {
    const { image } = setup({
      avatar: { url: 'https://i.example/saved.jpg', refreshAt: Date.now() + DAY },
    });

    expect(image()).toHaveAttribute('src', 'https://i.example/saved.jpg');
    // Даём эффектам отработать: запроса аватара быть не должно.
    await waitFor(() => expect(api.callsOf('getAccountSettings')).toHaveLength(1));
    expect(api.callsOf('getAvatar')).toHaveLength(0);
  });

  it('устаревшую ссылку показывает, пока запрашивает новую', async () => {
    api.reply('getAvatar', { urlAvatar: 'https://i.example/new.jpg' });
    const { image } = setup({
      avatar: { url: 'https://i.example/old.jpg', refreshAt: Date.now() - 1 },
    });

    expect(image()).toHaveAttribute('src', 'https://i.example/old.jpg');
    await waitFor(() => expect(image()).toHaveAttribute('src', 'https://i.example/new.jpg'));
  });

  it('запоминает, что аватара нет, и не спрашивает о нём при каждой загрузке', async () => {
    api.reply('getAvatar', { urlAvatar: '' });
    const { container, saved } = setup();

    await waitFor(() => expect(saved()).toBeDefined());
    expect(saved()?.url).toBe('');
    expect(saved()?.refreshAt).toBeGreaterThan(Date.now() + 6 * DAY);
    expect(container).toHaveTextContent('И');
    expect(api.callsOf('getContactInfo')).toHaveLength(0);
  });

  it('когда квота GetAvatar исчерпана (466), берёт ссылку из GetContactInfo', async () => {
    api.reply(
      'getAvatar',
      { invokeStatus: { method: 'getAvatar', status: 'QUOTE_EXCEEDED' } },
      466,
    );
    api.reply('getContactInfo', { avatar: 'https://i.example/from-info.jpg', chatType: 'user' });
    const { image } = setup();

    await waitFor(() => expect(image()).toHaveAttribute('src', 'https://i.example/from-info.jpg'));
    expect(api.callsOf('getContactInfo')[0]?.body).toEqual({ chatId: CHAT_ID });
  });

  it('если квота исчерпана у обоих методов, оставляет прежнюю ссылку и ждёт начала месяца', async () => {
    api.reply('getAvatar', {}, 466);
    api.reply('getContactInfo', {}, 466);
    const { image, saved } = setup({
      avatar: { url: 'https://i.example/old.jpg', refreshAt: Date.now() - 1 },
    });

    await waitFor(() => expect(saved()?.refreshAt).toBeGreaterThan(Date.now()));
    const next = new Date(saved()?.refreshAt ?? 0);
    expect(next.getDate()).toBe(1);
    expect(next.getHours()).toBe(0);
    expect(image()).toHaveAttribute('src', 'https://i.example/old.jpg');
    // Повторных попыток нет: ни сразу, ни после перерисовки.
    expect(api.callsOf('getAvatar')).toHaveLength(1);
  });

  it('после сетевого сбоя повторяет не раньше чем через час', async () => {
    api.fail('getAvatar');
    api.fail('getContactInfo');
    const { container, saved } = setup();

    await waitFor(() => expect(saved()).toBeDefined());
    const delay = (saved()?.refreshAt ?? 0) - Date.now();
    expect(delay).toBeGreaterThan(50 * 60 * 1000);
    expect(delay).toBeLessThanOrEqual(60 * 60 * 1000);
    expect(container).toHaveTextContent('И');
  });

  it('для группы GetContactInfo не вызывает: метод с группами не работает', async () => {
    api.reply('getAvatar', {}, 466);
    const { saved } = setup({ chatType: 'group' });

    await waitFor(() => expect(saved()).toBeDefined());
    expect(api.callsOf('getContactInfo')).toHaveLength(0);
  });

  it('если сохранённая ссылка не открылась, один раз запрашивает новую', async () => {
    api.reply('getAvatar', { urlAvatar: 'https://i.example/fresh.jpg' });
    api.reply('getAvatar', { urlAvatar: 'https://i.example/other.jpg' });
    const { container, image } = setup({
      avatar: { url: 'https://i.example/expired.jpg', refreshAt: Date.now() + DAY },
    });

    fireEvent.error(image() as HTMLImageElement);
    await waitFor(() => expect(image()).toHaveAttribute('src', 'https://i.example/fresh.jpg'));

    // Новая тоже не открылась — остаются инициалы, запросы не зацикливаются.
    fireEvent.error(image() as HTMLImageElement);
    expect(container).toHaveTextContent('И');
    expect(api.callsOf('getAvatar')).toHaveLength(1);
  });

  it('«Избранному» показывает закладку вместо инициалов и аватар не запрашивает', async () => {
    api.reply('getAccountSettings', { chatId: CHAT_ID, stateInstance: 'authorized' });
    const { container } = setup({ title: 'Мои заметки' });

    await waitFor(() => expect(container.querySelector('svg')).not.toBeNull());
    expect(container).not.toHaveTextContent('МЗ');
  });

  it('чат с именем «Избранное» получает закладку сразу, не дожидаясь ответа API', () => {
    const { container } = setup({ title: 'Избранное' });

    expect(container.querySelector('svg')).not.toBeNull();
    expect(api.callsOf('getAvatar')).toHaveLength(0);
  });
});
