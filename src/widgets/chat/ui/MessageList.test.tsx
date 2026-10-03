import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { Message } from '@/entities/message';
import { MessageList } from './MessageList';

type Props = ComponentProps<typeof MessageList>;

const BASE = new Date(2025, 2, 12, 12, 0).getTime();

function message(id: string, direction: Message['direction'] = 'incoming'): Message {
  return {
    id,
    chatId: '10000000',
    direction,
    text: `Сообщение ${id}`,
    timestamp: BASE + Number(id) * 1000,
  };
}

function props(overrides: Partial<Props> = {}): Props {
  return {
    messages: [],
    isLoading: false,
    error: null,
    hasMore: false,
    onLoadMore: vi.fn(),
    onRetryLoad: vi.fn(),
    onRetryMessage: vi.fn(),
    onRemoveMessage: vi.fn(),
    ...overrides,
  };
}

// jsdom не считает размеры, задаём руками: лента высотой 200px
function mockScrollHeight(list: HTMLElement, scrollHeight: number) {
  Object.defineProperty(list, 'scrollHeight', { configurable: true, value: scrollHeight });
  Object.defineProperty(list, 'clientHeight', { configurable: true, value: 200 });
}

describe('MessageList: состояния', () => {
  it('во время первой загрузки показывает заглушку, а не пустой чат', () => {
    render(<MessageList {...props({ isLoading: true })} />);

    expect(screen.getByRole('status', { name: 'Загружаем сообщения' })).toBeInTheDocument();
    expect(screen.queryByText('Сообщений пока нет')).not.toBeInTheDocument();
  });

  it('показывает пустое состояние, когда сообщений нет', () => {
    render(<MessageList {...props()} />);

    expect(screen.getByText('Сообщений пока нет')).toBeInTheDocument();
    expect(screen.getByText('Начните диалог')).toBeInTheDocument();
  });

  it('при ошибке загрузки предлагает повторить', async () => {
    const user = userEvent.setup();
    const onRetryLoad = vi.fn();
    render(<MessageList {...props({ error: 'Нет связи.', onRetryLoad })} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Не удалось загрузить сообщения');
    await user.click(screen.getByRole('button', { name: 'Повторить' }));

    expect(onRetryLoad).toHaveBeenCalledOnce();
  });

  it('показывает сообщения по порядку с разделителем дня', () => {
    render(<MessageList {...props({ messages: [message('1'), message('2', 'outgoing')] })} />);

    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      expect.stringContaining('Сообщение 1'),
      expect.stringContaining('Сообщение 2'),
    ]);
    expect(screen.getByText('12 марта 2025 г.')).toBeInTheDocument();
  });

  it('предлагает подгрузить более ранние сообщения, если они есть', async () => {
    const user = userEvent.setup();
    const onLoadMore = vi.fn();
    const { rerender } = render(
      <MessageList {...props({ messages: [message('1')], hasMore: true, onLoadMore })} />,
    );

    await user.click(screen.getByRole('button', { name: 'Показать более ранние' }));
    expect(onLoadMore).toHaveBeenCalledOnce();

    rerender(<MessageList {...props({ messages: [message('1')], hasMore: false })} />);
    expect(screen.queryByRole('button', { name: 'Показать более ранние' })).not.toBeInTheDocument();
  });
});

describe('MessageList: прокрутка', () => {
  function setup() {
    const initial = [message('5'), message('6')];
    const { rerender } = render(<MessageList {...props({ messages: initial })} />);
    const list = screen.getByRole('log');
    mockScrollHeight(list, 1000);
    const show = (messages: Message[], scrollHeight = 1000) => {
      mockScrollHeight(list, scrollHeight);
      rerender(<MessageList {...props({ messages })} />);
    };
    const scrollUp = () => {
      list.scrollTop = 100;
      fireEvent.scroll(list);
    };
    return { list, initial, show, scrollUp };
  }

  it('прокручивает вниз при новом сообщении, если пользователь был внизу', () => {
    const { list, initial, show } = setup();

    show([...initial, message('7')]);

    expect(list.scrollTop).toBe(1000);
    expect(screen.queryByRole('button', { name: 'К последним сообщениям' })).toBeNull();
  });

  it('не трогает прокрутку, если пользователь читает историю, и показывает кнопку с числом новых', async () => {
    const user = userEvent.setup();
    const { list, initial, show, scrollUp } = setup();
    scrollUp();

    show([...initial, message('7')]);
    show([...initial, message('7'), message('8')]);

    expect(list.scrollTop).toBe(100);
    expect(screen.getByLabelText('Новых сообщений: 2')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'К последним сообщениям' }));

    expect(list.scrollTop).toBe(1000);
    expect(screen.queryByRole('button', { name: 'К последним сообщениям' })).toBeNull();
  });

  it('после отправки своего сообщения прокручивает вниз в любом случае', () => {
    const { list, initial, show, scrollUp } = setup();
    scrollUp();

    show([...initial, message('7', 'outgoing')]);

    expect(list.scrollTop).toBe(1000);
  });

  it('при подгрузке более ранних сообщений сохраняет позицию: лента не прыгает', () => {
    const { list, initial, show, scrollUp } = setup();
    scrollUp();

    // Сверху добавилось 400px сообщений — то, что было на экране, должно остаться на месте.
    show([message('3'), message('4'), ...initial], 1400);

    expect(list.scrollTop).toBe(500);
  });
});
