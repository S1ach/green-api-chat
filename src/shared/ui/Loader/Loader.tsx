import clsx from 'clsx';
import { LoaderCircle } from 'lucide-react';
import styles from './Loader.module.scss';

interface Props {
  /** Подпись рядом с индикатором; без неё индикатор декоративный (например, внутри кнопки). */
  label?: string;
  size?: number;
  className?: string;
}

export function Loader({ label, size = 18, className }: Props) {
  const icon = <LoaderCircle className={styles.icon} size={size} aria-hidden="true" />;
  if (label === undefined) {
    return <span className={clsx(styles.inline, className)}>{icon}</span>;
  }
  return (
    <p className={clsx(styles.block, className)} role="status">
      {icon}
      {label}
    </p>
  );
}
