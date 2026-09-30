import { useEffect, useState } from 'react';
import type { Chat } from '../types/chat';
import styles from './ChatAvatar.module.css';

/** Инициалы-заглушка: буквы имени, иначе последние две цифры номера. */
function initials(chat: Chat): string {
  const letters = chat.title.match(/\p{L}/gu);
  if (letters && letters.length > 0) {
    return letters.slice(0, 2).join('').toUpperCase();
  }
  return chat.title.replace(/\D/g, '').slice(-2) || '#';
}

interface Props {
  chat: Chat;
  size?: 'md' | 'sm';
}

export function ChatAvatar({ chat, size = 'md' }: Props) {
  const [broken, setBroken] = useState(false);
  const url = chat.avatarUrl ?? '';

  // Ссылки на аватар живут недолго: при смене сбрасываем отметку о сбое.
  useEffect(() => setBroken(false), [url]);

  const className = size === 'sm' ? `${styles.avatar} ${styles.sm}` : styles.avatar;

  if (url === '' || broken) {
    return (
      <span className={className} aria-hidden="true">
        {initials(chat)}
      </span>
    );
  }

  return (
    <img
      className={className}
      src={url}
      alt=""
      loading="lazy"
      onError={() => setBroken(true)}
    />
  );
}
