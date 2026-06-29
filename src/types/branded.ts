/**
 * NEXA NautaX — Branded types
 *  — Doc 1 §1.3
 *
 * Estos tipos previenen bugs de refactoring (ej: pasar un AccountId donde se
 * espera un SessionId). TypeScript los trata como distintos aunque ambos sean
 * strings en runtime.
 */

export type AccountId = string & { readonly __brand: 'AccountId' };
export type SessionId = string & { readonly __brand: 'SessionId' };
export type SchedulerTaskId = string & { readonly __brand: 'SchedulerTaskId' };
export type NotificationId = string & { readonly __brand: 'NotificationId' };
export type LogId = string & { readonly __brand: 'LogId' };
export type NetworkRecordId = string & { readonly __brand: 'NetworkRecordId' };
export type CsrfToken = string & { readonly __brand: 'CsrfToken' };
export type AttributeUuid = string & { readonly __brand: 'AttributeUuid' };
export type WlanUserIp = string & { readonly __brand: 'WlanUserIp' };
export type InstallationId = string & { readonly __brand: 'InstallationId' };
export type TraceId = string & { readonly __brand: 'TraceId' };

// —— Factory helpers ————————————————————————————————————————

export function asAccountId(s: string): AccountId {
  return s as AccountId;
}

export function asSessionId(s: string): SessionId {
  return s as SessionId;
}

export function asSchedulerTaskId(s: string): SchedulerTaskId {
  return s as SchedulerTaskId;
}

export function asNotificationId(s: string): NotificationId {
  return s as NotificationId;
}

export function asLogId(s: string): LogId {
  return s as LogId;
}

export function asNetworkRecordId(s: string): NetworkRecordId {
  return s as NetworkRecordId;
}

export function asCsrfToken(s: string): CsrfToken {
  return s as CsrfToken;
}

export function asAttributeUuid(s: string): AttributeUuid {
  return s as AttributeUuid;
}

export function asWlanUserIp(s: string): WlanUserIp {
  return s as WlanUserIp;
}

export function asInstallationId(s: string): InstallationId {
  return s as InstallationId;
}

export function asTraceId(s: string): TraceId {
  return s as TraceId;
}
