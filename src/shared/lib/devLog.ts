/**
 * Диагностический лог только для режима разработки (`npm run dev`).
 * В продакшен-сборке и в тестах ничего не выводит. Сюда никогда не передаём URL запросов
 * и учётные данные — в URL GREEN-API зашит apiTokenInstance.
 */
export function devLog(scope: string, ...details: unknown[]): void {
  if (import.meta.env.DEV && import.meta.env.MODE !== 'test') {
    // eslint-disable-next-line no-console
    console.log(`[${scope}]`, ...details);
  }
}
