import { X } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { IconButton } from '../IconButton/IconButton';
import styles from './Modal.module.scss';

const FOCUSABLE = 'a[href], button:not(:disabled), input:not(:disabled), textarea:not(:disabled)';

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Модальное окно поверх приложения. Закрывается крестиком, клавишей Escape и кликом по фону.
 * Фокус при открытии переходит в окно и не покидает его, а после закрытия возвращается назад.
 */
export function Modal({ title, onClose, children }: Props) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  // Запоминаем при первом рендере — до того, как фокус перейдёт в окно.
  const [previousFocus] = useState(() => document.activeElement);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog !== null && !dialog.contains(document.activeElement)) {
      // Первым делом — в поле ввода, если оно есть: окно открывают, чтобы что-то ввести.
      (dialog.querySelector<HTMLElement>('input, textarea') ?? dialog).focus();
    }
    return () => {
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus();
      }
    };
  }, [previousFocus]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab') {
      return;
    }
    // Tab ходит по кругу внутри окна.
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (first === undefined || last === undefined) {
      event.preventDefault();
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div
      className={styles.backdrop}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <header className={styles.header}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          <IconButton onClick={onClose} aria-label="Закрыть">
            <X size={22} aria-hidden="true" />
          </IconButton>
        </header>
        <div className={styles.body}>{children}</div>
      </div>
    </div>,
    document.body,
  );
}
