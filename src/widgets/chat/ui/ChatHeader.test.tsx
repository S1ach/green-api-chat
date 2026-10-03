import { screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithStore } from '@/app/providers/store/testing';
import type { Chat } from '@/entities/chat';
import { mockGreenApi } from '@/shared/lib/test/mockGreenApi';
import { ChatHeader } from './ChatHeader';

function renderHeader(overrides: Partial<Chat>) {
  const chat: Chat = {
    id: '10000000',
    title: 'Иван',
    phone: '79991234567',
    chatType: 'user',
    unreadCount: 0,
    lastActivity: 0,
    lastPreview: '',
    ...overrides,
  };
  renderWithStore(
    <ChatHeader chat={chat} onClose={vi.fn()} onRefresh={vi.fn()} isRefreshing={false} />,
  );
  return within(screen.getByRole('banner'));
}

beforeEach(() => {
  mockGreenApi();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ChatHeader', () => {
  it('под именем показывает номер', () => {
    const header = renderHeader({});

    expect(header.getByRole('heading', { name: 'Иван' })).toBeInTheDocument();
    expect(header.getByText('+7 (999) 123-45-67')).toBeInTheDocument();
  });

  it('у чата без имени номер стоит только в заголовке', () => {
    const header = renderHeader({ title: '+7 (999) 123-45-67' });

    expect(header.getAllByText('+7 (999) 123-45-67')).toHaveLength(1);
  });

  it('у чата без имени и номера chatId не повторяется', () => {
    const header = renderHeader({ title: '10000000', phone: null });

    expect(header.getAllByText(/10000000/)).toHaveLength(1);
  });

  it('для группы пишет её тип', () => {
    const header = renderHeader({ title: 'Семья', phone: null, chatType: 'group' });

    expect(header.getByText('группа')).toBeInTheDocument();
  });
});
