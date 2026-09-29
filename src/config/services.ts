export const PRODUCTS_EVENTS_CLIENT = 'PRODUCTS_EVENTS_CLIENT';

// Topic exchange shared by every Syner service. It and the work queues are declared
// in syner/rabbitmq/definitions.json; queue arguments here must match that file
export const SYNER_EXCHANGE = 'syner.events';

// Dead-letter exchange (and DLQs) declared in syner/rabbitmq/definitions.json
export const SYNER_DLX = 'syner.dlx';

// Purchase order saga: validation requests and received orders
export const PURCHASE_ORDERS_QUEUE = 'products.purchase-orders';

export const PUBLISH_TIMEOUT_MS = 5000;
