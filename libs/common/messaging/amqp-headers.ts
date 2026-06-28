import type { ConsumeMessage } from 'amqplib';
import { REQUEST_ID_HEADER } from '../constants/request-id.constants';

export function extractRequestIdFromAmqpMsg(msg: ConsumeMessage): string | undefined {
  const value: unknown = msg.properties.headers?.[REQUEST_ID_HEADER];

  return typeof value === 'string' ? value : undefined;
}
