import clsx from 'clsx';
import styles from './Counter.module.scss';

interface Props {
  value: number;
  label: string;
  className?: string;
}

export function Counter({ value, label, className }: Props) {
  return (
    <span className={clsx(styles.counter, className)} aria-label={label}>
      {value > 999 ? '999+' : value}
    </span>
  );
}
