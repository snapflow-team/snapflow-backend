export class ReceiveStripeWebhookApplicationDto {
  rawBody: Buffer;
  signature: string;
}
