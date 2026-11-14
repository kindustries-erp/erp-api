/** Escape ký tự đặc biệt của LIKE (`\`, `%`, `_`) để tiền tố được so khớp nguyên văn */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}
