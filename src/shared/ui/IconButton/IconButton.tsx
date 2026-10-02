import clsx from 'clsx';
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import styles from './IconButton.module.scss';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Кнопка без текста обязана называться для скринридера. */
  'aria-label': string;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'xsmall' | 'small';
}

/** Круглая кнопка с иконкой — IconButton из max-ui. */
export const IconButton = forwardRef<HTMLButtonElement, Props>(function IconButton(
  { variant = 'ghost', size = 'small', type = 'button', className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={clsx(styles.button, styles[variant], styles[size], className)}
      {...rest}
    >
      {children}
    </button>
  );
});
