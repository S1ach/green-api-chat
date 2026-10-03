import { MAX_FILE_SIZE_BYTES } from '@/shared/config';

const UNITS = ['Б', 'КБ', 'МБ', 'ГБ'];

export function formatFileSize(bytes: number): string {
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const digits = unit === 0 || value >= 100 ? 0 : 1;
  return `${value.toFixed(digits).replace('.', ',')} ${UNITS[unit]}`;
}

export function validateFile(file: Pick<File, 'size'>): string | null {
  if (file.size === 0) {
    return 'Файл пустой — отправить его нельзя.';
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `Файл слишком большой (${formatFileSize(file.size)}). GREEN-API принимает файлы до 100 МБ.`;
  }
  return null;
}
