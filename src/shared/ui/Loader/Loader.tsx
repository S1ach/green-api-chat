import clsx from 'clsx';
import { Spinner } from '../Spinner/Spinner';
import styles from './Loader.module.scss';

interface Props {
  label: string;
  className?: string;
}

export function Loader({ label, className }: Props) {
  return (
    <p className={clsx(styles.loader, className)} role="status">
      <Spinner size={18} appearance="themed" />
      {label}
    </p>
  );
}
