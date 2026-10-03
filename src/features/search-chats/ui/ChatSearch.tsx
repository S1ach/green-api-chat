import { Search, X } from 'lucide-react';
import { useRef } from 'react';
import { IconButton } from '@/shared/ui';
import styles from './ChatSearch.module.scss';

interface Props {
  value: string;
  onChange: (query: string) => void;
}

export function ChatSearch({ value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const clear = () => {
    onChange('');
    inputRef.current?.focus();
  };

  return (
    <div className={styles.search} role="search">
      <Search className={styles.icon} size={18} aria-hidden="true" />
      <input
        ref={inputRef}
        className={styles.input}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            onChange('');
          }
        }}
        placeholder="Поиск"
        aria-label="Поиск по чатам"
        autoComplete="off"
      />
      {value !== '' && (
        <IconButton
          className={styles.clear}
          size="xsmall"
          onClick={clear}
          aria-label="Очистить поиск"
        >
          <X size={16} aria-hidden="true" />
        </IconButton>
      )}
    </div>
  );
}
