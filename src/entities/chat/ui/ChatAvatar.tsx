import clsx from 'clsx';
import { useState } from 'react';
import { useGetAvatarQuery } from '@/shared/api';
import type { Chat } from '../model/types';
import styles from './ChatAvatar.module.scss';

/** Инициалы-заглушка: буквы имени, иначе последние две цифры номера. */
function initials(title: string): string {
  const letters = title.match(/\p{L}/gu);
  if (letters && letters.length > 0) {
    return letters.slice(0, 2).join('').toUpperCase();
  }
  return title.replace(/\D/g, '').slice(-2) || '#';
}

interface Props {
  chat: Pick<Chat, 'id' | 'title'>;
  size?: 'md' | 'sm';
}

/**
 * Аватар собеседника из GetAvatar. RTK Query кэширует ответ по chatId, поэтому список
 * чатов и шапка делят один запрос. Аватар — украшение: при любой ошибке показываем инициалы.
 */
export function ChatAvatar({ chat, size = 'md' }: Props) {
  const { data: url = '' } = useGetAvatarQuery({ chatId: chat.id });
  // Ссылки на аватар живут недолго: запоминаем, какая именно перестала открываться.
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null);

  const className = clsx(styles.avatar, size === 'sm' && styles.sm);

  if (url === '' || url === brokenUrl) {
    return (
      <span className={className} aria-hidden="true">
        {initials(chat.title)}
      </span>
    );
  }

  return (
    <img className={className} src={url} alt="" loading="lazy" onError={() => setBrokenUrl(url)} />
  );
}
