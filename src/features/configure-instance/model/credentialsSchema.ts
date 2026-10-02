import { z } from 'zod';

/** Значения формы подключения. Пробелы по краям обрезаются: их часто захватывают при копировании. */
export const credentialsSchema = z.object({
  apiUrl: z
    .string()
    .trim()
    .min(1, 'Укажите apiUrl')
    // Относительный путь нужен для dev-прокси: apiUrl = /green-api.
    .regex(/^(https?:\/\/|\/)/i, 'apiUrl должен начинаться с https:// или с /'),
  idInstance: z
    .string()
    .trim()
    .min(1, 'Введите idInstance')
    .regex(/^\d+$/, 'idInstance состоит только из цифр'),
  apiTokenInstance: z.string().trim().min(1, 'Введите apiTokenInstance'),
});

export type CredentialsFormValues = z.infer<typeof credentialsSchema>;
