import { z } from 'zod';

// разделитель может быть и точкой, и запятой
function coordinate(name: string, limit: number) {
  return z
    .string()
    .trim()
    .min(1, `Укажите ${name}`)
    .transform((value, context) => {
      const number = Number(value.replace(',', '.'));
      if (!Number.isFinite(number) || Math.abs(number) > limit) {
        context.addIssue({ code: 'custom', message: `Число от −${limit} до ${limit}` });
        return z.NEVER;
      }
      return number;
    });
}

export const locationSchema = z.object({
  latitude: coordinate('широту', 90),
  longitude: coordinate('долготу', 180),
});

export type LocationFormInput = z.input<typeof locationSchema>;
export type LocationFormValues = z.output<typeof locationSchema>;
