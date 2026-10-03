import clsx from 'clsx';
import { useState, type CSSProperties, type ReactNode } from 'react';
import styles from './Avatar.module.scss';

const GRADIENTS = ['red', 'orange', 'green', 'blue', 'purple'] as const;

// у одного собеседника всегда один цвет
function gradientFor(seed: string): (typeof GRADIENTS)[number] {
  let hash = 0;
  for (const char of seed) {
    hash = (hash * 31 + (char.codePointAt(0) ?? 0)) % 997;
  }
  return GRADIENTS[hash % GRADIENTS.length] ?? 'blue';
}

// для номера телефона — две последние цифры
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
  name: string;
  seed: string;
  src?: string;
  icon?: ReactNode;
  onError?: (src: string) => void;
  size?: number;
  className?: string;
}

export function Avatar({ name, seed, src = '', icon, onError, size = 48, className }: Props) {
  const [brokenSrc, setBrokenSrc] = useState<string | null>(null);
  const style: CSSProperties = { width: size, height: size, fontSize: Math.round(size * 0.38) };

  if (icon !== undefined) {
    return (
      <span
        className={clsx(styles.avatar, styles.themed, className)}
        style={style}
        aria-hidden="true"
      >
        {icon}
      </span>
    );
  }

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
      onError={() => {
        setBrokenSrc(src);
        onError?.(src);
      }}
    />
  );
}
