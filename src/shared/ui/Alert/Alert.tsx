import clsx from 'clsx';
import { CircleAlert, Info, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import styles from './Alert.module.scss';

const ICONS = { error: CircleAlert, warning: TriangleAlert, info: Info };

interface Props {
  tone?: 'error' | 'warning' | 'info';
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function Alert({ tone = 'error', children, action, className }: Props) {
  const Icon = ICONS[tone];
  return (
    <div
      className={clsx(styles.alert, styles[tone], className)}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <Icon className={styles.icon} size={18} aria-hidden="true" />
      <span className={styles.text}>{children}</span>
      {action}
    </div>
  );
}
