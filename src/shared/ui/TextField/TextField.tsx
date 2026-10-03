import clsx from 'clsx';
import { forwardRef, useId, type InputHTMLAttributes } from 'react';
import styles from './TextField.module.scss';

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label: string;
  error?: string;
  size?: 'medium' | 'large';
}

export const TextField = forwardRef<HTMLInputElement, Props>(function TextField(
  { label, error, size = 'large', id, className, ...rest },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;

  return (
    <div className={clsx(styles.field, className)}>
      <label className={styles.label} htmlFor={inputId}>
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        className={clsx(styles.input, styles[size], error !== undefined && styles.invalid)}
        aria-invalid={error !== undefined || undefined}
        aria-describedby={error !== undefined ? errorId : undefined}
        {...rest}
      />
      {error !== undefined && (
        <p id={errorId} className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
});
