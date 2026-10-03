import { z } from 'zod';

export const stateInstanceSchema = z.object({ stateInstance: z.string() });
export type StateInstanceResponse = z.infer<typeof stateInstanceSchema>;

export const settingsSchema = z.object({
  webhookUrl: z.string().nullish(),
  incomingWebhook: z.string().nullish(),
  outgoingWebhook: z.string().nullish(),
  outgoingMessageWebhook: z.string().nullish(),
});
export type SettingsResponse = z.infer<typeof settingsSchema>;

export const setSettingsSchema = z.object({ saveSettings: z.boolean() });

// либо инстанс не готов, либо результат проверки
export const checkAccountSchema = z.union([
  z.object({ status: z.literal(false), reason: z.string().optional() }),
  z.object({ exist: z.boolean(), chatId: z.string().optional() }),
]);
export type CheckAccountResponse = z.infer<typeof checkAccountSchema>;

export const avatarSchema = z.object({ urlAvatar: z.string().nullish() });
export type AvatarResponse = z.infer<typeof avatarSchema>;

export const contactInfoSchema = z.object({ avatar: z.string().nullish() });
export type ContactInfoResponse = z.infer<typeof contactInfoSchema>;

export const sendMessageSchema = z.object({ idMessage: z.string() });
export type SendMessageResponse = z.infer<typeof sendMessageSchema>;

export const sendFileSchema = z.object({ idMessage: z.string(), urlFile: z.string().nullish() });
export type SendFileResponse = z.infer<typeof sendFileSchema>;

export const accountSettingsSchema = z.object({
  chatId: z.union([z.string(), z.number()]).nullish(),
});
export type AccountSettingsResponse = z.infer<typeof accountSettingsSchema>;

export const remoteContactSchema = z.object({
  chatId: z.string().min(1),
  name: z.string().nullish(),
  contactName: z.string().nullish(),
  phoneNumber: z.number().nullish(),
});

// элементы разбираем по одному, битые пропускаем
export const listSchema = z.array(z.unknown());

export const remoteChatSchema = z.object({
  chatId: z.string().min(1),
  name: z.string().nullish(),
  type: z.string().nullish(),
  phoneNumber: z.number().nullish(),
});

// null — очередь пуста
export const notificationSchema = z
  .object({
    receiptId: z.number(),
    body: z.unknown(),
  })
  .nullable();
export type NotificationEnvelope = NonNullable<z.infer<typeof notificationSchema>>;
