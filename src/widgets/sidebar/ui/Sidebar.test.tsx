import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithStore, testCredentials } from '@/app/providers/store/testing';
import type { Chat, ChatState } from '@/entities/chat';
import { mockGreenApi } from '@/shared/lib/test/mockGreenApi';
import { Sidebar } from './Sidebar';

function chat(id: string, title: string, phone: string): Chat {
  return { id, title, phone, chatType: 'user', unreadCount: 0, lastActivity: 0, lastPreview: '' };
}

const chatState: ChatState = {
  chats: {
    a: chat('a', 'Иван Петров', '79991234567'),
    b: chat('b', 'Мария', '79990000001'),
  },
  chatOrder: ['a', 'b'],
  messages: {},
  activeChatId: null,
};

function setup() {
  const user = userEvent.setup();
  renderWithStore(<Sidebar />, {
    preloadedState: { session: { credentials: testCredentials }, chat: chatState },
  });
  const search = screen.getByRole('searchbox', { name: 'Поиск по чатам' });
  const titles = () =>
    screen
      .queryAllByRole('listitem')
      .map((item) => within(item).getByRole('button').textContent ?? '');
  return { user, search, titles };
}

beforeEach(() => {
  // Запросы GetChats и GetAvatar остаются без ответа: список берётся из состояния.
  mockGreenApi();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Sidebar: поиск по чатам', () => {
  it('показывает все чаты, пока запрос пуст', () => {
    const { titles } = setup();

    expect(titles()).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Очистить поиск' })).not.toBeInTheDocument();
  });

  it('оставляет в списке чаты, подходящие по имени', async () => {
    const { user, search, titles } = setup();

    await user.type(search, 'мар');

    expect(titles()).toHaveLength(1);
    expect(screen.getByText('Мария')).toBeInTheDocument();
    expect(screen.queryByText('Иван Петров')).not.toBeInTheDocument();
  });

  it('находит чат по номеру телефона в произвольном формате', async () => {
    const { user, search } = setup();

    await user.type(search, '8 (999) 123');

    expect(screen.getByText('Иван Петров')).toBeInTheDocument();
    expect(screen.queryByText('Мария')).not.toBeInTheDocument();
  });

  it('сообщает, что ничего не найдено', async () => {
    const { user, search, titles } = setup();

    await user.type(search, 'пётр иванович');

    expect(titles()).toHaveLength(0);
    expect(screen.getByText(/Ничего не найдено/)).toBeInTheDocument();
  });

  it('возвращает весь список по кнопке очистки и по Escape', async () => {
    const { user, search, titles } = setup();

    await user.type(search, 'мар');
    await user.click(screen.getByRole('button', { name: 'Очистить поиск' }));
    expect(search).toHaveValue('');
    expect(search).toHaveFocus();
    expect(titles()).toHaveLength(2);

    await user.type(search, 'иван{Escape}');
    expect(search).toHaveValue('');
    expect(titles()).toHaveLength(2);
  });
});
