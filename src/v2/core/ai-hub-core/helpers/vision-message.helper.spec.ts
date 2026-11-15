import { buildVisionMessages, toDataUrl } from './vision-message.helper';

describe('vision-message.helper', () => {
  const file = {
    buffer: Buffer.from('abc'),
    mimeType: 'image/png',
    fileName: 'a.png',
  };

  it('toDataUrl mã hóa base64 kèm mime', () => {
    expect(toDataUrl(file)).toBe('data:image/png;base64,YWJj');
  });

  it('dựng message system và user có chữ + tài liệu', () => {
    const [system, user] = buildVisionMessages('SYS', 'USER', file);
    expect(system).toEqual({ role: 'system', content: 'SYS' });
    expect(user.role).toBe('user');
    expect(user.content).toEqual([
      { type: 'text', text: 'USER' },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,YWJj' } },
    ]);
  });
});
