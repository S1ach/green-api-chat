import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { getStateInstance } from '../api/greenApi';
import { GreenApiError } from '../api/errors';
import type { Credentials } from '../types/green';
import { isRecord, readString } from '../utils/guards';
import { loadJson, removeKey, saveJson } from '../utils/storage';
import { AuthContext, type AuthContextValue } from './authContext';

const STORAGE_KEY = 'greenapi.credentials';

/** Понятные пояснения к неподходящим состояниям инстанса. */
const STATE_HINTS: Record<string, string> = {
  notAuthorized:
    'Инстанс не авторизован. В консоли GREEN-API нажмите «Получить QR-код», ' +
    'а в приложении MAX откройте Профиль → Устройства → «Войти по QR-коду» и отсканируйте его. ' +
    'Пароль на вход в MAX нужно предварительно отключить — иначе QR-код не сработает.',
  pendingPassword:
    'Авторизация не завершена: MAX запросил пароль от аккаунта. ' +
    'Отправьте его методом SendAuthorizationPassword или отключите пароль в MAX и отсканируйте QR-код заново.',
  blocked: 'Инстанс заблокирован. Обратитесь в поддержку GREEN-API.',
  starting: 'Инстанс запускается. Подождите около минуты и попробуйте снова.',
  suspended: 'На аккаунте временные ограничения. Попробуйте позже.',
  sleepMode: 'Инстанс в спящем режиме: откройте приложение MAX на телефоне.',
  yellowCard: 'Инстанс временно ограничен (yellowCard). Попробуйте позже.',
};

function restoreCredentials(): Credentials | null {
  const raw = loadJson<unknown>(STORAGE_KEY);
  if (!isRecord(raw)) {
    return null;
  }
  const apiUrl = readString(raw, 'apiUrl');
  const idInstance = readString(raw, 'idInstance');
  const apiTokenInstance = readString(raw, 'apiTokenInstance');
  if (!apiUrl || !idInstance || !apiTokenInstance) {
    return null;
  }
  return { apiUrl, idInstance, apiTokenInstance };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [credentials, setCredentials] = useState<Credentials | null>(restoreCredentials);

  const login = useCallback(async (next: Credentials) => {
    const { stateInstance } = await getStateInstance(next);
    if (stateInstance !== 'authorized') {
      throw new GreenApiError(
        STATE_HINTS[stateInstance] ?? `Инстанс недоступен (состояние: ${stateInstance}).`,
        'forbidden',
      );
    }
    saveJson(STORAGE_KEY, next);
    setCredentials(next);
  }, []);

  const logout = useCallback(() => {
    removeKey(STORAGE_KEY);
    setCredentials(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ credentials, login, logout }),
    [credentials, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
