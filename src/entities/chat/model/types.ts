export interface ChatAvatarInfo {
  // '' — аватара нет
  url: string;
  refreshAt: number;
}

export interface Chat {
  id: string;
  phone: string | null;
  title: string;
  chatType: string | null;
  unreadCount: number;
  lastActivity: number;
  lastPreview: string;
  avatar?: ChatAvatarInfo;
}
