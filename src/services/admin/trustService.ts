import {
  TrustSignal,
  TrustDetection,
  TrustReview,
  TrustDecision,
  TrustActionExecution,
  TrustSeverity,
  AdminUser,
  TrustDecisionOutcome
} from '../../types';
import { AuditService } from './auditService';
import { RbacService } from './rbacService';

const TRUST_STORAGE_KEY = 'en_trust_reviews_v1';

export class TrustService {
  private static instance: TrustService;
  private reviews: TrustReview[] = [];
  private decisions: TrustDecision[] = [];
  private actions: TrustActionExecution[] = [];

  private constructor() {
    this.bootstrapMockData();
  }

  public static getInstance(): TrustService {
    if (!TrustService.instance) {
      TrustService.instance = new TrustService();
    }
    return TrustService.instance;
  }

  private bootstrapMockData(): void {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(TRUST_STORAGE_KEY);
        if (stored) {
          this.reviews = JSON.parse(stored);
          return;
        }
      } catch {}
    }

    // Default seeded moderation queue (Signal -> Detection -> Review)
    this.reviews = [
      {
        id: 'rev_101',
        signalId: 'sig_101',
        targetUid: 'user_suspicious_1',
        reporterUid: 'user_reporter_44',
        category: 'fake_profile',
        description: 'Uso de fotos públicas de catálogo e localização inconsistente.',
        severity: 'medium',
        status: 'pending',
        detection: {
          signalId: 'sig_101',
          severity: 'medium',
          score: 0.68,
          ruleMatches: ['HEURISTIC_STOCK_IMAGE_SUSPECT', 'DISCORDANT_GEO_IP'],
          suggestedAction: 'require_verification',
          detectedAt: Date.now() - 7200000
        },
        createdAt: Date.now() - 7200000,
        updatedAt: Date.now() - 7200000
      },
      {
        id: 'rev_102',
        signalId: 'sig_102',
        targetUid: 'user_toxic_2',
        reporterUid: 'user_reporter_12',
        category: 'harassment',
        description: 'Linguagem hostil e desrespeitosa durante o primeiro contacto no chat.',
        severity: 'high',
        status: 'in_review',
        assignedModeratorId: 'admin_mod_1',
        assignedModeratorName: 'Moderador CPLP',
        detection: {
          signalId: 'sig_102',
          severity: 'high',
          score: 0.85,
          ruleMatches: ['CHAT_PROFANITY_TRIGGER', 'RAPID_UNSOLICITED_MESSAGES'],
          suggestedAction: 'temporary_restriction',
          detectedAt: Date.now() - 3600000
        },
        createdAt: Date.now() - 3600000,
        updatedAt: Date.now() - 1800000
      }
    ];
  }

  private saveState(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(TRUST_STORAGE_KEY, JSON.stringify(this.reviews));
    } catch {}
  }

  /**
   * Stage 1 & 2: Ingest Signal & Compute Detection
   * (Does NOT automatically ban; creates Review in queue)
   */
  public ingestSignal(
    signal: Omit<TrustSignal, 'id' | 'createdAt'>
  ): { signal: TrustSignal; review: TrustReview } {
    const fullSignal: TrustSignal = {
      ...signal,
      id: `sig_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      createdAt: Date.now()
    };

    // Compute heuristic detection
    const detection: TrustDetection = this.computeDetection(fullSignal);

    const review: TrustReview = {
      id: `rev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      signalId: fullSignal.id,
      targetUid: fullSignal.targetUid,
      reporterUid: fullSignal.reporterUid,
      category: fullSignal.category,
      description: fullSignal.description,
      severity: detection.severity,
      status: 'pending',
      detection,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this.reviews.unshift(review);
    this.saveState();
    return { signal: fullSignal, review };
  }

  private computeDetection(signal: TrustSignal): TrustDetection {
    let score = 0.3;
    const ruleMatches: string[] = ['REPORT_INGESTED'];
    let severity: TrustSeverity = 'low';

    if (signal.category === 'harassment' || signal.category === 'underage') {
      score += 0.4;
      severity = 'high';
      ruleMatches.push('HIGH_RISK_CATEGORY');
    } else if (signal.category === 'fake_profile' || signal.category === 'spam') {
      score += 0.25;
      severity = 'medium';
      ruleMatches.push('IDENTITY_SAFETY_HEURISTIC');
    }

    if (signal.evidence && signal.evidence.length > 0) {
      score += 0.15;
      ruleMatches.push('EVIDENCE_ATTACHED');
    }

    let suggestedAction: TrustDecisionOutcome = 'dismiss';
    if (score >= 0.75) suggestedAction = 'temporary_restriction';
    else if (score >= 0.5) suggestedAction = 'require_verification';
    else suggestedAction = 'warning';

    return {
      signalId: signal.id,
      severity,
      score: Math.min(score, 0.99),
      ruleMatches,
      suggestedAction,
      detectedAt: Date.now()
    };
  }

  /**
   * Stage 3: Assign / Review
   */
  public assignReview(reviewId: string, moderator: AdminUser): boolean {
    const rbac = RbacService.getInstance();
    if (!rbac.can(moderator, 'trust:review')) {
      return false;
    }

    const item = this.reviews.find(r => r.id === reviewId);
    if (!item) return false;

    item.status = 'in_review';
    item.assignedModeratorId = moderator.id;
    item.assignedModeratorName = moderator.displayName || moderator.name || moderator.email;
    item.updatedAt = Date.now();
    this.saveState();
    return true;
  }

  /**
   * Stage 4 & 5 & 6: Decision -> Action -> Audit
   */
  public makeDecision(
    reviewId: string,
    decision: {
      outcome: TrustDecisionOutcome;
      justification: string;
      expiryTimestamp?: number;
    },
    decider: AdminUser
  ): { success: boolean; error?: string } {
    const rbac = RbacService.getInstance();
    if (!rbac.can(decider, 'trust:decision')) {
      return { success: false, error: 'Permissão insuficiente para deliberar decisões de Trust.' };
    }

    const review = this.reviews.find(r => r.id === reviewId);
    if (!review) {
      return { success: false, error: 'Revisão de moderação não encontrada.' };
    }

    const decisionRecord: TrustDecision = {
      id: `dec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      reviewId: review.id,
      targetUid: review.targetUid,
      outcome: decision.outcome,
      justification: decision.justification,
      decidedBy: decider.id,
      decidedByRole: decider.role,
      decidedAt: Date.now(),
      expiryTimestamp: decision.expiryTimestamp
    };
    this.decisions.push(decisionRecord);

    // Apply Action
    const actionRecord: TrustActionExecution = {
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      decisionId: decisionRecord.id,
      targetUid: review.targetUid,
      actionTaken: `APPLY_${decision.outcome.toUpperCase()}`,
      executedBy: decider.id,
      executedAt: Date.now(),
      status: 'applied'
    };
    this.actions.push(actionRecord);

    // Update review status
    review.status = 'resolved';
    review.updatedAt = Date.now();
    this.saveState();

    // Audit Log
    AuditService.getInstance().logMutation(decider, {
      module: 'trust',
      resourceType: 'user_profile',
      resourceId: review.targetUid,
      action: `TRUST_DECISION_${decision.outcome.toUpperCase()}`,
      previousState: { reviewStatus: 'in_review' },
      newState: { reviewStatus: 'resolved', decision: decision.outcome },
      justification: decision.justification
    });

    return { success: true };
  }

  public getReviews(filter?: { status?: TrustReview['status']; severity?: TrustSeverity }): TrustReview[] {
    let list = [...this.reviews];
    if (filter?.status) {
      list = list.filter(r => r.status === filter.status);
    }
    if (filter?.severity) {
      list = list.filter(r => r.severity === filter.severity);
    }
    return list;
  }
}
