import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { formatTime } from '@/shared/lib/datetime';
import type { Message } from '../model/types';
import { MessageBubble } from './MessageBubble';

const timestamp = new Date(2025, 0, 15, 12, 45).getTime();

function renderMessage(overrides: Partial<Message>) {
  const message: Message = {
    id: 'msg-1',
    chatId: '10000000',
    direction: 'incoming',
    text: 'Привет',
    timestamp,
    ...overrides,
  };
  render(
    <ul>
      <MessageBubble message={message} />
    </ul>,
  );
}

describe('MessageBubble', () => {
  it('показывает входящее сообщение: текст и время', () => {
    renderMessage({ direction: 'incoming', text: 'Привет' });

    const message = screen.getByRole('listitem', { name: 'Входящее сообщение' });
    expect(within(message).getByText('Привет')).toBeInTheDocument();
    expect(within(message).getByText(formatTime(timestamp))).toBeInTheDocument();
    expect(screen.queryByRole('listitem', { name: 'Ваше сообщение' })).not.toBeInTheDocument();
  });

  it('показывает исходящее сообщение: текст и время', () => {
    renderMessage({ direction: 'outgoing', text: 'Как дела?' });

    const message = screen.getByRole('listitem', { name: 'Ваше сообщение' });
    expect(within(message).getByText('Как дела?')).toBeInTheDocument();
    expect(within(message).getByText(formatTime(timestamp))).toBeInTheDocument();
  });

  it('оформляет входящие и исходящие по-разному', () => {
    renderMessage({ direction: 'incoming' });
    renderMessage({ id: 'msg-2', direction: 'outgoing' });

    const incoming = screen.getByRole('listitem', { name: 'Входящее сообщение' });
    const outgoing = screen.getByRole('listitem', { name: 'Ваше сообщение' });
    expect(incoming.className).not.toBe(outgoing.className);
  });

  it('сохраняет переносы строк и не трактует текст как разметку', () => {
    renderMessage({ text: 'Первая строка\n<b>вторая</b>' });

    expect(screen.getByText(/Первая строка/)).toHaveTextContent('Первая строка <b>вторая</b>');
  });
});
