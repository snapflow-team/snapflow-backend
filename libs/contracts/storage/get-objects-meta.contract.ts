import { StorageObjectMeta } from './storage-object-meta';

export interface GetObjectsMetaRequest {
  objectIds: string[];
}

export interface GetObjectsMetaResponse {
  objects: StorageObjectMeta[];
}
