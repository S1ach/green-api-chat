import clsx from 'clsx';
import { Spinner } from '../Spinner/Spinner';
import styles from './Loader.module.scss';

interface Props {
  /** Что именно загружается — текст рядом с индикатором. */
  label: string;
  className?: string;
}

/** Состояние загрузки блока: индикатор с подписью. */
export function Loader({ label, className }: Props) {
  return (
    <p className={clsx(styles.loader, className)} role="status">
      <Spinner size={18} appearance="themed" />
      {label}
    </p>
  );
}
