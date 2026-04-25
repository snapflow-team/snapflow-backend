import { DeletePostMediaFilePayload } from '../types/delete-post-media-file-payload.type';

export function isDeletePostMediaFilePayload(
  payload: unknown,
): payload is DeletePostMediaFilePayload {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  const userId: unknown = Reflect.get(payload, 'userId');
  const fileUrl: unknown = Reflect.get(payload, 'fileUrl');
  return typeof userId === 'number' && typeof fileUrl === 'string';
}
