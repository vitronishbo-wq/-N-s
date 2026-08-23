import { AdminAuditEvent, AdminAuditEntry, AdminUser, AdminPermission } from '../../types';

const AUDIT_STORAGE_KEY = 'en_admin_audit_logs_v2';

export class AuditService {
  private static instance: AuditService;
  private logs: AdminAuditEvent[] = [];

  private constructor() {
    this.loadLogs();
  }

  public static getInstance(): AuditService {
    if (!AuditService.instance) {
      AuditService.instance = new AuditService();
    }
    return AuditService.instance;
  }

  private loadLogs(): void {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(AUDIT_STORAGE_KEY);
      if (stored) {
        this.logs = JSON.parse(stored);
      } else {
        // Initial bootstrap logs
        this.logs = [
          {
            id: 'audit_init_1',
            actorId: 'admin_founder',
            actorDisplayName: 'Sila Marco',
            actorRole: 'founder',
            module: 'governance',
            resourceType: 'system_core',
            resourceId: 'cplp_discovery_engine',
            action: 'INITIALIZE_SECURITY_CORE',
            result: 'success',
            justification: 'Sistema administrativo iniciado com sucesso.',
            authContext: {
              permissionsChecked: ['governance:manage'],
              policyApplied: 'founder_unrestricted_governance',
              clientIp: '127.0.0.1',
              userAgent: 'Admin-Control-Shell/2.0'
            },
            timestamp: Date.now() - 3600000
          }
        ];
      }
    } catch {
      this.logs = [];
    }
  }

  private saveLogs(): void {
    if (typeof window === 'undefined') return;
    try {
      // Keep last 1000 audit entries
      const slice = this.logs.slice(0, 1000);
      localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(slice));
    } catch {}
  }

  /**
   * 4.19: Records a structured admin audit event with operator identity, action, resource, timestamp, result and authorization context
   */
  public logEvent(
    actor: AdminUser,
    entry: {
      module: AdminAuditEvent['module'];
      resourceType: string;
      resourceId: string;
      action: string;
      result?: 'success' | 'denied' | 'error';
      previousState?: unknown;
      newState?: unknown;
      justification?: string;
      authContext?: {
        permissionsChecked: AdminPermission[];
        policyApplied?: string;
        clientIp?: string;
        userAgent?: string;
      };
    }
  ): AdminAuditEvent {
    const record: AdminAuditEvent = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      actorId: actor.id,
      actorDisplayName: actor.displayName || actor.name || actor.email,
      actorRole: actor.role,
      module: entry.module,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
      action: entry.action,
      result: entry.result || 'success',
      previousState: entry.previousState,
      newState: entry.newState,
      justification: entry.justification,
      authContext: entry.authContext || {
        permissionsChecked: [],
        clientIp: 'web-control-panel',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Node/Control'
      },
      timestamp: Date.now()
    };

    this.logs.unshift(record);
    this.saveLogs();
    return record;
  }

  /**
   * Backwards compatible wrapper for logMutation
   */
  public logMutation(
    actor: AdminUser,
    entry: {
      module: any;
      resourceType: string;
      resourceId: string;
      action: string;
      previousState?: unknown;
      newState?: unknown;
      justification?: string;
      ipOrContext?: string;
    }
  ): AdminAuditEvent {
    return this.logEvent(actor, {
      module: entry.module,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
      action: entry.action,
      result: 'success',
      previousState: entry.previousState,
      newState: entry.newState,
      justification: entry.justification,
      authContext: {
        permissionsChecked: [],
        clientIp: entry.ipOrContext || 'web-control-panel'
      }
    });
  }

  public getLogs(filters?: {
    module?: AdminAuditEvent['module'];
    actorId?: string;
    resourceType?: string;
    searchQuery?: string;
    result?: 'success' | 'denied' | 'error';
  }): AdminAuditEvent[] {
    let result = [...this.logs];

    if (filters?.module) {
      result = result.filter(l => l.module === filters.module);
    }
    if (filters?.actorId) {
      result = result.filter(l => l.actorId === filters.actorId);
    }
    if (filters?.resourceType) {
      result = result.filter(l => l.resourceType === filters.resourceType);
    }
    if (filters?.result) {
      result = result.filter(l => l.result === filters.result);
    }
    if (filters?.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      result = result.filter(
        l =>
          l.action.toLowerCase().includes(q) ||
          l.actorDisplayName.toLowerCase().includes(q) ||
          l.resourceId.toLowerCase().includes(q) ||
          (l.justification && l.justification.toLowerCase().includes(q))
      );
    }

    return result;
  }
}
