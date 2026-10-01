import { useEffect, useRef, useState } from 'react';
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
      <button
        className={isOpen ? `${styles.trigger} ${styles.open}` : styles.trigger}
        type="button"
        aria-label="Меню"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((value) => !value)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      {isOpen && (
        <ul className={styles.menu} role="menu">
          <li role="none">
            <button
              className={styles.item}
              type="button"
              role="menuitem"
              onClick={() => choose(onNewChat)}
            >
              <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="9" cy="8" r="4" />
                <path d="M2 21c0-3.9 3.1-7 7-7s7 3.1 7 7M19 8v6M16 11h6" />
              </svg>
              Новый чат
            </button>
          </li>
          <li role="none">
            <button
              className={`${styles.item} ${styles.danger}`}
              type="button"
              role="menuitem"
              onClick={() => choose(onLogout)}
            >
              <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
                <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11" />
              </svg>
              Выйти
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
