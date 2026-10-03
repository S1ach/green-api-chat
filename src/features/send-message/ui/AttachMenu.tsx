import { File, MapPin, Paperclip, UserRound } from 'lucide-react';
import { usePopup } from '@/shared/lib/usePopup';
import { IconButton, Menu, MenuItem } from '@/shared/ui';
import styles from './AttachMenu.module.scss';

interface Props {
  onFile: () => void;
  onContact: () => void;
  onLocation: () => void;
}

export function AttachMenu({ onFile, onContact, onLocation }: Props) {
  const { isOpen, rootRef, toggle, close } = usePopup<HTMLDivElement>();

  const choose = (action: () => void) => {
    close();
    action();
  };

  return (
    <div className={styles.root} ref={rootRef}>
      <IconButton
        aria-label="Прикрепить"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={toggle}
      >
        <Paperclip size={22} aria-hidden="true" />
      </IconButton>

      {isOpen && (
        <Menu className={styles.menu}>
          <MenuItem icon={<File size={20} aria-hidden="true" />} onClick={() => choose(onFile)}>
            Файл
          </MenuItem>
          <MenuItem
            icon={<UserRound size={20} aria-hidden="true" />}
            onClick={() => choose(onContact)}
          >
            Контакт
          </MenuItem>
          <MenuItem
            icon={<MapPin size={20} aria-hidden="true" />}
            onClick={() => choose(onLocation)}
          >
            Геопозиция
          </MenuItem>
        </Menu>
      )}
    </div>
  );
}
