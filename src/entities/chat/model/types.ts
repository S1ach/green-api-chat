/** Ссылка на аватар чата и момент, когда её пора запросить заново. */
export interface ChatAvatarInfo {
  /** Пустая строка — аватара нет или он скрыт настройками приватности. */
  url: string;
  /** Время в миллисекундах, раньше которого аватар у API не запрашивается. */
  refreshAt: number;
}

export interface Chat {
  /** chatId из CheckAccount (числовой) либо "номер@c.us". */
  id: string;
  /** Нормализованный номер, если известен. */
  phone: string | null;
  title: string;
  /** Тип чата из GetChats: user, group, channel, bot; `null` — неизвестен. */
  chatType: string | null;
  unreadCount: number;
  lastActivity: number;
  lastPreview: string;
  /** Нет, пока аватар ни разу не запрашивали. */
  avatar?: ChatAvatarInfo;
}
