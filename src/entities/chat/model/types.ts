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
}
