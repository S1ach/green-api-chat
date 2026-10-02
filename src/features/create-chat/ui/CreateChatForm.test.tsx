import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithStore } from '@/app/providers/store/testing';
import { selectActiveChat, selectChats } from '@/entities/chat';
import { mockGreenApi } from '@/shared/lib/test/mockGreenApi';
import { CreateChatForm } from './CreateChatForm';

let api: ReturnType<typeof mockGreenApi>;

function setup() {
  const user = userEvent.setup();
  const onClose = vi.fn();
  const { store } = renderWithStore(<CreateChatForm onClose={onClose} />);
  return {
    user,
    onClose,
    store,
    phone: screen.getByLabelText('Номер телефона получателя'),
    submit: screen.getByRole('button', { name: 'Создать чат' }),
  };
}

beforeEach(() => {
  api = mockGreenApi();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('CreateChatForm', () => {
  it('не принимает пустой и нераспознанный номер и не обращается к API', async () => {
    const { user, phone, submit, onClose } = setup();

    await user.click(submit);
    expect(await screen.findByText('Введите номер телефона')).toBeInTheDocument();

    await user.type(phone, '12345');
    await user.click(submit);
    expect(await screen.findByText(/Не удалось распознать номер/)).toBeInTheDocument();

    expect(api.calls).toHaveLength(0);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('нормализует номер, проверяет его через CheckAccount и открывает чат', async () => {
    api.reply('checkAccount', { exist: true, chatId: '10000000' });
    const { user, phone, submit, onClose, store } = setup();

    await user.type(phone, '8 (999) 123-45-67');
    await user.click(submit);

    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(api.calls[0]?.method).toBe('checkAccount');
    expect(selectActiveChat(store.getState())).toMatchObject({
      id: '10000000',
      phone: '79991234567',
      title: '+7 (999) 123-45-67',
    });
  });

  it('сообщает, что номер не зарегистрирован в MAX, и не создаёт чат', async () => {
    api.reply('checkAccount', { exist: false });
    const { user, phone, submit, onClose, store } = setup();

    await user.type(phone, '+7 999 123-45-67');
    await user.click(submit);

    expect(
      await screen.findByText('Номер +7 (999) 123-45-67 не зарегистрирован в MAX.'),
    ).toBeInTheDocument();
    expect(selectChats(store.getState())).toEqual([]);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('показывает ошибку API и не создаёт чат', async () => {
    api.reply('checkAccount', { message: 'Unauthorized' }, 401);
    const { user, phone, submit, store } = setup();

    await user.type(phone, '79991234567');
    await user.click(submit);

    expect(await screen.findByRole('alert')).toHaveTextContent('Неверные учётные данные (401)');
    expect(selectChats(store.getState())).toEqual([]);
  });

  it('если CheckAccount недоступен, создаёт чат по запасному chatId и предупреждает', async () => {
    api.reply('checkAccount', { message: 'Forbidden' }, 403);
    const { user, phone, submit, onClose, store } = setup();

    await user.type(phone, '79991234567');
    await user.click(submit);

    expect(await screen.findByRole('status')).toHaveTextContent('Проверка номера недоступна');
    expect(selectActiveChat(store.getState())?.id).toBe('79991234567@c.us');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('закрывается по кнопке «Отмена»', async () => {
    const { user, onClose } = setup();

    await user.click(screen.getByRole('button', { name: 'Отмена' }));

    expect(onClose).toHaveBeenCalledOnce();
  });
});
