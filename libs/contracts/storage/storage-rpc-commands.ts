/**
 * Явный таймаут RPC-клиента для команд storage.v1.
 * Не полагаться на default из RpcCaller — всегда передавать timeoutMs.
 */
export const STORAGE_RPC_TIMEOUT_MS = 5_000;

/** Максимальный размер batch в одной RPC-команде storage.v1. */
export const STORAGE_RPC_MAX_BATCH_SIZE = 50;

export enum StorageRpcCommand {
  ValidateObjects = 'storage.v1.validate_objects',
  AttachObjects = 'storage.v1.attach_objects',
  ReleaseObjects = 'storage.v1.release_objects',
  GetSignedUrls = 'storage.v1.get_signed_urls',
  GetObjectsMeta = 'storage.v1.get_objects_meta',
}
