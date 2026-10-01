export const PRODUCTS_EVENTS_CLIENT = 'PRODUCTS_EVENTS_CLIENT';

// Topic exchange shared by every Syner service. It and the work queues are declared
// in syner/rabbitmq/definitions.json; queue arguments here must match that file
export const SYNER_EXCHANGE = 'syner.events';

// Dead-letter exchange (and DLQs) declared in syner/rabbitmq/definitions.json
export const SYNER_DLX = 'syner.dlx';

// Purchase order saga (validation requests and received orders) and finance-ms sales. The
// RMQ server binds it to the pattern of every RMQ handler of the app (wildcards), so all the
// events products-ms consumes from syner.events arrive here
export const PURCHASE_ORDERS_QUEUE = 'products.purchase-orders';

export const PUBLISH_TIMEOUT_MS = 5000;

// Stock alerts: point-to-point request/reply queue consumed by products-ms itself.
// The producer waits for the reply (direct reply-to), so alert sync is synchronous
export const ALERTS_CLIENT = 'ALERTS_CLIENT';
export const ALERTS_QUEUE = 'products.alerts';
export const ALERT_RPC_TIMEOUT_MS = 5000;

export const AlertPatterns = {
  SyncLowStock: 'alerts.sync-low-stock',
} as const;
