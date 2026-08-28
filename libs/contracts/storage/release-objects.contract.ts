export interface ReleaseObjectsRequest {
  ownerUserId: number;
  objectIds: string[];
  consumer: string;
  idempotencyKey: string;
}

export interface ReleaseObjectsResponse {
  releasedObjectIds: string[];
}
