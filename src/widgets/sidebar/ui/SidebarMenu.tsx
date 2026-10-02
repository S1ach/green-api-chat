import clsx from 'clsx';
import { LogOut, Plus, UserPlus } from 'lucide-react';
import { usePopup } from '@/shared/lib/usePopup';
import { IconButton, Menu, MenuItem } from '@/shared/ui';
import styles from './SidebarMenu.module.scss';

interface Props {
  onNewChat: () => void;
  onLogout: () => void;
}

/** Круглая кнопка «+» с выпадающим меню действий боковой панели. */
export function SidebarMenu({ onNewChat, onLogout }: Props) {
  const { isOpen, rootRef, toggle, close } = usePopup<HTMLDivElement>();

  const choose = (action: () => void) => {
    close();
    action();
  };

  return (
    <div className={styles.root} ref={rootRef}>
      <IconButton
        variant="primary"
        aria-label="Меню"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={toggle}
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
        <Menu className={styles.menu}>
          <MenuItem
            icon={<UserPlus size={20} aria-hidden="true" />}
            onClick={() => choose(onNewChat)}
          >
            Новый чат
          </MenuItem>
          <MenuItem
            icon={<LogOut size={20} aria-hidden="true" />}
            tone="danger"
            onClick={() => choose(onLogout)}
          >
            Выйти
          </MenuItem>
        </Menu>
      )}
    </div>
  );
}
