import { z } from 'zod';

export const credentialsSchema = z.object({
  apiUrl: z
    .string()
    .trim()
    .min(1, 'Укажите apiUrl')
    // относительный путь — для dev-прокси (/green-api)
    .regex(/^(https?:\/\/|\/)/i, 'apiUrl должен начинаться с https:// или с /'),
  mediaUrl: z
    .string()
    .trim()
    .regex(/^$|^(https?:\/\/|\/)/i, 'mediaUrl должен начинаться с https:// или с /'),
  idInstance: z
    .string()
    .trim()
    .min(1, 'Введите idInstance')
    .regex(/^\d+$/, 'idInstance состоит только из цифр'),
  apiTokenInstance: z.string().trim().min(1, 'Введите apiTokenInstance'),
});

export type CredentialsFormValues = z.infer<typeof credentialsSchema>;
