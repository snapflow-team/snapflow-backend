import { StorageVariantKind } from './storage-variant-kind.enum';

export interface GetSignedUrlItem {
  objectId: string;
  variant: StorageVariantKind;
}

export interface GetSignedUrlsRequest {
  items: GetSignedUrlItem[];
}

export interface SignedUrl {
  objectId: string;
  variant: StorageVariantKind;
  url: string;
  expiresAt: string;
}

export interface GetSignedUrlsResponse {
  urls: SignedUrl[];
}
