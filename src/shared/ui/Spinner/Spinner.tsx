import clsx from 'clsx';
import styles from './Spinner.module.scss';

interface Props {
  size?: number;
  /** `themed` — цвет акцента, `inherit` — цвет окружающего текста (внутри кнопок). */
  appearance?: 'themed' | 'inherit';
  className?: string;
}

/** Индикатор загрузки — кольцо, как Spinner в max-ui. Декоративный: смысл несёт подпись рядом. */
export function Spinner({ size = 20, appearance = 'inherit', className }: Props) {
  return (
    <span
      className={clsx(styles.spinner, styles[appearance], className)}
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
}
