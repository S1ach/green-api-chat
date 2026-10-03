import { z } from 'zod';
import { normalizePhone } from '@/shared/lib/phone';

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
