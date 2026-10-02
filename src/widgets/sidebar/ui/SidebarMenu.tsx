import clsx from 'clsx';
import { LogOut, Plus, UserPlus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { IconButton } from '@/shared/ui';
import styles from './SidebarMenu.module.scss';

interface Props {
  onNewChat: () => void;
  onLogout: () => void;
}

/** Круглая кнопка «+» с выпадающим меню действий боковой панели. */
export function SidebarMenu({ onNewChat, onLogout }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Закрываем меню кликом мимо него и клавишей Escape.
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const choose = (action: () => void) => {
    setIsOpen(false);
    action();
  };

  return (
    <div className={styles.root} ref={rootRef}>
      <IconButton
        variant="primary"
        aria-label="Меню"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((value) => !value)}
      >
        {/* Открытое меню: плюс поворачивается в крестик. */}
        <Plus
          className={clsx(styles.plus, isOpen && styles.open)}
          size={22}
          strokeWidth={2.4}
          aria-hidden="true"
        />
      </IconButton>

      {isOpen && (
        <ul className={styles.menu} role="menu">
          <li role="none">
            <button
              className={styles.item}
              type="button"
              role="menuitem"
              onClick={() => choose(onNewChat)}
            >
              <UserPlus size={20} aria-hidden="true" />
              Новый чат
            </button>
          </li>
          <li role="none">
            <button
              className={clsx(styles.item, styles.danger)}
              type="button"
              role="menuitem"
              onClick={() => choose(onLogout)}
            >
              <LogOut size={20} aria-hidden="true" />
              Выйти
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
