import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Message } from '@/entities/message';
import { MessageList } from './MessageList';

function message(id: string, direction: Message['direction'] = 'incoming'): Message {
  return { id, chatId: '10000000', direction, text: `Сообщение ${id}`, timestamp: Number(id) };
}

/** jsdom не считает размеры — задаём их вручную, как у ленты высотой 200px с контентом 1000px. */
function mockScrollSize(list: HTMLElement, scrollHeight: number) {
  Object.defineProperty(list, 'scrollHeight', { configurable: true, value: scrollHeight });
  Object.defineProperty(list, 'clientHeight', { configurable: true, value: 200 });
}

describe('MessageList', () => {
  it('показывает пустое состояние, когда сообщений нет', () => {
    render(<MessageList messages={[]} isLoading={false} />);

    expect(screen.getByText('Сообщений пока нет — напишите первым.')).toBeInTheDocument();
  });

  it('показывает загрузку истории вместо пустого состояния', () => {
    render(<MessageList messages={[]} isLoading />);

    expect(screen.getByRole('status')).toHaveTextContent('Загружаем историю…');
    expect(screen.queryByText(/Сообщений пока нет/)).not.toBeInTheDocument();
  });

  it('показывает сообщения по порядку', () => {
    render(<MessageList messages={[message('1'), message('2', 'outgoing')]} isLoading={false} />);

    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      expect.stringContaining('Сообщение 1'),
      expect.stringContaining('Сообщение 2'),
    ]);
  });

  describe('автоскролл', () => {
    function setup() {
      const { rerender } = render(<MessageList messages={[message('1')]} isLoading={false} />);
      const list = screen.getByRole('log');
      mockScrollSize(list, 1000);
      const show = (messages: Message[]) =>
        rerender(<MessageList messages={messages} isLoading={false} />);
      return { list, show };
    }

    it('прокручивает вниз при новом сообщении, если пользователь был внизу', () => {
      const { list, show } = setup();

      show([message('1'), message('2')]);

      expect(list.scrollTop).toBe(1000);
    });

    it('не трогает прокрутку, если пользователь ушёл читать историю', () => {
      const { list, show } = setup();
      list.scrollTop = 100;
      fireEvent.scroll(list);

      show([message('1'), message('2')]);

      expect(list.scrollTop).toBe(100);
    });

    it('после отправки своего сообщения прокручивает вниз в любом случае', () => {
      const { list, show } = setup();
      list.scrollTop = 100;
      fireEvent.scroll(list);

      show([message('1'), message('2', 'outgoing')]);

      expect(list.scrollTop).toBe(1000);
    });
  });
});
