import { z } from 'zod';

/**
 * Схемы «сырых» ответов GREEN-API. RTK Query проверяет по ним тело ответа до того,
 * как данные попадут в приложение: неожиданный формат становится обычной ошибкой запроса.
 */

/** Ответ getStateInstance. */
export const stateInstanceSchema = z.object({ stateInstance: z.string() });
export type StateInstanceResponse = z.infer<typeof stateInstanceSchema>;

/** Ответ GetSettings — только поля, влияющие на приём сообщений. */
export const settingsSchema = z.object({
  webhookUrl: z.string().nullish(),
  incomingWebhook: z.string().nullish(),
});
export type SettingsResponse = z.infer<typeof settingsSchema>;

/** Ответ CheckAccount: инстанс не готов либо результат проверки номера. */
export const checkAccountSchema = z.union([
  z.object({ status: z.literal(false), reason: z.string().optional() }),
  z.object({ exist: z.boolean(), chatId: z.string().optional() }),
]);
export type CheckAccountResponse = z.infer<typeof checkAccountSchema>;

/** Ответ GetAvatar: пустая строка, если аватара нет или он скрыт настройками приватности. */
export const avatarSchema = z.object({ urlAvatar: z.string().nullish() });
export type AvatarResponse = z.infer<typeof avatarSchema>;

/** Ответ SendMessage. */
export const sendMessageSchema = z.object({ idMessage: z.string() });
export type SendMessageResponse = z.infer<typeof sendMessageSchema>;

/** Ответы GetChats и GetChatHistory: элементы разбираются по одному, битые пропускаются. */
export const listSchema = z.array(z.unknown());

/** Элемент ответа GetChats. */
export const remoteChatSchema = z.object({
  chatId: z.string().min(1),
  name: z.string().nullish(),
  type: z.string().nullish(),
  phoneNumber: z.number().nullish(),
});

/** Ответ ReceiveNotification: `null` (очередь пуста) либо конверт с квитанцией. */
export const notificationSchema = z
  .object({
    receiptId: z.number(),
    /** Тело уведомления разбирается отдельно — в `entities/message`. */
    body: z.unknown(),
  })
  .nullable();
export type NotificationEnvelope = NonNullable<z.infer<typeof notificationSchema>>;
