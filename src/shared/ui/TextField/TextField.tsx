import clsx from 'clsx';
import { forwardRef, useId, type InputHTMLAttributes } from 'react';
import styles from './TextField.module.scss';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  /** Текст ошибки валидации; показывается под полем. */
  error?: string;
}

/** Поле ввода с подписью и ошибкой. `ref` пробрасывается для `register` из React Hook Form. */
export const TextField = forwardRef<HTMLInputElement, Props>(function TextField(
  { label, error, id, className, ...rest },
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
        className={clsx(styles.input, error !== undefined && styles.invalid)}
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
