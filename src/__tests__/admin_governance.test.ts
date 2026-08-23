import { describe, it, expect } from 'vitest';
import { RbacService } from '../services/admin/rbacService';
import { TrustService } from '../services/admin/trustService';
import { TaskService } from '../services/admin/taskService';
import { ProductService } from '../services/admin/productService';
import { AuditService } from '../services/admin/auditService';
import { AdminUser } from '../types';

describe('Admin Governance & Control Architecture', () => {
  const founderUser: AdminUser = {
    id: 'usr_founder_1',
    displayName: 'Sila Marco',
    email: 'silamarco217@gmail.com',
    role: 'founder',
    pin: '889900',
    status: 'active',
    createdAt: Date.now()
  };

  const moderatorUser: AdminUser = {
    id: 'usr_mod_1',
    displayName: 'Moderador CPLP',
    email: 'mod@en.com',
    role: 'moderator',
    pin: '123456',
    status: 'active',
    createdAt: Date.now()
  };

  const supportUser: AdminUser = {
    id: 'usr_sup_1',
    displayName: 'Suporte CPLP',
    email: 'support@en.com',
    role: 'support',
    pin: '654321',
    status: 'active',
    createdAt: Date.now()
  };

  it('2.1 & 2.2: Evaluates RBAC permissions formally (Role -> Permissions -> Policy -> Resource -> Action)', () => {
    const rbac = RbacService.getInstance();

    // Founder has formal permission check
    expect(rbac.can(founderUser, 'admin:manage')).toBe(true);
    expect(rbac.can(founderUser, 'trust:decision')).toBe(true);

    // Moderator has trust permissions but cannot manage admins or finance
    expect(rbac.can(moderatorUser, 'trust:decision')).toBe(true);
    expect(rbac.can(moderatorUser, 'admin:manage')).toBe(false);
    expect(rbac.can(moderatorUser, 'finance:payout')).toBe(false);

    // Support cannot deliberate trust decisions
    expect(rbac.can(supportUser, 'trust:decision')).toBe(false);
    expect(rbac.can(supportUser, 'trust:signal:read')).toBe(true);
  });

  it('2.4 & 2.5: Implements Trust 6-Stage Lifecycle & Reports do NOT automatically ban', () => {
    const trustService = TrustService.getInstance();

    // Ingest Signal -> generates Detection and Review in queue
    const { signal, review } = trustService.ingestSignal({
      type: 'user_report',
      targetUid: 'suspect_user_99',
      reporterUid: 'reporter_1',
      category: 'fake_profile',
      description: 'Perfil suspeito com fotos incoerentes'
    });

    expect(signal.id).toBeDefined();
    expect(review.status).toBe('pending');
    expect(review.detection).toBeDefined();
    expect(review.detection?.ruleMatches.length).toBeGreaterThan(0);

    // Verify user is NOT banned immediately upon report
    expect(review.status).not.toBe('resolved');

    // Deliberate Review -> Decision -> Action -> Audit
    const decResult = trustService.makeDecision(
      review.id,
      {
        outcome: 'require_verification',
        justification: 'Exigida validação de documento CPLP'
      },
      moderatorUser
    );

    expect(decResult.success).toBe(true);
  });

  it('2.10 & 2.11: Enforces explicit Task lifecycle (OPEN -> ASSIGNED -> IN_PROGRESS -> RESOLVED -> CLOSED)', () => {
    const taskService = TaskService.getInstance();

    const created = taskService.createTask(
      {
        title: 'Auditar lote de fotos de perfil',
        description: 'Verificação em massa de 50 perfis',
        category: 'trust',
        priority: 'high'
      },
      moderatorUser
    );

    expect(created.success).toBe(true);
    const taskId = created.task!.id;
    expect(created.task!.state).toBe('OPEN');

    // Invalid jump: OPEN directly to RESOLVED should fail
    const invalidJump = taskService.transitionState(taskId, 'RESOLVED', moderatorUser);
    expect(invalidJump.success).toBe(false);

    // Valid progression: OPEN -> ASSIGNED
    const step1 = taskService.transitionState(taskId, 'ASSIGNED', moderatorUser, {
      assigneeId: moderatorUser.id,
      assigneeName: moderatorUser.displayName
    });
    expect(step1.success).toBe(true);

    // ASSIGNED -> IN_PROGRESS
    const step2 = taskService.transitionState(taskId, 'IN_PROGRESS', moderatorUser);
    expect(step2.success).toBe(true);

    // IN_PROGRESS -> RESOLVED
    const step3 = taskService.transitionState(taskId, 'RESOLVED', moderatorUser);
    expect(step3.success).toBe(true);

    // RESOLVED -> CLOSED
    const step4 = taskService.transitionState(taskId, 'CLOSED', moderatorUser);
    expect(step4.success).toBe(true);
  });

  it('2.6 & 2.14: Product flags evaluation and structured Audit logging', () => {
    const productService = ProductService.getInstance();
    const auditService = AuditService.getInstance();

    // Feature enabled check without coupling
    const isAiEnabled = productService.isFeatureEnabled('ai_bio_enhancer', {
      countryCode: 'PT',
      isVerified: true
    });
    expect(typeof isAiEnabled).toBe('boolean');

    // Audit logs inspection
    const logs = auditService.getLogs();
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].actorRole).toBeDefined();
    expect(logs[0].timestamp).toBeGreaterThan(0);
  });
});
