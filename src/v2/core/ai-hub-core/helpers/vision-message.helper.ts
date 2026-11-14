import { AiChatMessage, AiDocumentFile } from '../contracts/ai-hub.contract';

/** Tài liệu → data URL base64 để gửi kèm message. */
export function toDataUrl(file: Pick<AiDocumentFile, 'buffer' | 'mimeType'>) {
  return `data:${file.mimeType};base64,${file.buffer.toString('base64')}`;
}

/** Dựng cặp message system + user (chữ kèm tài liệu) cho model đọc ảnh/PDF. */
export function buildVisionMessages(
  systemPrompt: string,
  userPrompt: string,
  file: AiDocumentFile,
): AiChatMessage[] {
  return [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: [
        { type: 'text', text: userPrompt },
        { type: 'image_url', image_url: { url: toDataUrl(file) } },
      ],
    },
  ];
}
