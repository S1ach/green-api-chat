import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithStore, testCredentials } from '@/app/providers/store/testing';
import { selectMessages, type ChatState } from '@/entities/chat';
import { mockGreenApi } from '@/shared/lib/test/mockGreenApi';
import { discardMessage, retryMessage } from '../model/sendMessage';
import { MessageInput } from './MessageInput';

const CHAT_ID = '10000000';

const chatState: ChatState = {
  chats: {
    [CHAT_ID]: {
      id: CHAT_ID,
      phone: '79991234567',
      title: 'Иван',
      chatType: 'user',
      unreadCount: 0,
      lastActivity: 0,
      lastPreview: '',
    },
  },
  chatOrder: [CHAT_ID],
  messages: { [CHAT_ID]: [] },
  activeChatId: CHAT_ID,
};

let api: ReturnType<typeof mockGreenApi>;

function setup() {
  const user = userEvent.setup();
  const { store } = renderWithStore(<MessageInput chatId={CHAT_ID} />, {
    preloadedState: { session: { credentials: testCredentials }, chat: chatState },
  });
  const input = screen.getByRole('textbox', { name: 'Текст сообщения' });
  const sendButton = screen.getByRole('button', { name: 'Отправить' });
  const messages = () => selectMessages(store.getState(), CHAT_ID);
  /** Открывает меню скрепки и выбирает пункт. */
  const attach = async (item: 'Файл' | 'Контакт' | 'Геопозиция') => {
    await user.click(screen.getByRole('button', { name: 'Прикрепить' }));
    await user.click(screen.getByRole('menuitem', { name: item }));
  };
  return { user, store, input, sendButton, messages, attach };
}

const pdf = () => new File(['%PDF-1.4'], 'Договор.pdf', { type: 'application/pdf' });

beforeEach(() => {
  api = mockGreenApi();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('MessageInput', () => {
  it('не отправляет пустое сообщение и сообщение из одних пробелов', async () => {
    const { user, input, sendButton, messages } = setup();

    expect(sendButton).toBeDisabled();
    await user.type(input, '{Enter}');
    await user.type(input, '   {Enter}');

    expect(sendButton).toBeDisabled();
    expect(api.calls).toHaveLength(0);
    expect(messages()).toHaveLength(0);
  });

  it('по Enter сразу показывает сообщение как отправляемое и очищает поле', async () => {
    // Ответа на sendMessage пока нет — запрос «в полёте».
    const { user, input, messages } = setup();

    await user.type(input, '  Привет!  {Enter}');

    expect(input).toHaveValue('');
    expect(input).toHaveFocus();
    expect(messages()).toMatchObject([
      { chatId: CHAT_ID, direction: 'outgoing', text: 'Привет!', status: 'sending' },
    ]);
    expect(api.methods()).toEqual(['sendMessage']);
  });

  it('после ответа API отмечает сообщение отправленным под его idMessage', async () => {
    api.reply('sendMessage', { idMessage: 'out-1' });
    const { user, input, messages } = setup();

    await user.type(input, 'Привет!{Enter}');

    await waitFor(() =>
      expect(messages()).toMatchObject([{ id: 'out-1', text: 'Привет!', status: 'sent' }]),
    );
  });

  it('отправляет по кнопке', async () => {
    api.reply('sendMessage', { idMessage: 'out-1' });
    const { user, input, sendButton, messages } = setup();

    await user.type(input, 'Привет!');
    await user.click(sendButton);

    await waitFor(() => expect(messages()).toMatchObject([{ id: 'out-1', status: 'sent' }]));
    expect(input).toHaveValue('');
  });

  it('по Shift+Enter переносит строку и ничего не отправляет', async () => {
    const { user, input } = setup();

    await user.type(input, 'Первая{Shift>}{Enter}{/Shift}вторая');

    expect(input).toHaveValue('Первая\nвторая');
    expect(api.calls).toHaveLength(0);
  });

  it('двойное нажатие отправляет сообщение один раз', async () => {
    const { user, input, sendButton, messages } = setup();

    await user.type(input, 'Привет!');
    await user.dblClick(sendButton);
    await user.type(input, '{Enter}{Enter}');

    expect(api.methods()).toEqual(['sendMessage']);
    expect(messages()).toHaveLength(1);
  });

  it('при ошибке оставляет сообщение в чате с причиной, а повтор отправляет его снова', async () => {
    api.reply('sendMessage', { message: 'Bad Request' }, 400);
    const { user, store, input, messages } = setup();

    await user.type(input, 'Привет!{Enter}');

    await waitFor(() => expect(messages()[0]?.status).toBe('error'));
    expect(messages()[0]?.text).toBe('Привет!');
    expect(messages()[0]?.error).toContain('Некорректный запрос (400)');

    api.reply('sendMessage', { idMessage: 'out-2' });
    await store.dispatch(retryMessage(CHAT_ID, messages()[0]?.id ?? ''));

    // Сообщение одно: повтор не создаёт копию.
    expect(messages()).toMatchObject([{ id: 'out-2', text: 'Привет!', status: 'sent' }]);
    expect(api.methods()).toEqual(['sendMessage', 'sendMessage']);
  });
});

describe('MessageInput: меню вложений', () => {
  it('скрепка открывает меню: файл, контакт, геопозиция; Escape его закрывает', async () => {
    const { user } = setup();

    await user.click(screen.getByRole('button', { name: 'Прикрепить' }));

    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Файл',
      'Контакт',
      'Геопозиция',
    ]);

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});

describe('MessageInput: отправка файла', () => {
  it('выбранный файл ждёт отправки, а текст из поля уходит подписью', async () => {
    api.reply('sendFileByUpload', {
      idMessage: 'file-1',
      urlFile: 'https://storage.example/contract.pdf',
    });
    const { user, input, sendButton, messages } = setup();

    await user.upload(screen.getByLabelText('Файл для отправки'), pdf());

    // Файл показан над полем, но ещё не отправлен.
    expect(screen.getByText('Договор.pdf')).toBeInTheDocument();
    expect(api.calls).toHaveLength(0);
    expect(sendButton).toBeEnabled();

    await user.type(input, 'На подпись');
    await user.click(sendButton);

    await waitFor(() =>
      expect(messages()).toMatchObject([
        {
          id: 'file-1',
          status: 'sent',
          text: 'На подпись',
          attachment: {
            kind: 'document',
            url: 'https://storage.example/contract.pdf',
            name: 'Договор.pdf',
          },
        },
      ]),
    );
    expect(api.methods()).toEqual(['sendFileByUpload']);
    expect(api.calls[0]?.httpMethod).toBe('POST');
    expect(input).toHaveValue('');
    expect(screen.queryByText('Договор.pdf')).not.toBeInTheDocument();
  });

  it('файл можно убрать до отправки', async () => {
    const { user, sendButton } = setup();

    await user.upload(screen.getByLabelText('Файл для отправки'), pdf());
    await user.click(screen.getByRole('button', { name: 'Убрать файл' }));

    expect(screen.queryByText('Договор.pdf')).not.toBeInTheDocument();
    expect(sendButton).toBeDisabled();
  });

  it('пустой файл не принимает и объясняет почему', async () => {
    const { user, sendButton } = setup();

    await user.upload(screen.getByLabelText('Файл для отправки'), new File([], 'empty.txt'));

    expect(screen.getByRole('alert')).toHaveTextContent('Файл пустой');
    expect(sendButton).toBeDisabled();
    expect(api.calls).toHaveLength(0);
  });

  it('после ошибки повтор отправляет тот же файл, а удаление убирает сообщение', async () => {
    api.reply('sendFileByUpload', { message: 'Internal error' }, 500);
    const { user, store, sendButton, messages } = setup();

    await user.upload(screen.getByLabelText('Файл для отправки'), pdf());
    await user.click(sendButton);
    await waitFor(() => expect(messages()[0]?.status).toBe('error'));

    api.reply('sendFileByUpload', { idMessage: 'file-2' });
    await store.dispatch(retryMessage(CHAT_ID, messages()[0]?.id ?? ''));

    expect(messages()).toMatchObject([
      { id: 'file-2', status: 'sent', attachment: { name: 'Договор.pdf' } },
    ]);
    expect(api.methods()).toEqual(['sendFileByUpload', 'sendFileByUpload']);

    store.dispatch(discardMessage(CHAT_ID, 'file-2'));
    expect(messages()).toHaveLength(0);
  });

  it('вложение, восстановленное из кэша после перезагрузки, повторно не отправляет', async () => {
    const restored: ChatState = {
      ...chatState,
      messages: {
        [CHAT_ID]: [
          {
            id: 'local-old',
            chatId: CHAT_ID,
            direction: 'outgoing',
            text: '',
            timestamp: 1,
            status: 'error',
            error: 'Отправка прервана перезагрузкой страницы.',
            attachment: { kind: 'document', url: null, name: 'Договор.pdf' },
          },
        ],
      },
    };
    const { store } = renderWithStore(<MessageInput chatId={CHAT_ID} />, {
      preloadedState: { session: { credentials: testCredentials }, chat: restored },
    });

    await store.dispatch(retryMessage(CHAT_ID, 'local-old'));

    const [message] = selectMessages(store.getState(), CHAT_ID);
    expect(message?.status).toBe('error');
    expect(message?.error).toContain('отправьте его заново');
    expect(api.calls).toHaveLength(0);
  });
});

describe('MessageInput: отправка геопозиции', () => {
  it('проверяет координаты и отправляет их методом SendLocation', async () => {
    api.reply('sendLocation', { idMessage: 'loc-1' });
    const { user, messages, attach, input } = setup();

    await attach('Геопозиция');
    const dialog = screen.getByRole('dialog', { name: 'Отправить геопозицию' });
    const latitude = within(dialog).getByLabelText('Широта');
    const longitude = within(dialog).getByLabelText('Долгота');
    expect(latitude).toHaveFocus();

    await user.type(latitude, '95');
    await user.type(longitude, 'abc');
    await user.click(within(dialog).getByRole('button', { name: 'Отправить' }));

    expect(await within(dialog).findByText('Число от −90 до 90')).toBeInTheDocument();
    expect(within(dialog).getByText('Число от −180 до 180')).toBeInTheDocument();
    expect(api.calls).toHaveLength(0);

    await user.clear(latitude);
    await user.type(latitude, '55,7558');
    await user.clear(longitude);
    await user.type(longitude, '37.6173');
    await user.click(within(dialog).getByRole('button', { name: 'Отправить' }));

    await waitFor(() =>
      expect(messages()).toMatchObject([
        {
          id: 'loc-1',
          status: 'sent',
          text: '',
          attachment: { kind: 'location', name: '55.75580, 37.61730' },
        },
      ]),
    );
    expect(api.calls[0]?.body).toEqual({ chatId: CHAT_ID, latitude: 55.7558, longitude: 37.6173 });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(input).toHaveFocus();
  });

  it('окно закрывается по Escape, ничего не отправляя', async () => {
    const { user, attach, messages } = setup();

    await attach('Геопозиция');
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(messages()).toHaveLength(0);
    expect(api.calls).toHaveLength(0);
  });
});

describe('MessageInput: отправка контакта', () => {
  const contacts = [
    { chatId: '10000001', name: 'Люся', contactName: 'Люся Сидорова', phoneNumber: 79998887766 },
    { chatId: '10000002', name: 'Пётр', contactName: '', phoneNumber: 0 },
  ];

  it('показывает контакты из GetContacts и отправляет выбранный методом SendContact', async () => {
    api.reply('getContacts', contacts);
    api.reply('sendContact', { idMessage: 'contact-1' });
    const { user, messages, attach } = setup();

    await attach('Контакт');
    const dialog = screen.getByRole('dialog', { name: 'Отправить контакт' });
    expect(within(dialog).getByRole('status')).toHaveTextContent('Загружаем контакты');

    // Поиск по номеру в произвольном формате оставляет только подходящий контакт.
    await user.type(await within(dialog).findByRole('searchbox'), '8887766');
    expect(within(dialog).queryByText('Пётр')).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: /Люся Сидорова/ }));

    await waitFor(() =>
      expect(messages()).toMatchObject([
        {
          id: 'contact-1',
          status: 'sent',
          attachment: { kind: 'contact', url: null, name: 'Люся Сидорова' },
        },
      ]),
    );
    expect(api.callsOf('sendContact')[0]?.body).toEqual({
      chatId: CHAT_ID,
      contact: { chatId: '10000001' },
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('если контакты не загрузились, показывает ошибку и повторяет по кнопке', async () => {
    api.reply('getContacts', { message: 'Internal error' }, 500);
    const { user, attach } = setup();

    await attach('Контакт');
    const dialog = screen.getByRole('dialog');
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Не удалось загрузить контакты',
    );

    api.reply('getContacts', contacts);
    await user.click(within(dialog).getByRole('button', { name: 'Повторить' }));

    expect(
      await within(dialog).findByText('Люся Сидорова', {}, { timeout: 4000 }),
    ).toBeInTheDocument();
  });

  it('пустой список контактов объясняет и предлагает обновить', async () => {
    api.reply('getContacts', []);
    const { attach } = setup();

    await attach('Контакт');

    expect(await screen.findByText(/пока никого нет/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Обновить' })).toBeInTheDocument();
  });
});
