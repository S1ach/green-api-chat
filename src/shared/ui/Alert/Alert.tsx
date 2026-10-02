import clsx from 'clsx';
import { CircleAlert, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import styles from './Alert.module.scss';

interface Props {
  /** `error` — действие не удалось; `warning` — приложение работает, но с оговоркой. */
  tone?: 'error' | 'warning';
  children: ReactNode;
  className?: string;
}

export function Alert({ tone = 'error', children, className }: Props) {
  const Icon = tone === 'error' ? CircleAlert : TriangleAlert;
  return (
    <div
      className={clsx(styles.alert, styles[tone], className)}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <Icon className={styles.icon} size={16} aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}
