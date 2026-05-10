export interface RpcMeta {
  requestId?: string | null;
}

export interface RpcEnvelope<T> {
  data: T;
  meta: RpcMeta;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isRpcMeta(value: unknown): value is RpcMeta {
  if (!isRecord(value)) {
    return false;
  }

  return (
    !Object.prototype.hasOwnProperty.call(value, 'requestId') ||
    typeof value.requestId === 'string' ||
    value.requestId === null
  );
}

export function isRpcEnvelope<T>(value: unknown): value is RpcEnvelope<T> {
  return isRecord(value) && 'data' in value && isRpcMeta(value.meta);
}

export function unwrapPayload<T>(value: RpcEnvelope<T> | T): { data: T; meta: RpcMeta } {
  if (isRpcEnvelope<T>(value)) {
    return {
      data: value.data,
      meta: value.meta,
    };
  }

  return {
    data: value,
    meta: {},
  };
}
