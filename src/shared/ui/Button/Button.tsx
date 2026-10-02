import clsx from 'clsx';
import type { ButtonHTMLAttributes } from 'react';
import { Spinner } from '../Spinner/Spinner';
import styles from './Button.module.scss';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  /** Высота 32, 40 или 52 px — размеры кнопок max-ui. */
  size?: 'xsmall' | 'small' | 'medium';
  /** Растянуть на всю ширину контейнера. */
  stretched?: boolean;
  /** Запрос выполняется: кнопка недоступна, вместо текста — индикатор. */
  isLoading?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'small',
  stretched = false,
  isLoading = false,
  type = 'button',
  disabled,
  className,
  children,
  ...rest
}: Props) {
  return (
    <button
      type={type}
      className={clsx(
        styles.button,
        styles[variant],
        styles[size],
        stretched && styles.stretched,
        isLoading && styles.loading,
        className,
      )}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      {...rest}
    >
      <span className={styles.content}>{children}</span>
      {isLoading && <Spinner className={styles.spinner} size={size === 'medium' ? 24 : 18} />}
    </button>
  );
}
