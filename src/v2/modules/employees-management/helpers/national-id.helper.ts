/** Che CCCD/CMND khi trả ra API: chỉ giữ 4 số cuối. Giá trị đầy đủ chỉ qua endpoint riêng có quyền cập nhật. */
export const maskNationalId = (
  value: string | null | undefined,
): string | undefined => {
  if (!value) return undefined;
  const tail = value.slice(-4);
  return `${'*'.repeat(Math.max(0, value.length - 4))}${tail}`;
};
