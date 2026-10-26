/**
 * Ghi chú tạm dạng câu hỏi của kế toán: "Thu tiền của đối tượng nào? Hóa đơn số bao nhiêu?".
 * Dữ liệu có nhiều biến thể gõ sai ("đối tương", "đối tường"), nên pattern nới lỏng.
 */
const THU_TIEN_QUESTION_PATTERN =
  /Thu ti[ềe]n c[ủu]a [đd][ốo]i t\S+ n[àa]o\?\s*H[óo]a [đd][ơo]n s[ốo] bao nhi[êe]u\?/iu;

/**
 * Bỏ đúng câu hỏi "Thu tiền của đối tượng nào?…" khỏi ghi chú, giữ phần còn lại.
 * Trả về null khi không còn nội dung nào sau khi bỏ.
 */
export const stripThuTienQuestion = (note: string | null): string | null => {
  if (!note) return null;
  const remainder = note.replace(THU_TIEN_QUESTION_PATTERN, '').trim();
  return remainder === '' ? null : remainder;
};

export const hasThuTienQuestion = (note: string | null): boolean =>
  note !== null && THU_TIEN_QUESTION_PATTERN.test(note);
