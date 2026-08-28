import { StorageObjectMeta } from './storage-object-meta';

export interface AttachObjectsRequest {
  ownerUserId: number;
  objectIds: string[];
  profile: string;
  consumer: string;
  idempotencyKey: string;
}

export interface AttachObjectsResponse {
  objects: StorageObjectMeta[];
}
