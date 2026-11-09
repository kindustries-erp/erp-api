export const NOTIFICATION_TYPES = [
  'INFO',
  'WARNING',
  'ERROR',
  'SUCCESS',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** Dữ liệu tạo một thông báo. `extraData` chứa i18n key/params hoặc dữ liệu tùy biến. */
export interface NotificationPayload {
  title: string;
  message: string;
  type?: NotificationType;
  extraData?: Record<string, unknown>;
  /** Liên kết tới chứng từ để bấm thông báo mở đúng màn hình. */
  target?: NotificationTarget;
}

export interface NotificationTarget {
  module: string;
  id: string;
  action?: string;
}

export interface NotificationListFilter {
  page: number;
  pageSize: number;
  unreadOnly?: boolean;
  type?: NotificationType;
}
