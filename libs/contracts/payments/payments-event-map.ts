import { PaymentsRoutingKey } from './payments-exchange.constants';
import { PaymentCompletedEvent } from './payment-completed.event';
import { PaymentFailedEvent } from './payment-failed.event';

export interface PaymentsEventMap {
  [PaymentsRoutingKey.PaymentCompleted]: PaymentCompletedEvent;
  [PaymentsRoutingKey.PaymentFailed]: PaymentFailedEvent;
}
