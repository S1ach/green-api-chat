import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { formatTime } from '@/shared/lib/datetime';
import type { Message } from '../model/types';
import { MessageBubble } from './MessageBubble';

const timestamp = new Date(2025, 0, 15, 12, 45).getTime();

function renderMessage(overrides: Partial<Message>, handlers = {}) {
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
      <MessageBubble message={message} {...handlers} />
    </ul>,
  );
  return screen.getByRole('listitem');
}

describe('MessageBubble', () => {
  it('показывает входящее сообщение: текст и время', () => {
    const message = renderMessage({ direction: 'incoming', text: 'Привет' });

    expect(message).toHaveAccessibleName('Входящее сообщение');
    expect(within(message).getByText('Привет')).toBeInTheDocument();
    expect(within(message).getByText(formatTime(timestamp))).toBeInTheDocument();
  });

  it('показывает исходящее сообщение: текст, время и статус', () => {
    const message = renderMessage({ direction: 'outgoing', text: 'Как дела?', status: 'sent' });

    expect(message).toHaveAccessibleName('Ваше сообщение');
    expect(within(message).getByText('Как дела?')).toBeInTheDocument();
    expect(within(message).getByText(formatTime(timestamp))).toBeInTheDocument();
    expect(within(message).getByRole('img', { name: 'Отправлено' })).toBeInTheDocument();
  });

  it('оформляет входящие и исходящие по-разному', () => {
    const incoming = renderMessage({ direction: 'incoming' });
    const { className } = incoming;
    incoming.remove();
    const outgoing = renderMessage({ direction: 'outgoing' });

    expect(outgoing.className).not.toBe(className);
  });

  it.each([
    ['sending', 'Отправляется'],
    ['delivered', 'Доставлено'],
    ['read', 'Прочитано'],
  ] as const)('для статуса %s показывает «%s»', (status, label) => {
    const message = renderMessage({ direction: 'outgoing', status });

    expect(within(message).getByRole('img', { name: label })).toBeInTheDocument();
  });

  it('у входящего сообщения статуса нет', () => {
    const message = renderMessage({ direction: 'incoming' });

    expect(within(message).queryByRole('img')).not.toBeInTheDocument();
  });

  it('сохраняет переносы строк и не трактует текст как разметку', () => {
    const message = renderMessage({ text: 'Первая строка\n<b>вторая</b>' });

    expect(message).toHaveTextContent('Первая строка <b>вторая</b>');
    expect(message.querySelector('b')).toBeNull();
  });

  it('превращает в ссылки только адреса http(s)', () => {
    const message = renderMessage({
      text: 'Смотри https://green-api.com/docs и javascript:alert(1)',
    });

    const links = within(message).getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute('href', 'https://green-api.com/docs');
    expect(links[0]).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('показывает вложение: что это, имя файла, ссылку и подпись', () => {
    const message = renderMessage({
      text: 'Схема проезда',
      attachment: { kind: 'image', url: 'https://storage.example/map.jpg', fileName: 'map.jpg' },
    });

    const link = within(message).getByRole('link', { name: /Фото/ });
    expect(link).toHaveAttribute('href', 'https://storage.example/map.jpg');
    expect(link).toHaveTextContent('map.jpg');
    expect(within(message).getByText('Схема проезда')).toBeInTheDocument();
  });

  it('вложение без файла показывает без ссылки', () => {
    const message = renderMessage({
      text: '',
      attachment: { kind: 'location', url: null, fileName: null },
    });

    expect(within(message).getByText('Геопозиция')).toBeInTheDocument();
    expect(within(message).queryByRole('link')).not.toBeInTheDocument();
  });

  it('для неотправленного сообщения показывает причину и даёт повторить или удалить', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const onRemove = vi.fn();
    const message = renderMessage(
      { id: 'local-1', direction: 'outgoing', status: 'error', error: 'Нет связи.' },
      { onRetry, onRemove },
    );

    expect(within(message).getByRole('alert')).toHaveTextContent('Не отправлено. Нет связи.');

    await user.click(within(message).getByRole('button', { name: 'Повторить' }));
    await user.click(within(message).getByRole('button', { name: 'Удалить' }));

    expect(onRetry).toHaveBeenCalledWith('local-1');
    expect(onRemove).toHaveBeenCalledWith('local-1');
  });
});
