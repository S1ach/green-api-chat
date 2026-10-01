import { useGetSettingsQuery, type InstanceSettings } from '@/shared/api';

/** Что в настройках инстанса мешает приёму через ReceiveNotification; `null` — всё в порядке. */
export function settingsProblem(settings: InstanceSettings): string | null {
  if (settings.webhookUrl.trim() !== '') {
    return 'в настройках инстанса задан webhookUrl — уведомления уходят на вебхук, а не в очередь HTTP API. Очистите поле webhookUrl в консоли GREEN-API.';
  }
  if (settings.incomingWebhook !== 'yes') {
    return 'в настройках инстанса выключено «Получать уведомления о входящих сообщениях» (incomingWebhook). Включите его в консоли GREEN-API — входящие не попадают в очередь.';
  }
  return null;
}

/**
 * Входящие не придут, если инстанс настроен на вебхук или не отдаёт входящие в очередь.
 * Проверяем это после входа и явно сообщаем, что проблема в настройках, а не в приложении.
 * Если сами настройки получить не удалось, предупреждения нет: это не повод пугать пользователя.
 */
export function useSettingsWarning(): string | null {
  const { data: settings } = useGetSettingsQuery();
  return settings === undefined ? null : settingsProblem(settings);
}
