import { StorageObjectMeta } from './storage-object-meta';

export interface ValidateObjectsRequest {
  ownerUserId: number;
  objectIds: string[];
  profile: string;
}

export interface ValidateObjectsResponse {
  objects: StorageObjectMeta[];
}
