export const STORAGE_E1_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export const STORAGE_E1_DOCUMENT_MIME_TYPES = ['application/pdf', 'text/plain'] as const;

export const STORAGE_E2_VIDEO_MIME_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'] as const;

export const STORAGE_E2_VOICE_MIME_TYPES = [
  'audio/ogg',
  'audio/webm',
  'audio/mpeg',
  'audio/mp4',
] as const;

export const STORAGE_MESSAGE_ATTACHMENT_MIME_TYPES = [
  ...STORAGE_E1_IMAGE_MIME_TYPES,
  ...STORAGE_E1_DOCUMENT_MIME_TYPES,
  ...STORAGE_E2_VIDEO_MIME_TYPES,
] as const;

export const STORAGE_VOICE_MESSAGE_MIME_TYPES = [...STORAGE_E2_VOICE_MIME_TYPES] as const;
