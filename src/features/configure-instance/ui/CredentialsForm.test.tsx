import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithStore } from '@/app/providers/store/testing';
import { selectCredentials } from '@/entities/session';
import { mockGreenApi } from '@/shared/lib/test/mockGreenApi';
import { CredentialsForm } from './CredentialsForm';

let api: ReturnType<typeof mockGreenApi>;

function setup() {
  const user = userEvent.setup();
  const { store } = renderWithStore(<CredentialsForm />, { preloadedState: {} });
  return {
    user,
    credentials: () => selectCredentials(store.getState()),
    idInstance: screen.getByLabelText('idInstance'),
    apiToken: screen.getByLabelText('apiTokenInstance'),
    submit: screen.getByRole('button', { name: 'Войти' }),
  };
}

beforeEach(() => {
  api = mockGreenApi();
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('CredentialsForm', () => {
  it('требует idInstance и apiTokenInstance и не обращается к API', async () => {
    const { user, submit, credentials } = setup();

    await user.click(submit);

    expect(await screen.findByText('Введите idInstance')).toBeInTheDocument();
    expect(screen.getByText('Введите apiTokenInstance')).toBeInTheDocument();
    expect(api.calls).toHaveLength(0);
    expect(credentials()).toBeNull();
  });

  it('отклоняет idInstance не из цифр', async () => {
    const { user, idInstance, apiToken, submit } = setup();

    await user.type(idInstance, '11abc');
    await user.type(apiToken, 'token');
    await user.click(submit);

    expect(await screen.findByText('idInstance состоит только из цифр')).toBeInTheDocument();
    expect(api.calls).toHaveLength(0);
  });

  it('подключает авторизованный инстанс, обрезая пробелы', async () => {
    api.reply('getStateInstance', { stateInstance: 'authorized' });
    const { user, idInstance, apiToken, submit, credentials } = setup();

    await user.type(idInstance, ' 1101000001 ');
    await user.type(apiToken, ' token ');
    await user.click(submit);

    await waitFor(() =>
      expect(credentials()).toEqual({
        apiUrl: 'https://api.green-api.com',
        idInstance: '1101000001',
        apiTokenInstance: 'token',
      }),
    );
    expect(api.calls[0]?.url).toBe(
      'https://api.green-api.com/waInstance1101000001/getStateInstance/token',
    );
  });

  it('объясняет ошибку 401: неверные учётные данные', async () => {
    api.reply('getStateInstance', { message: 'Unauthorized' }, 401);
    const { user, idInstance, apiToken, submit, credentials } = setup();

    await user.type(idInstance, '1101000001');
    await user.type(apiToken, 'wrong');
    await user.click(submit);

    expect(await screen.findByRole('alert')).toHaveTextContent('Неверные учётные данные (401)');
    expect(credentials()).toBeNull();
    expect(submit).toBeEnabled();
  });

  it('не пускает с неавторизованным инстансом и подсказывает, что делать', async () => {
    api.reply('getStateInstance', { stateInstance: 'notAuthorized' });
    const { user, idInstance, apiToken, submit, credentials } = setup();

    await user.type(idInstance, '1101000001');
    await user.type(apiToken, 'token');
    await user.click(submit);

    expect(await screen.findByRole('alert')).toHaveTextContent('Инстанс не авторизован');
    expect(credentials()).toBeNull();
  });

  it('сообщает о сетевой ошибке', async () => {
    api.fail('getStateInstance');
    const { user, idInstance, apiToken, submit } = setup();

    await user.type(idInstance, '1101000001');
    await user.type(apiToken, 'token');
    await user.click(submit);

    expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось связаться с GREEN-API');
  });
});
