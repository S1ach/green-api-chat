import {
  getApiErrorMessage,
  useGetSettingsQuery,
  useSetSettingsMutation,
  type InstanceSettings,
} from '@/shared/api';

interface SettingsProblem {
  message: string;
  canFix: boolean;
}

export function settingsProblem(settings: InstanceSettings): SettingsProblem | null {
  if (settings.webhookUrl.trim() !== '') {
    return {
      message:
        'В настройках инстанса задан webhookUrl — уведомления уходят на вебхук, а не в очередь HTTP API. ' +
        'Очистите поле webhookUrl в консоли GREEN-API.',
      // webhookUrl могли задать намеренно, сами не трогаем
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
  problem: SettingsProblem | null;
  fix: () => void;
  isFixing: boolean;
  fixError: string | null;
  isApplying: boolean;
}

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
