import clsx from 'clsx';
import type { ButtonHTMLAttributes } from 'react';
import { Loader } from '../Loader/Loader';
import styles from './Button.module.scss';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
  /** Запрос выполняется: кнопка недоступна, рядом с текстом — индикатор. */
  isLoading?: boolean;
}

export function Button({
  variant = 'primary',
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
      className={clsx(styles.button, styles[variant], className)}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      {...rest}
    >
      {isLoading && <Loader size={16} />}
      {children}
    </button>
  );
}
