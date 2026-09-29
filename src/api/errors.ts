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
 * Важно: ни сообщение, ни поля не содержат apiTokenInstance.
 */
export class GreenApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | undefined;

  constructor(message: string, kind: ApiErrorKind, status?: number) {
    super(message);
    this.name = 'GreenApiError';
    this.kind = kind;
    this.status = status;
  }
}

const STATUS_MESSAGES: Record<number, { kind: ApiErrorKind; message: string }> = {
  400: {
    kind: 'badRequest',
    message: 'Некорректный запрос (400). Проверьте номер телефона и текст сообщения.',
  },
  401: {
    kind: 'unauthorized',
    message: 'Неверные учётные данные (401). Проверьте idInstance и apiTokenInstance.',
  },
  403: {
    kind: 'forbidden',
    message: 'Доступ запрещён (403). Метод недоступен на вашем тарифе или аккаунт заблокирован.',
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
    return new GreenApiError(known.message, known.kind, status);
  }
  if (status >= 500) {
    return new GreenApiError(
      `Сервис GREEN-API временно недоступен (${status}). Повторите попытку позже.`,
      'server',
      status,
    );
  }
  return new GreenApiError(`Запрос завершился с ошибкой (${status}).`, 'unknown', status);
}

/** Ошибка сети/CORS: fetch отклонился до получения ответа. */
export function networkError(): GreenApiError {
  return new GreenApiError(
    'Не удалось связаться с GREEN-API. Проверьте интернет, адрес apiUrl и блокировку запросов браузером (CORS, расширения).',
    'network',
  );
}

/** Текст ошибки для UI — без деталей реализации и без токена. */
export function toUserMessage(error: unknown): string {
  if (error instanceof GreenApiError) {
    return error.message;
  }
  if (error instanceof Error && error.name === 'AbortError') {
    return 'Запрос отменён.';
  }
  return 'Непредвиденная ошибка. Попробуйте ещё раз.';
}
