import { z } from 'zod';
import { normalizePhone } from '@/shared/lib/phone';

/**
 * Номер вводят как угодно: `+7 999 123-45-67`, `8 (999) 123-45-67`, `79991234567`.
 * Схема сразу приводит его к виду GREEN-API (только цифры) — дальше работает один формат.
 */
export const createChatSchema = z.object({
  phone: z
    .string()
    .trim()
    .min(1, 'Введите номер телефона')
    .transform((value, context) => {
      const phone = normalizePhone(value);
      if (phone === null) {
        context.addIssue({
          code: 'custom',
          message: 'Не удалось распознать номер. Пример: +7 999 123-45-67',
        });
        return z.NEVER;
      }
      return phone;
    }),
});

export type CreateChatFormValues = z.infer<typeof createChatSchema>;
