/**
 * Quản lý trạng thái chia sẻ (Shared State) cho Cron Tự động Đồng bộ Hóa đơn GDT
 * Ngăn ngừa circular dependency giữa InvoicePortalService và ErpInvoicesCronService.
 */
export class GdtCronStateHelper {
  private static isPausedDueToAuthError = false;
  private static lastExecutedSlotKey: string | null = null;
  private static onResumeCallbacks: Array<() => void> = [];

  /**
   * Kiểm tra xem cron có đang bị tạm dừng do lỗi xác thực / mật khẩu hay không
   */
  public static isPaused(): boolean {
    return this.isPausedDueToAuthError;
  }

  /**
   * Kích hoạt cờ tạm dừng khẩn cấp (zero-lockout guard)
   */
  public static pauseDueToAuthError() {
    this.isPausedDueToAuthError = true;
  }

  /**
   * Mở khóa lại cron khi người dùng cập nhật thông tin/mật khẩu mới
   */
  public static resume() {
    this.isPausedDueToAuthError = false;
    this.lastExecutedSlotKey = null;
    for (const callback of this.onResumeCallbacks) {
      try {
        callback();
      } catch {
        // ignore callback error
      }
    }
  }

  /**
   * Đăng ký callback khi cron được khôi phục
   */
  public static onResume(callback: () => void) {
    this.onResumeCallbacks.push(callback);
  }

  public static getLastExecutedSlotKey(): string | null {
    return this.lastExecutedSlotKey;
  }

  public static setLastExecutedSlotKey(key: string | null) {
    this.lastExecutedSlotKey = key;
  }

  /**
   * Dùng cho Unit Test reset state
   */
  public static resetStateForTest() {
    this.isPausedDueToAuthError = false;
    this.lastExecutedSlotKey = null;
    this.onResumeCallbacks = [];
  }
}
