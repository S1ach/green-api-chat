import { describe, expect, it } from 'vitest';
import { MAX_FILE_SIZE_BYTES } from '@/shared/config';
import { formatFileSize, validateFile } from '../lib/file';
import { locationSchema } from './locationSchema';

describe('locationSchema', () => {
  it('превращает введённые координаты в числа: разделитель — точка или запятая', () => {
    expect(locationSchema.parse({ latitude: ' 55,7558 ', longitude: '-37.6173' })).toEqual({
      latitude: 55.7558,
      longitude: -37.6173,
    });
  });

  it.each([
    [{ latitude: '', longitude: '37' }, 'Укажите широту'],
    [{ latitude: '55', longitude: '' }, 'Укажите долготу'],
    [{ latitude: '90.1', longitude: '37' }, 'Число от −90 до 90'],
    [{ latitude: '55', longitude: '-181' }, 'Число от −180 до 180'],
    [{ latitude: 'север', longitude: '37' }, 'Число от −90 до 90'],
  ])('отклоняет %o', (input, message) => {
    const result = locationSchema.safeParse(input);

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(message);
  });
});

describe('проверка файла перед отправкой', () => {
  it('не принимает пустой файл и файл больше 100 МБ', () => {
    expect(validateFile({ size: 0 })).toContain('Файл пустой');
    expect(validateFile({ size: MAX_FILE_SIZE_BYTES + 1 })).toContain('до 100 МБ');
    expect(validateFile({ size: MAX_FILE_SIZE_BYTES })).toBeNull();
  });

  it('показывает размер в подходящих единицах', () => {
    expect(formatFileSize(512)).toBe('512 Б');
    expect(formatFileSize(1536)).toBe('1,5 КБ');
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5,0 МБ');
    expect(formatFileSize(150 * 1024 * 1024)).toBe('150 МБ');
  });
});
