import {
  db,
  doc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  limit,
  orderBy,
  serverTimestamp
} from '../firebase/config';
import {
  MCRFunnelStage,
  CPLPCountryCode,
  DiscoveryOriginTag,
  McrAuditEvent,
  McrAuditTrail,
  McrEventPayload,
  McrAuditQueryFilters,
  MCRMetrics,
  MCRDiagnosticBottleneck
} from '../types';
import { authService } from './authService';

/**
 * 8-Stage Canonical MCR Hierarchy
 * IMPRESSION (1) → QUALIFIED_DISCOVERY (2) → INTENTIONAL_INTEREST (3) → MUTUAL_INTEREST (4) →
 * CONVERSATION_STARTED (5) → MEANINGFUL_RECIPROCITY (6) → CONTINUITY (7) → MEANINGFUL_CONNECTION (8)
 */
export const STAGE_HIERARCHY: Record<MCRFunnelStage, number> = {
  IMPRESSION: 1,
  QUALIFIED_DISCOVERY: 2,
  INTENTIONAL_INTEREST: 3,
  MUTUAL_INTEREST: 4,
  CONVERSATION_STARTED: 5,
  MEANINGFUL_RECIPROCITY: 6,
  CONTINUITY: 7,
  MEANINGFUL_CONNECTION: 8,
  // Legacy aliases mapped
  DISCOVERY: 1,
  CONVERSATION_INITIATED: 5,
  RECIPROCITY: 6
};

export interface McrRequestContext {
  ipOrOrigin?: string;
  userAgent?: string;
  environment?: string;
  sessionId?: string;
}

export class McrEventLogger {
  private static instance: McrEventLogger;

  public static getInstance(): McrEventLogger {
    if (!McrEventLogger.instance) {
      McrEventLogger.instance = new McrEventLogger();
    }
    return McrEventLogger.instance;
  }

  /**
   * Normalizes any incoming stage string to canonical 8-stage MCR representation
   */
  public normalizeStage(stage: MCRFunnelStage | string): MCRFunnelStage {
    switch (stage) {
      case 'DISCOVERY':
        return 'IMPRESSION';
      case 'CONVERSATION_INITIATED':
        return 'CONVERSATION_STARTED';
      case 'RECIPROCITY':
        return 'MEANINGFUL_RECIPROCITY';
      case 'IMPRESSION':
      case 'QUALIFIED_DISCOVERY':
      case 'INTENTIONAL_INTEREST':
      case 'MUTUAL_INTEREST':
      case 'CONVERSATION_STARTED':
      case 'MEANINGFUL_RECIPROCITY':
      case 'CONTINUITY':
      case 'MEANINGFUL_CONNECTION':
        return stage as MCRFunnelStage;
      default:
        return 'IMPRESSION';
    }
  }

  /**
   * Validates transition order and integrity along the 8-stage state machine
   */
  public evaluateTransitionIntegrity(
    currentStage: MCRFunnelStage,
    previousStage?: MCRFunnelStage | string
  ): 'VALID' | 'UNORDERED_SKIP' | 'REGRESSION' | 'INITIAL' {
    if (!previousStage) return 'INITIAL';
    const normPrev = this.normalizeStage(previousStage);
    const prevRank = STAGE_HIERARCHY[normPrev] || 1;
    const currentRank = STAGE_HIERARCHY[currentStage] || 1;

    if (currentRank < prevRank) return 'REGRESSION';
    if (currentRank - prevRank > 2) return 'UNORDERED_SKIP';
    return 'VALID';
  }

  /**
   * Persists a validated, immutable transition event in Firestore mcr_audit_events collection
   * and synchronizes with connection_events.
   */
  public async logTransitionEvent(
    payload: McrEventPayload,
    context?: McrRequestContext
  ): Promise<McrAuditEvent> {
    if (!payload.userId || !payload.targetUid) {
      throw new Error('McrEventLogger: Missing mandatory userId or targetUid');
    }

    const canonicalStage = this.normalizeStage(payload.stage);
    const stageRank = STAGE_HIERARCHY[canonicalStage] || 1;
    const now = Date.now();
    const eventId = `mcr_audit_${canonicalStage.toLowerCase()}_${now}_${Math.random().toString(36).substring(2, 9)}`;

    const origin = (
      payload.discoveryOrigin ||
      (payload.metadata?.discoveryOrigin as string) ||
      (payload.metadata?.discoveryMode as string) ||
      'VALUES_AFFINITY'
    ) as DiscoveryOriginTag;

    const countryPair: [CPLPCountryCode, CPLPCountryCode] = payload.countryPair && payload.countryPair.length === 2
      ? payload.countryPair
      : ['AO', 'PT'];

    const transitionIntegrity = this.evaluateTransitionIntegrity(canonicalStage, payload.previousStage);

    const auditTrail: McrAuditTrail = {
      loggedAt: new Date(now).toISOString(),
      timestamp: now,
      serverTimestamp: serverTimestamp(),
      clientTimestamp: payload.clientTimestamp || now,
      ipOrOrigin: context?.ipOrOrigin || 'unknown',
      userAgent: context?.userAgent || 'unknown',
      isAudited: true,
      auditSource: 'mcr_backend_logger',
      transitionIntegrity,
      stageRank,
      environment: context?.environment || process.env.NODE_ENV || 'production',
      sessionId: payload.sessionId || context?.sessionId
    };

    const auditEvent: McrAuditEvent = {
      id: eventId,
      userId: payload.userId,
      targetUid: payload.targetUid,
      stage: canonicalStage,
      previousStage: payload.previousStage,
      stageRank,
      countryPair,
      discoveryOrigin: origin,
      communityTag: payload.communityTag,
      metadata: {
        ...(payload.metadata || {}),
        discoveryOrigin: origin,
        stageRank
      },
      audit: auditTrail,
      timestamp: now,
      createdAt: now
    };

    // 1. Primary Immutable Audit Write: /mcr_audit_events/{eventId}
    try {
      await setDoc(doc(db, 'mcr_audit_events', eventId), {
        ...auditEvent,
        serverTimestamp: serverTimestamp()
      });
    } catch (err) {
      console.warn('McrEventLogger: Firestore mcr_audit_events persistence failed:', err);
    }

    // 2. Mirroring Write: /connection_events/{eventId} for real-time connection graph sync
    try {
      await setDoc(doc(db, 'connection_events', eventId), {
        id: eventId,
        userId: auditEvent.userId,
        targetUid: auditEvent.targetUid,
        stage: auditEvent.stage,
        countryPair: auditEvent.countryPair,
        communityTag: auditEvent.communityTag,
        discoveryOrigin: auditEvent.discoveryOrigin,
        metadata: auditEvent.metadata,
        timestamp: auditEvent.timestamp,
        serverTimestamp: serverTimestamp()
      });
    } catch (err) {
      console.warn('McrEventLogger: Firestore connection_events mirror failed:', err);
    }

    return auditEvent;
  }

  /**
   * Logs a batch of transition events
   */
  public async logBatchEvents(
    payloads: McrEventPayload[],
    context?: McrRequestContext
  ): Promise<McrAuditEvent[]> {
    const results: McrAuditEvent[] = [];
    for (const payload of payloads) {
      try {
        const logged = await this.logTransitionEvent(payload, context);
        results.push(logged);
      } catch (e) {
        console.error('McrEventLogger: Batch item failure:', e);
      }
    }
    return results;
  }

  /**
   * Queries audited transition documents from Firestore mcr_audit_events
   */
  public async queryAuditEvents(filters?: McrAuditQueryFilters): Promise<McrAuditEvent[]> {
    try {
      const maxLimit = Math.min(filters?.limitCount || 100, 500);
      let q = query(
        collection(db, 'mcr_audit_events'),
        limit(maxLimit)
      );

      if (filters?.userId) {
        q = query(
          collection(db, 'mcr_audit_events'),
          where('userId', '==', filters.userId),
          limit(maxLimit)
        );
      } else if (filters?.stage) {
        const canonical = this.normalizeStage(filters.stage);
        q = query(
          collection(db, 'mcr_audit_events'),
          where('stage', '==', canonical),
          limit(maxLimit)
        );
      }

      const snap = await getDocs(q);
      const events: McrAuditEvent[] = [];

      snap.forEach(docSnap => {
        const data = docSnap.data() as McrAuditEvent;
        events.push({
          ...data,
          id: data.id || docSnap.id
        });
      });

      // Filter by timeframe and origin in memory if query was broad
      let filtered = events;
      if (filters?.timeframe && filters.timeframe !== 'all') {
        const cutoff = Date.now() - (filters.timeframe === '7d' ? 7 * 86400000 : 30 * 86400000);
        filtered = filtered.filter(e => e.timestamp >= cutoff);
      }

      if (filters?.origin) {
        filtered = filtered.filter(e => (e.discoveryOrigin || '').toUpperCase() === filters.origin?.toUpperCase());
      }

      return filtered.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      console.warn('McrEventLogger: Query audit events fallback:', error);
      return [];
    }
  }

  /**
   * Computes MCR metrics directly from audited Firestore records
   */
  public async calculateAuditMetrics(
    timeframe: '7d' | '30d' | 'all' = '7d',
    originFilter?: string
  ): Promise<{
    totalAuditedEvents: number;
    uniquePairs: number;
    stageCounts: Record<MCRFunnelStage, number>;
    mcrRatePercent: number;
  }> {
    const events = await this.queryAuditEvents({ timeframe, origin: originFilter, limitCount: 500 });
    const stageCounts: Record<MCRFunnelStage, number> = {
      IMPRESSION: 0,
      QUALIFIED_DISCOVERY: 0,
      INTENTIONAL_INTEREST: 0,
      MUTUAL_INTEREST: 0,
      CONVERSATION_STARTED: 0,
      MEANINGFUL_RECIPROCITY: 0,
      CONTINUITY: 0,
      MEANINGFUL_CONNECTION: 0,
      DISCOVERY: 0,
      CONVERSATION_INITIATED: 0,
      RECIPROCITY: 0
    };

    const uniquePairs = new Set<string>();

    for (const e of events) {
      const canonical = this.normalizeStage(e.stage);
      stageCounts[canonical] = (stageCounts[canonical] || 0) + 1;
      uniquePairs.add([e.userId, e.targetUid].sort().join(':'));
    }

    const impressions = stageCounts.IMPRESSION || 1;
    const meaningful = stageCounts.MEANINGFUL_CONNECTION || 0;
    const mcrRatePercent = Math.round(((meaningful / impressions) * 100) * 10) / 10;

    return {
      totalAuditedEvents: events.length,
      uniquePairs: uniquePairs.size,
      stageCounts,
      mcrRatePercent
    };
  }
}

export const mcrEventLogger = McrEventLogger.getInstance();

/**
 * Client helper to dispatch MCR transition events through backend API or fallback to Firestore
 */
export async function logMcrTransition(payload: McrEventPayload): Promise<McrAuditEvent | null> {
  // Try sending to backend API first for server-side audit enrichment
  if (typeof window !== 'undefined') {
    try {
      const headers = await authService.getAuthHeaders();
      const res = await fetch('/api/mcr/events', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        return data.event as McrAuditEvent;
      }
    } catch (e) {
      // Backend not reached or offline - fallback to local McrEventLogger Firestore directly
    }
  }

  // Direct Firestore persistence fallback
  try {
    return await mcrEventLogger.logTransitionEvent(payload, {
      environment: 'client_fallback',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'node'
    });
  } catch (err) {
    console.warn('Direct McrEventLogger fallback error:', err);
    return null;
  }
}
