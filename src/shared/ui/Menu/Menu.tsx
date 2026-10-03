import clsx from 'clsx';
import type { ReactNode } from 'react';
import styles from './Menu.module.scss';

interface MenuProps {
  className?: string;
  children: ReactNode;
}

export function Menu({ className, children }: MenuProps) {
  return (
    <ul className={clsx(styles.menu, className)} role="menu">
      {children}
    </ul>
  );
}

interface MenuItemProps {
  icon: ReactNode;
  tone?: 'default' | 'danger';
  onClick: () => void;
  children: ReactNode;
}

export function MenuItem({ icon, tone = 'default', onClick, children }: MenuItemProps) {
  return (
    <li role="none">
      <button
        className={clsx(styles.item, tone === 'danger' && styles.danger)}
        type="button"
        role="menuitem"
        onClick={onClick}
      >
        {icon}
        {children}
      </button>
    </li>
  );
}
