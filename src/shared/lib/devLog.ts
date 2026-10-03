// только в dev. URL сюда не передавать — в нём токен
export function devLog(scope: string, ...details: unknown[]): void {
  if (import.meta.env.DEV && import.meta.env.MODE !== 'test') {
    // eslint-disable-next-line no-console
    console.log(`[${scope}]`, ...details);
  }
}
