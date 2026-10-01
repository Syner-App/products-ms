// Stock alert notifications. Keep in sync with client-gateway/src/common/events/alert.events.ts.
// Published to syner.events after the alert change is committed; the gateway pushes them
// to the organization's sockets. Fire-and-forget: a lost notification only delays the UI
export const AlertEvents = {
  Created: 'alert.created',
  Resolved: 'alert.resolved',
} as const;

// Dates travel as ISO-8601 strings, same as the FindAlerts gRPC response
export interface AlertNotification {
  id: string;
  organization_id: string;
  product_id: number;
  tipo: string;
  estado: string;
  descripcion: string;
  createdAt: string;
  updatedAt?: string;
}

export interface AlertEventPayload {
  organization_id: string;
  alert: AlertNotification;
}
