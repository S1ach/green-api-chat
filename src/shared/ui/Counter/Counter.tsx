import clsx from 'clsx';
import styles from './Counter.module.scss';

interface Props {
  value: number;
  /** Подпись для скринридера: само число ничего не объясняет. */
  label: string;
  className?: string;
}

/** Счётчик — Counter из max-ui: число на акцентной «таблетке». */
export function Counter({ value, label, className }: Props) {
  return (
    <span className={clsx(styles.counter, className)} aria-label={label}>
      {value > 999 ? '999+' : value}
    </span>
  );
}
