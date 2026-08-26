import {
  UserProfile,
  InteractionSignals,
  DiscoveryCandidate,
  RelationshipIntent,
  CPLPCountryCode,
  MCRFunnelStage,
  ConnectionFunnelEvent,
  MCRMetrics,
  ConnectionOutcomeLearning,
  TrustBadge
} from '../types';
import { db, doc, setDoc, addDoc, collection, getDocs, query, where, orderBy, limit, serverTimestamp } from '../firebase/config';

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
    } catch (e) {
      console.warn('Fallback hydration error:', e);
    }
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
   * PONTO 1: Track connection funnel progression (MCR Telemetry)
   */
  public async recordFunnelEvent(eventData: {
    userId: string;
    targetUid: string;
    stage: MCRFunnelStage;
    countryPair: [CPLPCountryCode, CPLPCountryCode];
    communityTag?: string;
    discoveryOrigin?: string;
    metadata?: Record<string, unknown>;
  }): Promise<ConnectionFunnelEvent> {
    const origin = eventData.discoveryOrigin || (eventData.metadata?.discoveryOrigin as string) || (eventData.metadata?.discoveryMode as string) || 'VALUES_AFFINITY';
    const event: ConnectionFunnelEvent = {
      id: `mcr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
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
      timestamp: Date.now()
    };

    this.inMemoryEvents.push(event);
    this.persistLocal();

    // Async persist to Firestore non-blocking
    try {
      await setDoc(doc(db, 'connection_events', event.id), {
        ...event,
        serverTimestamp: serverTimestamp()
      });
    } catch (e) {
      // Offline fallback
      console.info('Connection funnel event queued locally:', event.stage);
    }

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
   * PONTO 1: Computes the Meaningful Connection Rate (MCR) North Star Metric
   * Answers: "Qual é a MCR desta semana?", "Qual foi a MCR por origem da descoberta?", etc.
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

    // Default origins list to track breakdown
    const ORIGIN_LABELS: Record<string, string> = {
      SERENDIPITY: '✦ Descoberta Inesperada',
      CULTURAL_BRIDGE: 'Ponte Cultural Lusófona',
      COMPLEMENTARITY: 'Diferenças Enriquecedoras',
      DEEP_CONVERSATION: 'Diálogo Profundo',
      VALUES_AFFINITY: 'Sintonia de Valores & Intenção',
      COMMUNITY_QUESTION: 'Pergunta da Comunidade',
      DIRECT_SEARCH: 'Filtro Direto'
    };

    const uniquePairsByStage: Record<MCRFunnelStage, Set<string>> = {
      DISCOVERY: new Set(),
      MUTUAL_INTEREST: new Set(),
      CONVERSATION_INITIATED: new Set(),
      RECIPROCITY: new Set(),
      CONTINUITY: new Set(),
      MEANINGFUL_CONNECTION: new Set()
    };

    // Tracking per origin
    const pairOrigins: Record<string, string> = {};
    const originStages: Record<string, Record<MCRFunnelStage, Set<string>>> = {};

    const byCountryPair: Record<string, number> = {};
    const byCommunity: Record<string, number> = {};

    for (const e of events) {
      const pairKey = [e.userId, e.targetUid].sort().join(':');
      const originKey = (e.discoveryOrigin || e.metadata?.discoveryOrigin || e.metadata?.discoveryMode || 'VALUES_AFFINITY').toUpperCase();

      if (!pairOrigins[pairKey] || e.stage === 'DISCOVERY') {
        pairOrigins[pairKey] = originKey;
      }

      const effectiveOrigin = pairOrigins[pairKey] || originKey;

      if (!originStages[effectiveOrigin]) {
        originStages[effectiveOrigin] = {
          DISCOVERY: new Set(),
          MUTUAL_INTEREST: new Set(),
          CONVERSATION_INITIATED: new Set(),
          RECIPROCITY: new Set(),
          CONTINUITY: new Set(),
          MEANINGFUL_CONNECTION: new Set()
        };
      }

      if (uniquePairsByStage[e.stage]) {
        uniquePairsByStage[e.stage].add(pairKey);
        originStages[effectiveOrigin][e.stage].add(pairKey);
      }

      if (e.stage === 'MEANINGFUL_CONNECTION') {
        const cPair = `${e.countryPair[0]}-${e.countryPair[1]}`;
        byCountryPair[cPair] = (byCountryPair[cPair] || 0) + 1;
        if (e.communityTag) {
          byCommunity[e.communityTag] = (byCommunity[e.communityTag] || 0) + 1;
        }
      }
    }

    const totalDiscovered = Math.max(1, uniquePairsByStage.DISCOVERY.size);
    const totalMutualInterests = uniquePairsByStage.MUTUAL_INTEREST.size;
    const totalConversationsStarted = uniquePairsByStage.CONVERSATION_INITIATED.size;
    const totalReciprocal = uniquePairsByStage.RECIPROCITY.size;
    const totalContinuous = uniquePairsByStage.CONTINUITY.size;
    const totalMeaningful = uniquePairsByStage.MEANINGFUL_CONNECTION.size;

    const mcrScorePercent = (totalMeaningful / totalDiscovered) * 100;
    const reciprocityRatePercent = totalConversationsStarted > 0
      ? (totalReciprocal / totalConversationsStarted) * 100
      : 0;
    const continuityRatePercent = totalReciprocal > 0
      ? (totalContinuous / totalReciprocal) * 100
      : 0;

    // Calculate byOrigin breakdown
    const byOrigin: Record<string, import('../types').MCROriginBreakdown> = {};

    // Ensure all standard origins exist in summary for clean UI comparison
    const allOriginKeys = Array.from(new Set([...Object.keys(ORIGIN_LABELS), ...Object.keys(originStages)]));

    for (const oKey of allOriginKeys) {
      const stages = originStages[oKey] || {
        DISCOVERY: new Set(),
        MUTUAL_INTEREST: new Set(),
        CONVERSATION_INITIATED: new Set(),
        RECIPROCITY: new Set(),
        CONTINUITY: new Set(),
        MEANINGFUL_CONNECTION: new Set()
      };

      const disc = stages.DISCOVERY.size;
      const mut = stages.MUTUAL_INTEREST.size;
      const conv = stages.CONVERSATION_INITIATED.size;
      const recip = stages.RECIPROCITY.size;
      const cont = stages.CONTINUITY.size;
      const mean = stages.MEANINGFUL_CONNECTION.size;

      const originMCR = disc > 0 ? (mean / disc) * 100 : 0;
      const originRecip = conv > 0 ? (recip / conv) * 100 : 0;

      byOrigin[oKey] = {
        origin: oKey,
        originLabel: ORIGIN_LABELS[oKey] || oKey,
        totalDiscovered: disc,
        totalMutualInterests: mut,
        totalConversationsStarted: conv,
        totalReciprocal: recip,
        totalContinuous: cont,
        totalMeaningful: mean,
        mcrScorePercent: Math.round(originMCR * 10) / 10,
        reciprocityRatePercent: Math.round(originRecip * 10) / 10
      };
    }

    return {
      totalDiscovered,
      totalMutualInterests,
      totalConversationsStarted,
      totalReciprocal,
      totalContinuous,
      totalMeaningful,
      mcrScorePercent: Math.round(mcrScorePercent * 10) / 10,
      reciprocityRatePercent: Math.round(reciprocityRatePercent * 10) / 10,
      continuityRatePercent: Math.round(continuityRatePercent * 10) / 10,
      calculatedAt: Date.now(),
      timeframe,
      byCountryPair,
      byCommunity,
      byOrigin
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
