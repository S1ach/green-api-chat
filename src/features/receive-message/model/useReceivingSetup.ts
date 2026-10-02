import {
  getApiErrorMessage,
  useGetSettingsQuery,
  useSetSettingsMutation,
  type InstanceSettings,
} from '@/shared/api';

interface SettingsProblem {
  message: string;
  /** Приложение может исправить настройку само, методом SetSettings. */
  canFix: boolean;
}

/** Что в настройках инстанса мешает приёму через ReceiveNotification; `null` — всё в порядке. */
export function settingsProblem(settings: InstanceSettings): SettingsProblem | null {
  if (settings.webhookUrl.trim() !== '') {
    return {
      message:
        'В настройках инстанса задан webhookUrl — уведомления уходят на вебхук, а не в очередь HTTP API. ' +
        'Очистите поле webhookUrl в консоли GREEN-API.',
      // Адрес вебхука мог быть задан намеренно — молча его не стираем.
      canFix: false,
    };
  }
  if (settings.incomingWebhook !== 'yes') {
    return {
      message:
        'В настройках инстанса выключено получение уведомлений о входящих сообщениях ' +
        '(incomingWebhook), поэтому новые сообщения из MAX не попадают в очередь.',
      canFix: true,
    };
  }
  return null;
}

interface ReceivingSetup {
  /** Что мешает приёму сообщений; `null` — всё в порядке или настройки ещё не получены. */
  problem: SettingsProblem | null;
  /** Включает уведомления, нужные приложению. */
  fix: () => void;
  isFixing: boolean;
  fixError: string | null;
  /** Настройки только что сохранены: инстанс перезапускается и применяет их. */
  isApplying: boolean;
}

/**
 * Входящие не придут, если инстанс настроен на вебхук или не отдаёт входящие в очередь.
 * Проверяем это после входа, прямо говорим, что дело в настройках, и предлагаем включить
 * нужные уведомления: о входящих, о сообщениях с телефона и о статусах доставки.
 */
export function useReceivingSetup(): ReceivingSetup {
  const { data: settings } = useGetSettingsQuery();
  const [setSettings, { isLoading, isSuccess, error }] = useSetSettingsMutation();

  return {
    problem: settings === undefined ? null : settingsProblem(settings),
    fix: () =>
      void setSettings({
        incomingWebhook: 'yes',
        outgoingMessageWebhook: 'yes',
        outgoingWebhook: 'yes',
      }),
    isFixing: isLoading,
    fixError: error === undefined ? null : getApiErrorMessage(error),
    isApplying: isSuccess,
  };
}
