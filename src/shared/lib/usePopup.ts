import { useCallback, useEffect, useRef, useState } from 'react';

export function usePopup<Root extends HTMLElement>() {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<Root>(null);

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

  const toggle = useCallback(() => setIsOpen((value) => !value), []);
  const close = useCallback(() => setIsOpen(false), []);

  return { isOpen, rootRef, toggle, close };
}
