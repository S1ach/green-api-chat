export type ApiErrorKind =
  | 'network'
  | 'unauthorized'
  | 'forbidden'
  | 'quota'
  | 'rateLimit'
  | 'badRequest'
  | 'server'
  | 'unknown';

/**
 * Ошибка обращения к GREEN-API с понятным пользователю текстом.
 * Обычный объект, а не класс: RTK Query хранит ошибки в store, им нужно сериализоваться.
 * Важно: ни сообщение, ни поля не содержат apiTokenInstance.
 */
export interface GreenApiError {
  kind: ApiErrorKind;
  message: string;
  status?: number;
}

const STATUS_MESSAGES: Record<number, { kind: ApiErrorKind; message: string }> = {
  400: {
    kind: 'badRequest',
    message: 'Некорректный запрос (400). Проверьте номер телефона и содержимое сообщения.',
  },
  401: {
    kind: 'unauthorized',
    message: 'Неверные учётные данные (401). Проверьте idInstance и apiTokenInstance.',
  },
  403: {
    kind: 'forbidden',
    message: 'Доступ запрещён (403). Метод недоступен на вашем тарифе или аккаунт заблокирован.',
  },
  413: {
    kind: 'badRequest',
    message: 'Файл слишком большой (413). GREEN-API принимает файлы до 100 МБ.',
  },
  429: {
    kind: 'rateLimit',
    message: 'Слишком много запросов (429). Подождите несколько секунд и повторите.',
  },
  466: {
    kind: 'quota',
    message: 'Превышена квота запросов (466). Проверьте лимиты тарифа в консоли GREEN-API.',
  },
};

/** Человекочитаемое описание HTTP-ошибки GREEN-API. */
export function httpError(status: number): GreenApiError {
  const known = STATUS_MESSAGES[status];
  if (known) {
    return { ...known, status };
  }
  if (status >= 500) {
    return {
      kind: 'server',
      message: `Сервис GREEN-API временно недоступен (${status}). Повторите попытку позже.`,
      status,
    };
  }
  return { kind: 'unknown', message: `Запрос завершился с ошибкой (${status}).`, status };
}

/** Ошибка сети/CORS: fetch отклонился до получения ответа. */
export function networkError(): GreenApiError {
  return {
    kind: 'network',
    message:
      'Не удалось связаться с GREEN-API. Проверьте интернет, адрес apiUrl и блокировку запросов браузером (CORS, расширения).',
  };
}

/** Ответ пришёл, но его структура не та, что описана в документации. */
export function unexpectedResponseError(): GreenApiError {
  return { kind: 'unknown', message: 'GREEN-API вернул ответ в неожиданном формате.' };
}

export function isGreenApiError(error: unknown): error is GreenApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'kind' in error &&
    'message' in error &&
    typeof error.message === 'string'
  );
}

/** Запрос отменён самим приложением (выход, размонтирование) — это не сбой. */
export function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError'
  );
}

/** Текст ошибки для UI — без деталей реализации и без токена. */
export function getApiErrorMessage(error: unknown): string {
  if (isGreenApiError(error)) {
    return error.message;
  }
  if (isAbortError(error)) {
    return 'Запрос отменён.';
  }
  return 'Непредвиденная ошибка. Попробуйте ещё раз.';
}
