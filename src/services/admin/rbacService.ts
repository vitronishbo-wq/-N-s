import { AdminUser, AdminRole, AdminPermission } from '../../types';

export const ROLE_PERMISSIONS_MAP: Record<string, AdminPermission[]> = {
  founder: [
    'users:read',
    'users:update',
    'users:block',
    'trust:signal:read',
    'trust:review',
    'trust:decision',
    'trust:action',
    'product:flags:read',
    'product:flags:write',
    'product:rollout',
    'growth:read',
    'growth:manage',
    'engineering:metrics:read',
    'engineering:jobs:manage',
    'integrations:read',
    'integrations:manage',
    'finance:read',
    'finance:payout',
    'tasks:create',
    'tasks:assign',
    'tasks:transition',
    'tasks:close',
    'admin:read',
    'admin:manage',
    'governance:read',
    'governance:manage',
    'audit:read'
  ],
  deus_fundador: [ // Backwards compatibility alias
    'users:read',
    'users:update',
    'users:block',
    'trust:signal:read',
    'trust:review',
    'trust:decision',
    'trust:action',
    'product:flags:read',
    'product:flags:write',
    'product:rollout',
    'growth:read',
    'growth:manage',
    'engineering:metrics:read',
    'engineering:jobs:manage',
    'integrations:read',
    'integrations:manage',
    'finance:read',
    'finance:payout',
    'tasks:create',
    'tasks:assign',
    'tasks:transition',
    'tasks:close',
    'admin:read',
    'admin:manage',
    'governance:read',
    'governance:manage',
    'audit:read'
  ],
  super_admin: [
    'users:read',
    'users:update',
    'users:block',
    'trust:signal:read',
    'trust:review',
    'trust:decision',
    'trust:action',
    'product:flags:read',
    'product:flags:write',
    'product:rollout',
    'growth:read',
    'engineering:metrics:read',
    'integrations:read',
    'finance:read',
    'tasks:create',
    'tasks:assign',
    'tasks:transition',
    'tasks:close',
    'admin:read',
    'governance:read',
    'audit:read'
  ],
  moderator: [
    'users:read',
    'users:block',
    'trust:signal:read',
    'trust:review',
    'trust:decision',
    'trust:action',
    'tasks:create',
    'tasks:transition',
    'audit:read'
  ],
  moderador: [ // Backwards compatibility alias
    'users:read',
    'users:block',
    'trust:signal:read',
    'trust:review',
    'trust:decision',
    'trust:action',
    'tasks:create',
    'tasks:transition',
    'audit:read'
  ],
  support: [
    'users:read',
    'trust:signal:read',
    'tasks:create',
    'tasks:transition'
  ],
  engineer: [
    'engineering:metrics:read',
    'engineering:jobs:manage',
    'integrations:read',
    'product:flags:read',
    'product:flags:write',
    'tasks:create',
    'tasks:transition',
    'audit:read'
  ],
  finance_lead: [
    'finance:read',
    'finance:payout',
    'integrations:read',
    'tasks:create',
    'tasks:transition',
    'audit:read'
  ]
};

export interface AuthorizationPolicyContext {
  admin: AdminUser;
  action: AdminPermission;
  resource?: {
    type: string;
    id?: string;
    state?: unknown;
    ownerId?: string;
    countryCode?: string;
  };
}

export interface RbacConstraintRule {
  id: string;
  name: string;
  description: string;
  evaluate: (ctx: AuthorizationPolicyContext) => boolean;
}

const DEFAULT_CONSTRAINTS: RbacConstraintRule[] = [
  {
    id: 'c_no_self_deletion',
    name: 'Proibição de Auto-Mutação Destrutiva',
    description: 'Um administrador não pode revogar ou excluir sua própria conta.',
    evaluate: (ctx) => {
      if (ctx.resource?.type === 'admin_user' && ctx.resource?.id === ctx.admin.id && ctx.action === 'admin:manage') {
        return false;
      }
      return true;
    }
  },
  {
    id: 'c_closed_task_freeze',
    name: 'Imutabilidade de Tarefas Fechadas',
    description: 'Apenas Founder ou Super Admin podem reabrir tarefas fechadas.',
    evaluate: (ctx) => {
      if (ctx.resource?.type === 'admin_task' && ctx.resource?.state === 'CLOSED' && ctx.action === 'tasks:transition') {
        const role = ctx.admin.role;
        return role === 'founder' || role === 'deus_fundador' || role === 'super_admin';
      }
      return true;
    }
  }
];

/**
 * 2.2: Authorization Policy Engine
 * Flow: Role -> Permissions -> Policy -> Resource -> Action
 */
export class RbacService {
  private static instance: RbacService;

  public static getInstance(): RbacService {
    if (!RbacService.instance) {
      RbacService.instance = new RbacService();
    }
    return RbacService.instance;
  }

  /**
   * Normalizes role alias
   */
  public normalizeRole(role: AdminRole): AdminRole {
    if (role === 'deus_fundador') return 'founder';
    if (role === 'moderador') return 'moderator';
    return role;
  }

  /**
   * Gets effective permissions for a user (base role permissions + custom additions)
   */
  public getEffectivePermissions(admin: AdminUser): AdminPermission[] {
    if (!admin || admin.status === 'inactive') return [];

    const roleKey = admin.role;
    const basePermissions = ROLE_PERMISSIONS_MAP[roleKey] || [];
    const customPermissions = admin.customPermissions || [];

    return Array.from(new Set([...basePermissions, ...customPermissions]));
  }

  /**
   * Evaluates if admin has the requested permission under current policies and resource conditions
   */
  public can(
    admin: AdminUser,
    action: AdminPermission,
    resource?: {
      type: string;
      id?: string;
      state?: unknown;
      ownerId?: string;
    }
  ): boolean {
    if (!admin || admin.status === 'inactive') return false;

    // 1. Check permissions
    const permissions = this.getEffectivePermissions(admin);
    if (!permissions.includes(action)) {
      return false;
    }

    // 2. ABAC & Resource-level policy checks
    const ctx: AuthorizationPolicyContext = {
      admin,
      action,
      resource
    };

    for (const constraint of DEFAULT_CONSTRAINTS) {
      if (!constraint.evaluate(ctx)) {
        return false;
      }
    }

    if (resource) {
      // Policy: Closed task condition (cannot transition task if already closed without founder/super_admin)
      if (
        resource.type === 'admin_task' &&
        resource.state === 'CLOSED' &&
        action === 'tasks:transition'
      ) {
        const normalizedRole = this.normalizeRole(admin.role);
        return normalizedRole === 'founder' || normalizedRole === 'super_admin';
      }
    }

    return true;
  }

  /**
   * Checks if user has a specific minimum role
   */
  public hasRole(admin: AdminUser, requiredRole: AdminRole): boolean {
    if (!admin || admin.status === 'inactive') return false;
    const userRole = this.normalizeRole(admin.role);
    const targetRole = this.normalizeRole(requiredRole);

    if (userRole === targetRole) return true;
    if (userRole === 'founder') return true;
    if (userRole === 'super_admin' && targetRole !== 'founder') return true;
    return false;
  }
}
