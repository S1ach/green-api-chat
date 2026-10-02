import clsx from 'clsx';
import { useState, type CSSProperties } from 'react';
import styles from './Avatar.module.scss';

const GRADIENTS = ['red', 'orange', 'green', 'blue', 'purple'] as const;

/** Один и тот же собеседник всегда получает один и тот же цвет. */
function gradientFor(seed: string): (typeof GRADIENTS)[number] {
  let hash = 0;
  for (const char of seed) {
    hash = (hash * 31 + (char.codePointAt(0) ?? 0)) % 997;
  }
  return GRADIENTS[hash % GRADIENTS.length] ?? 'blue';
}

/** Инициалы: первые буквы слов имени, а для номера телефона — две последние цифры. */
function initials(name: string): string {
  const words = name.match(/\p{L}+/gu);
  if (words && words.length > 0) {
    return words
      .slice(0, 2)
      .map((word) => word[0])
      .join('')
      .toUpperCase();
  }
  return name.replace(/\D/g, '').slice(-2) || '#';
}

interface Props {
  /** Имя — источник инициалов. */
  name: string;
  /** Постоянный идентификатор — от него зависит цвет заглушки. */
  seed: string;
  /** Ссылка на картинку; пустая строка — показать инициалы. */
  src?: string;
  size?: number;
  className?: string;
}

/**
 * Аватар как в max-ui: круг с картинкой либо инициалы на фирменном градиенте.
 * Декоративный — имя собеседника всегда написано рядом.
 */
export function Avatar({ name, seed, src = '', size = 48, className }: Props) {
  // Ссылки на аватар живут недолго: запоминаем, какая именно перестала открываться.
  const [brokenSrc, setBrokenSrc] = useState<string | null>(null);
  const style: CSSProperties = { width: size, height: size, fontSize: Math.round(size * 0.38) };

  if (src === '' || src === brokenSrc) {
    return (
      <span
        className={clsx(styles.avatar, styles[gradientFor(seed)], className)}
        style={style}
        aria-hidden="true"
      >
        {initials(name)}
      </span>
    );
  }

  return (
    <img
      className={clsx(styles.avatar, className)}
      style={style}
      src={src}
      alt=""
      loading="lazy"
      onError={() => setBrokenSrc(src)}
    />
  );
}
