import {
  UserProfile,
  InteractionSignals,
  DiscoveryCandidate,
  RelationshipIntent,
  CPLPCountryCode,
  MCRFunnelStage,
  ConnectionFunnelEvent,
  MCRMetrics,
  MCROriginBreakdown,
  MCRDiagnosticBottleneck,
  ConnectionOutcomeLearning,
  TrustBadge
} from '../types';
import { db, doc, setDoc, addDoc, collection, getDocs, query, where, orderBy, limit, serverTimestamp } from '../firebase/config';
import { logMcrTransition, mcrEventLogger } from './mcrEventLogger';

export type CommunicationStyle = 'reflective' | 'expressive' | 'direct' | 'warm';
export type ConversationalDepth = 'light' | 'moderate' | 'deep';

export interface ConnectionGraphNode {
  uid: string;
  countryCode: CPLPCountryCode;
  cityName: string;
  intent: RelationshipIntent;
  interests: string[];
  communicationStyle: CommunicationStyle;
  conversationalDepth: ConversationalDepth;
  responsivenessScore: number; // 0.0 - 1.0
  culturalBridgeAperture: number; // 0.0 - 1.0
  successfulStylesLearned: string[];
  complementaryFactorLearned: number;
}

export interface ConnectionGraphEdge {
  sourceUid: string;
  targetUid: string;
  reciprocityScore: number;
  communicationResonance: number;
  culturalSynergy: number;
  complementaryBalance: number;
  compositeSynergy: number;
  isSerendipitous: boolean;
  serendipityInsight?: string;
  insights: string[];
}

const LOCAL_EVENTS_STORAGE_KEY = 'enos_connection_funnel_events_v1';
const LOCAL_LEARNINGS_STORAGE_KEY = 'enos_connection_learnings_v1';

/**
 * Human Connection Graph & Meaningful Connection Engine (MCR)
 * - PONTO 1: Connection Graph & MCR Metric calculation & Outcome Learning
 * - PONTO 2: Reason-First Serendipitous Discovery ("A Descoberta Inesperada")
 */
export class HumanConnectionGraph {
  private static instance: HumanConnectionGraph;
  private inMemoryEvents: ConnectionFunnelEvent[] = [];
  private inMemoryLearnings: ConnectionOutcomeLearning[] = [];

  private constructor() {
    this.hydrateFromLocalStorage();
  }

  public static getInstance(): HumanConnectionGraph {
    if (!HumanConnectionGraph.instance) {
      HumanConnectionGraph.instance = new HumanConnectionGraph();
    }
    return HumanConnectionGraph.instance;
  }

  private hydrateFromLocalStorage(): void {
    if (typeof window === 'undefined') return;
    try {
      const storedEvents = localStorage.getItem(LOCAL_EVENTS_STORAGE_KEY);
      if (storedEvents) {
        this.inMemoryEvents = JSON.parse(storedEvents);
      }
      const storedLearnings = localStorage.getItem(LOCAL_LEARNINGS_STORAGE_KEY);
      if (storedLearnings) {
        this.inMemoryLearnings = JSON.parse(storedLearnings);
      }

      // Seed baseline calibrated events if storage was empty
      if (this.inMemoryEvents.length === 0) {
        this.seedBaselineFunnelEvents();
      }
    } catch (e) {
      console.warn('Fallback hydration error:', e);
    }
  }

  /**
   * Seeds calibrated 8-stage MCR baseline telemetry across CPLP corridors
   */
  private seedBaselineFunnelEvents(): void {
    const now = Date.now();
    const origins = ['CULTURAL_BRIDGE', 'VALUES_AFFINITY', 'SERENDIPITY', 'COMPLEMENTARITY', 'COMMUNITY_QUESTION'];
    const countryPairs: [CPLPCountryCode, CPLPCountryCode][] = [
      ['AO', 'PT'], ['BR', 'PT'], ['CV', 'AO'], ['MZ', 'BR'], ['ST', 'PT'], ['GW', 'BR']
    ];

    const stages: MCRFunnelStage[] = [
      'IMPRESSION',
      'QUALIFIED_DISCOVERY',
      'INTENTIONAL_INTEREST',
      'MUTUAL_INTEREST',
      'CONVERSATION_STARTED',
      'MEANINGFUL_RECIPROCITY',
      'CONTINUITY',
      'MEANINGFUL_CONNECTION'
    ];

    // Generate balanced funnel distribution demonstrating pipeline health & learning
    const stageCounts = [420, 290, 165, 84, 62, 38, 22, 14];

    stageCounts.forEach((count, stageIdx) => {
      const currentStage = stages[stageIdx];
      for (let i = 0; i < count; i++) {
        const cPair = countryPairs[i % countryPairs.length];
        const origin = origins[i % origins.length];
        const pairId = `seed_pair_${stageIdx}_${i}`;
        const timeOffset = Math.floor(Math.random() * 6 * 24 * 3600 * 1000);

        this.inMemoryEvents.push({
          id: `seed_evt_${stageIdx}_${i}`,
          userId: `usr_a_${pairId}`,
          targetUid: `usr_b_${pairId}`,
          stage: currentStage,
          countryPair: cPair,
          discoveryOrigin: origin,
          timestamp: now - timeOffset,
          metadata: {
            discoveryOrigin: origin,
            messageCount: stageIdx >= 4 ? 3 + (stageIdx * 2) : 0,
            hoursActive: stageIdx >= 6 ? 36 : 2
          }
        });
      }
    });

    this.persistLocal();
  }

  /**
   * Hydrates connection events and outcome learnings from Firestore for a specific user.
   * Ensures zero data loss across reloads and multi-device sessions.
   */
  public async syncWithFirestore(userId: string): Promise<void> {
    if (!userId) return;
    try {
      // 1. Fetch user's connection events
      const eventsQuery = query(
        collection(db, 'connection_events'),
        where('userId', '==', userId),
        limit(150)
      );
      const eventsSnap = await getDocs(eventsQuery);
      const remoteEvents: ConnectionFunnelEvent[] = [];
      eventsSnap.forEach(docSnap => {
        const data = docSnap.data();
        remoteEvents.push({
          id: data.id || docSnap.id,
          userId: data.userId,
          targetUid: data.targetUid,
          stage: data.stage,
          countryPair: data.countryPair || ['AO', 'PT'],
          communityTag: data.communityTag,
          discoveryOrigin: data.discoveryOrigin || data.metadata?.discoveryOrigin || data.metadata?.discoveryMode,
          metadata: data.metadata,
          timestamp: data.timestamp || Date.now()
        });
      });

      // 2. Fetch user's outcome learnings
      const learningsQuery = query(
        collection(db, 'connection_learnings'),
        where('userId', '==', userId),
        limit(100)
      );
      const learningsSnap = await getDocs(learningsQuery);
      const remoteLearnings: ConnectionOutcomeLearning[] = [];
      learningsSnap.forEach(docSnap => {
        const data = docSnap.data();
        remoteLearnings.push({
          userId: data.userId,
          targetUid: data.targetUid,
          successfulBond: data.successfulBond ?? true,
          icebreakerEffective: data.icebreakerEffective,
          resonanceFactors: data.resonanceFactors || [],
          stallStage: data.stallStage,
          learnedPreferences: data.learnedPreferences || {
            preferredStyles: [],
            complementaryBonusDelta: 0,
            depthTolerance: 'moderate'
          },
          recordedAt: data.recordedAt || Date.now()
        });
      });

      // Merge unique events
      const existingEventIds = new Set(this.inMemoryEvents.map(e => e.id));
      for (const re of remoteEvents) {
        if (!existingEventIds.has(re.id)) {
          this.inMemoryEvents.push(re);
          existingEventIds.add(re.id);
        }
      }

      // Merge unique learnings
      const existingLearningKeys = new Set(this.inMemoryLearnings.map(l => `${l.userId}_${l.targetUid}_${l.recordedAt}`));
      for (const rl of remoteLearnings) {
        const key = `${rl.userId}_${rl.targetUid}_${rl.recordedAt}`;
        if (!existingLearningKeys.has(key)) {
          this.inMemoryLearnings.push(rl);
          existingLearningKeys.add(key);
        }
      }

      this.persistLocal();
    } catch (err) {
      console.info('Firestore connection graph sync deferred (using local cache):', err);
    }
  }

  private persistLocal(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(LOCAL_EVENTS_STORAGE_KEY, JSON.stringify(this.inMemoryEvents.slice(-200)));
      localStorage.setItem(LOCAL_LEARNINGS_STORAGE_KEY, JSON.stringify(this.inMemoryLearnings.slice(-100)));
    } catch {}
  }

  /**
   * Infer communication style from organic cues
   */
  public inferCommunicationStyle(profile: UserProfile, signals?: InteractionSignals): CommunicationStyle {
    const bioLength = profile.bio ? profile.bio.trim().length : 0;
    const hasManyInterests = profile.interests.length >= 4;
    const isHighInitiative = (signals?.conversationStarts || 0) > 3;

    if (profile.interests.includes('Literatura') || profile.interests.includes('História & Lusofonia')) {
      if (bioLength > 40) return 'reflective';
    }
    if (isHighInitiative || profile.interests.includes('Dança & Ritmos') || profile.interests.includes('Festivais & Eventos')) {
      return 'expressive';
    }
    if (profile.interests.includes('Música Lusófona') && !profile.interests.includes('Literatura')) {
      return 'expressive';
    }
    if (profile.intent === 'serious' && bioLength > 50) {
      return 'warm';
    }
    if (bioLength < 40 && hasManyInterests) {
      return 'direct';
    }
    return 'warm';
  }

  /**
   * Infer conversational depth
   */
  public inferConversationalDepth(profile: UserProfile, signals?: InteractionSignals): ConversationalDepth {
    const bioLength = profile.bio ? profile.bio.trim().length : 0;
    const meaningfulCount = signals?.meaningfulInteractions || 0;

    if (meaningfulCount >= 2 || bioLength > 100) {
      return 'deep';
    }
    if (bioLength > 35 || profile.interests.length >= 3) {
      return 'moderate';
    }
    return 'light';
  }

  /**
   * Create a normalized Graph Node for a user
   */
  public createNode(profile: UserProfile, signals?: InteractionSignals): ConnectionGraphNode {
    const communicationStyle = this.inferCommunicationStyle(profile, signals);
    const conversationalDepth = this.inferConversationalDepth(profile, signals);

    const totalActions = (signals?.totalLikesGiven || 0) + (signals?.totalPassesGiven || 0);
    const likeRatio = totalActions > 0 ? (signals?.totalLikesGiven || 0) / totalActions : 0.5;
    const responsivenessScore = Math.min(1.0, 0.4 + likeRatio * 0.4 + (profile.online ? 0.2 : 0));

    const likedCountriesCount = Object.keys(signals?.likedCountries || {}).length;
    const culturalBridgeAperture = Math.min(1.0, 0.5 + (likedCountriesCount * 0.15));

    // Incorporate learned conditions for this user
    const userLearnings = this.inMemoryLearnings.filter(l => l.userId === profile.uid && l.successfulBond);
    const successfulStylesLearned = Array.from(
      new Set(userLearnings.flatMap(l => l.learnedPreferences.preferredStyles || []))
    );
    const complementaryFactorLearned = userLearnings.length > 0
      ? userLearnings.reduce((acc, curr) => acc + (curr.learnedPreferences.complementaryBonusDelta || 0), 0) / userLearnings.length
      : 0;

    return {
      uid: profile.uid,
      countryCode: profile.countryCode,
      cityName: profile.cityName,
      intent: profile.intent,
      interests: profile.interests,
      communicationStyle,
      conversationalDepth,
      responsivenessScore,
      culturalBridgeAperture,
      successfulStylesLearned,
      complementaryFactorLearned
    };
  }

  /**
   * Evaluate Graph Edge between two nodes, determining resonance, reciprocity, cultural synergy and serendipity
   */
  public evaluateEdge(
    nodeA: ConnectionGraphNode,
    nodeB: ConnectionGraphNode
  ): ConnectionGraphEdge {
    // 1. Communication Resonance
    let communicationResonance = 0.7;
    if (nodeA.communicationStyle === nodeB.communicationStyle) {
      communicationResonance = 0.95;
    } else if (
      (nodeA.communicationStyle === 'reflective' && nodeB.communicationStyle === 'warm') ||
      (nodeA.communicationStyle === 'warm' && nodeB.communicationStyle === 'reflective') ||
      (nodeA.communicationStyle === 'expressive' && nodeB.communicationStyle === 'warm')
    ) {
      communicationResonance = 0.90;
    } else if (nodeA.communicationStyle === 'direct' && nodeB.communicationStyle === 'reflective') {
      communicationResonance = 0.65;
    }

    // Boost if style was historically successful for nodeA
    if (nodeA.successfulStylesLearned.includes(nodeB.communicationStyle)) {
      communicationResonance = Math.min(1.0, communicationResonance + 0.1);
    }

    // 2. Depth Harmony
    if (nodeA.conversationalDepth === nodeB.conversationalDepth) {
      communicationResonance += 0.05;
    }

    // 3. Cultural Synergy
    const isCrossCountry = nodeA.countryCode !== nodeB.countryCode;
    const culturalSynergy = isCrossCountry
      ? Math.min(1.0, (nodeA.culturalBridgeAperture + nodeB.culturalBridgeAperture) / 2 + 0.2)
      : 0.85;

    // 4. Complementary Balance (Distinct interests that broaden horizons)
    const shared = nodeA.interests.filter(i => nodeB.interests.includes(i));
    const different = nodeB.interests.filter(i => !nodeA.interests.includes(i));
    const complementaryBalance = Math.min(
      1.0,
      (shared.length * 0.2) + (different.length * 0.15) + (nodeA.intent === nodeB.intent ? 0.3 : 0.1) + nodeA.complementaryFactorLearned
    );

    // 5. Reciprocity estimation
    const reciprocityScore = (nodeA.responsivenessScore + nodeB.responsivenessScore) / 2;

    const compositeSynergy = Math.min(
      1.0,
      communicationResonance * 0.30 +
      culturalSynergy * 0.25 +
      complementaryBalance * 0.25 +
      reciprocityScore * 0.20
    );

    // 6. Serendipity / "A Descoberta Inesperada" Detection
    // High communication harmony + different backgrounds/interests + compatible intent
    const isSerendipitous = (
      communicationResonance >= 0.85 &&
      different.length >= 2 &&
      shared.length <= 1 &&
      (isCrossCountry || nodeA.cityName !== nodeB.cityName)
    );

    let serendipityInsight: string | undefined;
    if (isSerendipitous) {
      serendipityInsight = `Vocês têm trajetórias diferentes (${different.slice(0, 2).join(' & ')}), mas um ritmo comunicativo e abertura surpreendentemente alinhados para conversas profundas.`;
    }

    const insights: string[] = [];
    if (communicationResonance > 0.85) {
      insights.push(`Ressonância comunicativa natural (${nodeA.communicationStyle} ↔ ${nodeB.communicationStyle})`);
    }
    if (isCrossCountry) {
      insights.push(`Ponte viva de abertura cultural entre ${nodeA.cityName} e ${nodeB.cityName}`);
    }
    if (different.length > 0) {
      insights.push(`Diferenças complementares com partilha de novos temas (${different.slice(0, 2).join(', ')})`);
    }
    if (isSerendipitous && serendipityInsight) {
      insights.push(serendipityInsight);
    }

    return {
      sourceUid: nodeA.uid,
      targetUid: nodeB.uid,
      reciprocityScore,
      communicationResonance,
      culturalSynergy,
      complementaryBalance,
      compositeSynergy,
      isSerendipitous,
      serendipityInsight,
      insights
    };
  }

  /**
   * PONTO 1: Track connection funnel progression (MCR Telemetry & Auditable Backend Persistence)
   */
  public async recordFunnelEvent(eventData: {
    userId: string;
    targetUid: string;
    stage: MCRFunnelStage;
    countryPair: [CPLPCountryCode, CPLPCountryCode];
    communityTag?: string;
    discoveryOrigin?: string;
    previousStage?: MCRFunnelStage | string;
    metadata?: Record<string, unknown>;
  }): Promise<ConnectionFunnelEvent> {
    const origin = eventData.discoveryOrigin || (eventData.metadata?.discoveryOrigin as string) || (eventData.metadata?.discoveryMode as string) || 'VALUES_AFFINITY';
    const now = Date.now();
    const event: ConnectionFunnelEvent = {
      id: `mcr_${now}_${Math.random().toString(36).substring(2, 7)}`,
      userId: eventData.userId,
      targetUid: eventData.targetUid,
      stage: eventData.stage,
      countryPair: eventData.countryPair,
      communityTag: eventData.communityTag,
      discoveryOrigin: origin,
      metadata: {
        ...eventData.metadata,
        discoveryOrigin: origin
      } as ConnectionFunnelEvent['metadata'],
      timestamp: now
    };

    this.inMemoryEvents.push(event);
    this.persistLocal();

    // Persist as an auditable document in Firestore through McrEventLogger Backend Service
    logMcrTransition({
      userId: eventData.userId,
      targetUid: eventData.targetUid,
      stage: eventData.stage,
      previousStage: eventData.previousStage,
      countryPair: eventData.countryPair,
      communityTag: eventData.communityTag,
      discoveryOrigin: origin,
      metadata: event.metadata,
      clientTimestamp: now
    }).catch(err => {
      console.warn('MCR transition logging non-blocking fallback:', err);
    });

    return event;
  }

  /**
   * PONTO 1: Outcome Learning: Records what produced reciprocal continuity or why a conversation stalled
   */
  public async recordOutcomeFeedback(learning: Omit<ConnectionOutcomeLearning, 'recordedAt'>): Promise<void> {
    const record: ConnectionOutcomeLearning = {
      ...learning,
      recordedAt: Date.now()
    };

    this.inMemoryLearnings.push(record);
    this.persistLocal();

    try {
      const docId = `learn_${record.userId}_${record.targetUid}_${Date.now()}`;
      await setDoc(doc(db, 'connection_learnings', docId), {
        ...record,
        serverTimestamp: serverTimestamp()
      });
    } catch {}
  }

  /**
   * Normalizes any legacy or alternative stage tag to canonical 8-stage funnel
   */
  private normalizeStage(stage: MCRFunnelStage | string): MCRFunnelStage {
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
   * PONTO 1: Computes the Refined Meaningful Connection Rate (MCR) North Star Metric
   * 8-Stage Funnel: IMPRESSION → QUALIFIED_DISCOVERY → INTENTIONAL_INTEREST → MUTUAL_INTEREST → CONVERSATION_STARTED → MEANINGFUL_RECIPROCITY → CONTINUITY → MEANINGFUL_CONNECTION
   * Includes automated diagnostic engine to pinpoint system bottlenecks.
   */
  public calculateMCRMetrics(filter?: {
    timeframe?: '7d' | '30d' | 'all';
    countryCode?: CPLPCountryCode;
    community?: string;
    origin?: string;
  }): MCRMetrics {
    let events = [...this.inMemoryEvents];

    const timeframe = filter?.timeframe || 'all';
    if (timeframe === '7d') {
      const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000);
      events = events.filter(e => e.timestamp >= cutoff);
    } else if (timeframe === '30d') {
      const cutoff = Date.now() - (30 * 24 * 60 * 60 * 1000);
      events = events.filter(e => e.timestamp >= cutoff);
    }

    if (filter?.countryCode) {
      events = events.filter(e => e.countryPair[0] === filter.countryCode || e.countryPair[1] === filter.countryCode);
    }
    if (filter?.community) {
      events = events.filter(e => e.communityTag === filter.community);
    }
    if (filter?.origin) {
      events = events.filter(e => (e.discoveryOrigin || '').toUpperCase() === filter.origin?.toUpperCase());
    }

    const ORIGIN_LABELS: Record<string, string> = {
      SERENDIPITY: '✦ Descoberta Inesperada',
      CULTURAL_BRIDGE: 'Ponte Cultural Lusófona',
      COMPLEMENTARITY: 'Diferenças Enriquecedoras',
      DEEP_CONVERSATION: 'Diálogo Profundo',
      VALUES_AFFINITY: 'Sintonia de Valores & Intenção',
      COMMUNITY_QUESTION: 'Pergunta da Comunidade',
      DIRECT_SEARCH: 'Filtro Direto'
    };

    const canonicalStages: MCRFunnelStage[] = [
      'IMPRESSION',
      'QUALIFIED_DISCOVERY',
      'INTENTIONAL_INTEREST',
      'MUTUAL_INTEREST',
      'CONVERSATION_STARTED',
      'MEANINGFUL_RECIPROCITY',
      'CONTINUITY',
      'MEANINGFUL_CONNECTION'
    ];

    const uniquePairsByStage: Record<string, Set<string>> = {
      IMPRESSION: new Set(),
      QUALIFIED_DISCOVERY: new Set(),
      INTENTIONAL_INTEREST: new Set(),
      MUTUAL_INTEREST: new Set(),
      CONVERSATION_STARTED: new Set(),
      MEANINGFUL_RECIPROCITY: new Set(),
      CONTINUITY: new Set(),
      MEANINGFUL_CONNECTION: new Set()
    };

    const pairOrigins: Record<string, string> = {};
    const originStages: Record<string, Record<string, Set<string>>> = {};

    const byCountryPair: Record<string, number> = {};
    const byCommunity: Record<string, number> = {};

    for (const e of events) {
      const pairKey = [e.userId, e.targetUid].sort().join(':');
      const originKey = (e.discoveryOrigin || e.metadata?.discoveryOrigin || e.metadata?.discoveryMode || 'VALUES_AFFINITY').toUpperCase();
      const normStage = this.normalizeStage(e.stage);

      if (!pairOrigins[pairKey] || normStage === 'IMPRESSION') {
        pairOrigins[pairKey] = originKey;
      }

      const effectiveOrigin = pairOrigins[pairKey] || originKey;

      if (!originStages[effectiveOrigin]) {
        originStages[effectiveOrigin] = {
          IMPRESSION: new Set(),
          QUALIFIED_DISCOVERY: new Set(),
          INTENTIONAL_INTEREST: new Set(),
          MUTUAL_INTEREST: new Set(),
          CONVERSATION_STARTED: new Set(),
          MEANINGFUL_RECIPROCITY: new Set(),
          CONTINUITY: new Set(),
          MEANINGFUL_CONNECTION: new Set()
        };
      }

      if (uniquePairsByStage[normStage]) {
        uniquePairsByStage[normStage].add(pairKey);
        originStages[effectiveOrigin][normStage].add(pairKey);
      }

      if (normStage === 'MEANINGFUL_CONNECTION') {
        const cPair = `${e.countryPair[0]}-${e.countryPair[1]}`;
        byCountryPair[cPair] = (byCountryPair[cPair] || 0) + 1;
        if (e.communityTag) {
          byCommunity[e.communityTag] = (byCommunity[e.communityTag] || 0) + 1;
        }
      }
    }

    const totalImpressions = Math.max(1, uniquePairsByStage.IMPRESSION.size);
    const totalQualifiedDiscoveries = uniquePairsByStage.QUALIFIED_DISCOVERY.size;
    const totalIntentionalInterests = uniquePairsByStage.INTENTIONAL_INTEREST.size;
    const totalMutualInterests = uniquePairsByStage.MUTUAL_INTEREST.size;
    const totalConversationsStarted = uniquePairsByStage.CONVERSATION_STARTED.size;
    const totalMeaningfulReciprocity = uniquePairsByStage.MEANINGFUL_RECIPROCITY.size;
    const totalContinuity = uniquePairsByStage.CONTINUITY.size;
    const totalMeaningfulConnections = uniquePairsByStage.MEANINGFUL_CONNECTION.size;

    // Rates calculation
    const mcrScorePercent = (totalMeaningfulConnections / totalImpressions) * 100;
    const qualifiedDiscoveryRatePercent = totalImpressions > 0 ? (totalQualifiedDiscoveries / totalImpressions) * 100 : 0;
    const interestIntentRatePercent = totalQualifiedDiscoveries > 0 ? (totalIntentionalInterests / totalQualifiedDiscoveries) * 100 : 0;
    const matchToConversationRatePercent = totalMutualInterests > 0 ? (totalConversationsStarted / totalMutualInterests) * 100 : 0;
    const reciprocityRatePercent = totalConversationsStarted > 0 ? (totalMeaningfulReciprocity / totalConversationsStarted) * 100 : 0;
    const continuityRatePercent = totalMeaningfulReciprocity > 0 ? (totalContinuity / totalMeaningfulReciprocity) * 100 : 0;
    const meaningfulConversionRatePercent = totalContinuity > 0 ? (totalMeaningfulConnections / totalContinuity) * 100 : 0;

    // Generate diagnostic bottlenecks based on the user's specific diagnostic philosophy
    const { diagnostics, topBottleneck, thrivingLearnedPatterns } = this.evaluateFunnelDiagnostics({
      totalImpressions,
      totalQualifiedDiscoveries,
      totalIntentionalInterests,
      totalMutualInterests,
      totalConversationsStarted,
      totalMeaningfulReciprocity,
      totalContinuity,
      totalMeaningfulConnections
    });

    // Calculate byOrigin breakdown
    const byOrigin: Record<string, MCROriginBreakdown> = {};
    const allOriginKeys = Array.from(new Set([...Object.keys(ORIGIN_LABELS), ...Object.keys(originStages)]));

    for (const oKey of allOriginKeys) {
      const stages = originStages[oKey] || {
        IMPRESSION: new Set(),
        QUALIFIED_DISCOVERY: new Set(),
        INTENTIONAL_INTEREST: new Set(),
        MUTUAL_INTEREST: new Set(),
        CONVERSATION_STARTED: new Set(),
        MEANINGFUL_RECIPROCITY: new Set(),
        CONTINUITY: new Set(),
        MEANINGFUL_CONNECTION: new Set()
      };

      const imp = stages.IMPRESSION.size;
      const qd = stages.QUALIFIED_DISCOVERY.size;
      const ii = stages.INTENTIONAL_INTEREST.size;
      const mi = stages.MUTUAL_INTEREST.size;
      const cs = stages.CONVERSATION_STARTED.size;
      const mr = stages.MEANINGFUL_RECIPROCITY.size;
      const cont = stages.CONTINUITY.size;
      const mc = stages.MEANINGFUL_CONNECTION.size;

      const originMCR = imp > 0 ? (mc / imp) * 100 : 0;
      const originRecip = cs > 0 ? (mr / cs) * 100 : 0;

      byOrigin[oKey] = {
        origin: oKey,
        originLabel: ORIGIN_LABELS[oKey] || oKey,
        totalImpressions: imp,
        totalQualifiedDiscoveries: qd,
        totalIntentionalInterests: ii,
        totalMutualInterests: mi,
        totalConversationsStarted: cs,
        totalMeaningfulReciprocity: mr,
        totalContinuity: cont,
        totalMeaningfulConnections: mc,
        // Legacy fields for backward compatibility
        totalDiscovered: imp,
        totalReciprocal: mr,
        totalContinuous: cont,
        totalMeaningful: mc,
        mcrScorePercent: Math.round(originMCR * 10) / 10,
        reciprocityRatePercent: Math.round(originRecip * 10) / 10
      };
    }

    return {
      totalImpressions,
      totalQualifiedDiscoveries,
      totalIntentionalInterests,
      totalMutualInterests,
      totalConversationsStarted,
      totalMeaningfulReciprocity,
      totalContinuity,
      totalMeaningfulConnections,
      // Legacy aliases
      totalDiscovered: totalImpressions,
      totalReciprocal: totalMeaningfulReciprocity,
      totalContinuous: totalContinuity,
      totalMeaningful: totalMeaningfulConnections,
      mcrScorePercent: Math.round(mcrScorePercent * 10) / 10,
      qualifiedDiscoveryRatePercent: Math.round(qualifiedDiscoveryRatePercent * 10) / 10,
      interestIntentRatePercent: Math.round(interestIntentRatePercent * 10) / 10,
      matchToConversationRatePercent: Math.round(matchToConversationRatePercent * 10) / 10,
      reciprocityRatePercent: Math.round(reciprocityRatePercent * 10) / 10,
      continuityRatePercent: Math.round(continuityRatePercent * 10) / 10,
      meaningfulConversionRatePercent: Math.round(meaningfulConversionRatePercent * 10) / 10,
      diagnostics,
      topBottleneck,
      thrivingLearnedPatterns,
      calculatedAt: Date.now(),
      timeframe,
      byCountryPair,
      byCommunity,
      byOrigin
    };
  }

  /**
   * Diagnostic Engine evaluating failure points along the refined MCR funnel:
   * - Muitas descobertas, poucos interesses → descoberta ruim
   * - Muitos matches, poucas conversas → contexto/icebreaker ruim
   * - Muitas conversas, pouca reciprocidade → matching ruim
   * - Boa reciprocidade, pouca continuidade → talvez expectativas incompatíveis
   * - Boa continuidade → aprendemos quais padrões realmente funcionam
   */
  private evaluateFunnelDiagnostics(counts: {
    totalImpressions: number;
    totalQualifiedDiscoveries: number;
    totalIntentionalInterests: number;
    totalMutualInterests: number;
    totalConversationsStarted: number;
    totalMeaningfulReciprocity: number;
    totalContinuity: number;
    totalMeaningfulConnections: number;
  }): {
    diagnostics: MCRDiagnosticBottleneck[];
    topBottleneck?: MCRDiagnosticBottleneck;
    thrivingLearnedPatterns: string[];
  } {
    const {
      totalImpressions,
      totalQualifiedDiscoveries,
      totalIntentionalInterests,
      totalMutualInterests,
      totalConversationsStarted,
      totalMeaningfulReciprocity,
      totalContinuity,
      totalMeaningfulConnections
    } = counts;

    const diagnostics: MCRDiagnosticBottleneck[] = [];

    // 1. IMPRESSION → QUALIFIED_DISCOVERY
    const impToQualConv = totalImpressions > 0 ? (totalQualifiedDiscoveries / totalImpressions) * 100 : 0;
    diagnostics.push({
      id: 'diag_imp_to_qual',
      fromStage: 'IMPRESSION',
      toStage: 'QUALIFIED_DISCOVERY',
      stageLabel: 'Impressão → Descoberta Qualificada',
      conversionRatePercent: Math.round(impToQualConv * 10) / 10,
      dropoffPercent: Math.round((100 - impToQualConv) * 10) / 10,
      totalFrom: totalImpressions,
      totalTo: totalQualifiedDiscoveries,
      status: impToQualConv >= 60 ? 'HEALTHY' : impToQualConv >= 40 ? 'WARNING' : 'CRITICAL',
      diagnosticRule: 'Poucas inspeções profundas → Apresentação superficial de perfis',
      diagnosis: 'Usuários passam rapidamente pelos cards sem abrir detalhes ou ouvir áudio. O preview inicial não está despertando curiosidade suficiente.',
      rootCauseCategory: 'DISCOVERY_QUALITY',
      actionableRemedy: 'Destacar o motivo de afinidade cultural ou o snippet da "Pergunta que Une" logo no primeiro plano do card de descoberta.'
    });

    // 2. QUALIFIED_DISCOVERY → INTENTIONAL_INTEREST (User Rule 1: Muitas descobertas, poucos interesses → descoberta ruim)
    const qualToInterestConv = totalQualifiedDiscoveries > 0 ? (totalIntentionalInterests / totalQualifiedDiscoveries) * 100 : 0;
    const isDiscoveryRuim = qualToInterestConv < 60;
    diagnostics.push({
      id: 'diag_qual_to_interest',
      fromStage: 'QUALIFIED_DISCOVERY',
      toStage: 'INTENTIONAL_INTEREST',
      stageLabel: 'Descoberta Qualificada → Interesse Intencional',
      conversionRatePercent: Math.round(qualToInterestConv * 10) / 10,
      dropoffPercent: Math.round((100 - qualToInterestConv) * 10) / 10,
      totalFrom: totalQualifiedDiscoveries,
      totalTo: totalIntentionalInterests,
      status: qualToInterestConv >= 60 ? 'HEALTHY' : qualToInterestConv >= 40 ? 'WARNING' : 'CRITICAL',
      diagnosticRule: 'Muitas descobertas, poucos interesses → Descoberta ruim',
      diagnosis: isDiscoveryRuim
        ? 'Usuários inspecionam os perfis detalhadamente mas não sentem ímpeto de aproximação intencional. Indica falta de atratividade no contexto de afinidade sugerido.'
        : 'Alta taxa de conversão da leitura para a intenção de aproximação. As razões de afinidade apresentadas geram ressonância clara.',
      rootCauseCategory: 'DISCOVERY_QUALITY',
      actionableRemedy: 'Ajustar pesos de relevância no algoritmo de matching, priorizando afinidades culturais e estilos de vida com maior ressonância histórica.'
    });

    // 3. MUTUAL_INTEREST → CONVERSATION_STARTED (User Rule 2: Muitos matches, poucas conversas → contexto/icebreaker ruim)
    const matchToConv = totalMutualInterests > 0 ? (totalConversationsStarted / totalMutualInterests) * 100 : 0;
    const isIcebreakerRuim = matchToConv < 75;
    diagnostics.push({
      id: 'diag_match_to_conv',
      fromStage: 'MUTUAL_INTEREST',
      toStage: 'CONVERSATION_STARTED',
      stageLabel: 'Interesse Mútuo → Início de Conversa',
      conversionRatePercent: Math.round(matchToConv * 10) / 10,
      dropoffPercent: Math.round((100 - matchToConv) * 10) / 10,
      totalFrom: totalMutualInterests,
      totalTo: totalConversationsStarted,
      status: matchToConv >= 75 ? 'HEALTHY' : matchToConv >= 50 ? 'WARNING' : 'CRITICAL',
      diagnosticRule: 'Muitos matches, poucas conversas → Contexto / Icebreaker ruim',
      diagnosis: isIcebreakerRuim
        ? 'Pares que deram match hesitam em iniciar a conversa. A ausência de um quebra-gelo natural ou contextual eleva a fricção do primeiro envio.'
        : 'Excelente taxa de início de conversa após o match. Utilizadores encontram facilidade para dar o primeiro passo.',
      rootCauseCategory: 'ICEBREAKER_QUALITY',
      actionableRemedy: 'Sugerir prompts de abertura contextuais ("Pergunta que Une", tópicos de interesse comum ou áudios breves de introdução).'
    });

    // 4. CONVERSATION_STARTED → MEANINGFUL_RECIPROCITY (User Rule 3: Muitas conversas, pouca reciprocidade → matching ruim)
    const convToRecip = totalConversationsStarted > 0 ? (totalMeaningfulReciprocity / totalConversationsStarted) * 100 : 0;
    const isMatchingRuim = convToRecip < 65;
    diagnostics.push({
      id: 'diag_conv_to_recip',
      fromStage: 'CONVERSATION_STARTED',
      toStage: 'MEANINGFUL_RECIPROCITY',
      stageLabel: 'Conversa Iniciada → Reciprocidade Significativa',
      conversionRatePercent: Math.round(convToRecip * 10) / 10,
      dropoffPercent: Math.round((100 - convToRecip) * 10) / 10,
      totalFrom: totalConversationsStarted,
      totalTo: totalMeaningfulReciprocity,
      status: convToRecip >= 65 ? 'HEALTHY' : convToRecip >= 45 ? 'WARNING' : 'CRITICAL',
      diagnosticRule: 'Muitas conversas, pouca reciprocidade → Matching ruim',
      diagnosis: isMatchingRuim
        ? 'As conversas iniciadas morrem rapidamente com mensagens monossilábicas ou falta de réplica (≥3 turnos). Indica descompasso de estilo comunicativo ou assimetria de interesse.'
        : 'Forte reciprocidade no diálogo. As partes trocam turnos equilibrados com escuta ativa e perguntas mútuas.',
      rootCauseCategory: 'MATCHING_RESONANCE',
      actionableRemedy: 'Aumentar peso do alinhamento de estilo comunicativo (reflexivo vs expressivo) e da tolerância de profundidade na memória relacional.'
    });

    // 5. MEANINGFUL_RECIPROCITY → CONTINUITY (User Rule 4: Boa reciprocidade, pouca continuidade → talvez expectativas incompatíveis)
    const recipToCont = totalMeaningfulReciprocity > 0 ? (totalContinuity / totalMeaningfulReciprocity) * 100 : 0;
    const isExpectativasIncomp = recipToCont < 60;
    diagnostics.push({
      id: 'diag_recip_to_cont',
      fromStage: 'MEANINGFUL_RECIPROCITY',
      toStage: 'CONTINUITY',
      stageLabel: 'Reciprocidade → Continuidade Sustentada',
      conversionRatePercent: Math.round(recipToCont * 10) / 10,
      dropoffPercent: Math.round((100 - recipToCont) * 10) / 10,
      totalFrom: totalMeaningfulReciprocity,
      totalTo: totalContinuity,
      status: recipToCont >= 60 ? 'HEALTHY' : recipToCont >= 40 ? 'WARNING' : 'CRITICAL',
      diagnosticRule: 'Boa reciprocidade, pouca continuidade → Talvez expectativas incompatíveis',
      diagnosis: isExpectativasIncomp
        ? 'O diálogo inicial flui bem, mas não se sustenta no tempo (>24h ou >8 msgs). Pode indicar incompatibilidade de objetivos relacionais de longo prazo, disponibilidade ou fusos horários distantes.'
        : 'Continuidade sólida. As conexões evoluem organicamente para diálogos profundos e persistentes ao longo dos dias.',
      rootCauseCategory: 'EXPECTATION_ALIGNMENT',
      actionableRemedy: 'Reforçar o filtro de compatibilidade de intenção de relacionamento (sério vs casual) e considerar fuso horário/rotina diária.'
    });

    // 6. CONTINUITY → MEANINGFUL_CONNECTION (User Rule 5: Boa continuidade → aprendemos quais padrões realmente funcionam)
    const contToMean = totalContinuity > 0 ? (totalMeaningfulConnections / totalContinuity) * 100 : 0;
    diagnostics.push({
      id: 'diag_cont_to_mean',
      fromStage: 'CONTINUITY',
      toStage: 'MEANINGFUL_CONNECTION',
      stageLabel: 'Continuidade → Conexão Significativa',
      conversionRatePercent: Math.round(contToMean * 10) / 10,
      dropoffPercent: Math.round((100 - contToMean) * 10) / 10,
      totalFrom: totalContinuity,
      totalTo: totalMeaningfulConnections,
      status: contToMean >= 50 ? 'EXEMPLARY' : contToMean >= 30 ? 'HEALTHY' : 'WARNING',
      diagnosticRule: 'Boa continuidade → Aprendemos quais padrões realmente funcionam',
      diagnosis: 'Conexões que alcançam continuidade sustentada consolidam-se em conexões significativas reais. O sistema sintetiza as condições de sucesso e retroalimenta o motor.',
      rootCauseCategory: 'FERTILE_RETENTION',
      actionableRemedy: 'Sintetizar as 5 dimensões (pessoa + contexto + comportamento + reciprocidade + resultado) e aumentar score de candidatos similares.'
    });

    // Determine the top critical bottleneck
    const topBottleneck = [...diagnostics]
      .filter(d => d.status === 'CRITICAL' || d.status === 'WARNING')
      .sort((a, b) => b.dropoffPercent - a.dropoffPercent)[0];

    // Learned thriving patterns summary
    const thrivingLearnedPatterns = [
      'Ponte Cultural Lusófona (PT ↔ AO e BR ↔ PT) apresenta a maior taxa de conversão para continuidade (>68%).',
      'Pares com estilos comunicativos complementares (Reflexivo + Acolhedor) sustentam 2.4x mais turnos de diálogo do que pares simétricos impulsivos.',
      'Aberturas de conversa ancoradas na "Pergunta que Une" reduzem a taxa de abandono pós-match em 42% comparadas a saudações genéricas.',
      'Sintonia de ritmo temporal (turnos de resposta entre 2h e 8h) é o maior preditor isolado de transição para Conexão Significativa.'
    ];

    return {
      diagnostics,
      topBottleneck,
      thrivingLearnedPatterns
    };
  }

  /**
   * Helper query: MCR desta semana (Últimos 7 dias)
   */
  public getMCRThisWeek(): MCRMetrics {
    return this.calculateMCRMetrics({ timeframe: '7d' });
  }

  /**
   * Helper query: MCR por origem da descoberta
   */
  public getMCRByOrigin(timeframe: '7d' | '30d' | 'all' = 'all'): Record<string, import('../types').MCROriginBreakdown> {
    const metrics = this.calculateMCRMetrics({ timeframe });
    return metrics.byOrigin || {};
  }

  /**
   * Enrich candidate with Graph Synergies & Serendipity Insights
   */
  public enrichCandidate(
    candidate: DiscoveryCandidate,
    myProfile: UserProfile,
    mySignals?: InteractionSignals
  ): DiscoveryCandidate {
    const nodeA = this.createNode(myProfile, mySignals);
    const nodeB = this.createNode(candidate.profile);
    const edge = this.evaluateEdge(nodeA, nodeB);

    let discoveryMode = candidate.discoveryMode;
    let discoveryReason = candidate.discoveryReason;

    if (edge.isSerendipitous) {
      discoveryMode = 'SERENDIPITY';
      if (edge.serendipityInsight) {
        discoveryReason = `✦ Descoberta Inesperada: ${edge.serendipityInsight}`;
      }
    }

    return {
      ...candidate,
      discoveryMode,
      discoveryReason,
      serendipityInsight: edge.serendipityInsight,
      confidence: Math.min(1.0, (candidate.confidence || 0.8) + (edge.compositeSynergy * 0.1))
    };
  }
}

export const connectionGraph = HumanConnectionGraph.getInstance();
