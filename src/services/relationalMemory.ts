import {
  UserProfile,
  RelationalConditionTuple,
  UserRelationalMemory,
  ConditionFitnessEvaluation,
  DiscoveryCandidate,
  CPLPCountryCode,
  MCRFunnelStage
} from '../types';
import { db, doc, setDoc, getDocs, query, collection, where, limit, serverTimestamp } from '../firebase/config';
import { HumanConnectionGraph } from './connectionGraph';

const LOCAL_TUPLES_STORAGE_KEY = 'enos_relational_tuples_v1';
const LOCAL_USER_MEMORY_STORAGE_KEY = 'enos_user_relational_memory_v1';

/**
 * SERVIÇO DE MEMÓRIA RELACIONAL ÉNÓS
 * 
 * Unidade de valor da inteligência de conexões:
 * pessoa + contexto + comportamento + reciprocidade + resultado
 * 
 * Constrói memória contínua sobre: "Que condições produzem uma conexão significativa para esta pessoa específica?"
 */
export class RelationalMemoryService {
  private static instance: RelationalMemoryService;
  private inMemoryTuples: RelationalConditionTuple[] = [];
  private inMemoryUserMemories: Map<string, UserRelationalMemory> = new Map();
  private subscribers: Set<(userId: string) => void> = new Set();

  private constructor() {
    this.hydrateFromLocalStorage();
  }

  public static getInstance(): RelationalMemoryService {
    if (!RelationalMemoryService.instance) {
      RelationalMemoryService.instance = new RelationalMemoryService();
    }
    return RelationalMemoryService.instance;
  }

  // -------------------------------------------------------------
  // HYDRATION & PERSISTENCE
  // -------------------------------------------------------------
  private hydrateFromLocalStorage(): void {
    if (typeof window === 'undefined') return;
    try {
      const storedTuples = localStorage.getItem(LOCAL_TUPLES_STORAGE_KEY);
      if (storedTuples) {
        this.inMemoryTuples = JSON.parse(storedTuples);
      }
      const storedMemories = localStorage.getItem(LOCAL_USER_MEMORY_STORAGE_KEY);
      if (storedMemories) {
        const parsed = JSON.parse(storedMemories);
        Object.entries(parsed).forEach(([uid, mem]) => {
          this.inMemoryUserMemories.set(uid, mem as UserRelationalMemory);
        });
      }
    } catch (e) {
      console.warn('[RelationalMemory] Hydration fallback warning:', e);
    }
  }

  private persistLocal(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(LOCAL_TUPLES_STORAGE_KEY, JSON.stringify(this.inMemoryTuples.slice(-300)));
      const obj: Record<string, UserRelationalMemory> = {};
      this.inMemoryUserMemories.forEach((v, k) => {
        obj[k] = v;
      });
      localStorage.setItem(LOCAL_USER_MEMORY_STORAGE_KEY, JSON.stringify(obj));
    } catch {}
  }

  public subscribe(cb: (userId: string) => void): () => void {
    this.subscribers.add(cb);
    return () => this.subscribers.delete(cb);
  }

  private notify(userId: string): void {
    this.subscribers.forEach(cb => cb(userId));
  }

  /**
   * Syncs user tuples and memories from Firestore
   */
  public async syncWithFirestore(userId: string): Promise<void> {
    if (!userId) return;
    try {
      const tuplesQuery = query(
        collection(db, 'relational_tuples'),
        where('userId', '==', userId),
        limit(100)
      );
      const tuplesSnap = await getDocs(tuplesQuery);
      const remoteTuples: RelationalConditionTuple[] = [];
      tuplesSnap.forEach(d => {
        remoteTuples.push(d.data() as RelationalConditionTuple);
      });

      const existingIds = new Set(this.inMemoryTuples.map(t => t.id));
      for (const rt of remoteTuples) {
        if (!existingIds.has(rt.id)) {
          this.inMemoryTuples.push(rt);
          existingIds.add(rt.id);
        }
      }

      this.synthesizeMemoryForUser(userId);
      this.persistLocal();
      this.notify(userId);
    } catch (e) {
      console.info('[RelationalMemory] Firestore sync deferred, using local tuples:', e);
    }
  }

  // -------------------------------------------------------------
  // TUPLE RECORDING (pessoa + contexto + comportamento + reciprocidade + resultado)
  // -------------------------------------------------------------
  public async recordConditionTuple(
    data: Omit<RelationalConditionTuple, 'id' | 'recordedAt'>
  ): Promise<RelationalConditionTuple> {
    const tuple: RelationalConditionTuple = {
      ...data,
      id: `tuple_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      recordedAt: Date.now()
    };

    this.inMemoryTuples.push(tuple);
    this.synthesizeMemoryForUser(tuple.userId);
    this.persistLocal();
    this.notify(tuple.userId);

    // Save to Firestore
    try {
      await setDoc(doc(db, 'relational_tuples', tuple.id), {
        ...tuple,
        serverTimestamp: serverTimestamp()
      });
    } catch (e) {
      console.info('[RelationalMemory] Tuple saved to offline queue:', tuple.id);
    }

    return tuple;
  }

  // -------------------------------------------------------------
  // MEMORY SYNTHESIS (Aprendizagem das Condições Férteis da Pessoa)
  // -------------------------------------------------------------
  public synthesizeMemoryForUser(userId: string): UserRelationalMemory {
    const userTuples = this.inMemoryTuples.filter(t => t.userId === userId);
    const meaningfulTuples = userTuples.filter(t => t.outcome.isMeaningfulBond || t.outcome.stage === 'MEANINGFUL_CONNECTION' || t.outcome.stage === 'CONTINUITY');

    // Default heuristics if no interactions yet (Cold-start baseline)
    if (userTuples.length === 0) {
      const defaultMemory: UserRelationalMemory = {
        userId,
        totalConditionsAnalyzed: 0,
        meaningfulBondsCount: 0,
        fertileConditions: {
          topResonantStyles: ['reflective', 'warm'],
          optimalDepthPreference: 'moderate',
          thrivingContexts: {
            topOrigins: ['SERENDIPITY', 'CULTURAL_BRIDGE', 'VALUES_AFFINITY'],
            crossBorderSuccessRate: 0.75,
            idealComplementarityFormula: '1-2 valores fundamentais + 2 horizontes complementares'
          },
          reciprocityPace: {
            idealResponseWindow: '2h a 6h com reflexão',
            preferredTurnBalance: 'symmetric',
            effectiveIcebreakers: {
              values_reflection: 0.85,
              question: 0.78,
              audio_snippet: 0.70,
              direct_greeting: 0.45
            }
          },
          frictionTriggers: [
            'Respostas telegráficas sem retorno de perguntas',
            'Quebra precoce de diálogo após o primeiro dia',
            'Disparidade de ritmo comunicativo'
          ],
          synthesizedInsight: 'A memória relacional está a ser calibrada. As tuas melhores conexões tendem a nascer quando há espaço para diálogo reflexivo e curiosidade mútua.'
        },
        lastUpdated: Date.now()
      };
      this.inMemoryUserMemories.set(userId, defaultMemory);
      return defaultMemory;
    }

    // 1. Analyze successful partner styles
    const styleScores: Record<string, { count: number; success: number }> = {};
    userTuples.forEach(t => {
      const st = t.person.targetStyle;
      if (!styleScores[st]) styleScores[st] = { count: 0, success: 0 };
      styleScores[st].count++;
      if (t.outcome.isMeaningfulBond) styleScores[st].success++;
    });

    const topResonantStyles = Object.entries(styleScores)
      .sort((a, b) => (b[1].success / Math.max(1, b[1].count)) - (a[1].success / Math.max(1, a[1].count)))
      .map(([st]) => st as 'reflective' | 'expressive' | 'direct' | 'warm')
      .slice(0, 2);

    // 2. Analyze context & origins
    const originScores: Record<string, { count: number; success: number }> = {};
    let crossBorderCount = 0;
    let crossBorderSuccess = 0;

    userTuples.forEach(t => {
      const orig = t.context.discoveryOrigin || 'VALUES_AFFINITY';
      if (!originScores[orig]) originScores[orig] = { count: 0, success: 0 };
      originScores[orig].count++;
      if (t.outcome.isMeaningfulBond) originScores[orig].success++;

      if (t.person.crossBorder) {
        crossBorderCount++;
        if (t.outcome.isMeaningfulBond) crossBorderSuccess++;
      }
    });

    const topOrigins = Object.entries(originScores)
      .sort((a, b) => (b[1].success / Math.max(1, b[1].count)) - (a[1].success / Math.max(1, a[1].count)))
      .map(([orig]) => orig)
      .slice(0, 3);

    const crossBorderSuccessRate = crossBorderCount > 0 ? crossBorderSuccess / crossBorderCount : 0.7;

    // 3. Analyze icebreakers and reciprocity
    const icebreakerScores: Record<string, { count: number; success: number }> = {};
    userTuples.forEach(t => {
      const ib = t.behavior.icebreakerType || 'question';
      if (!icebreakerScores[ib]) icebreakerScores[ib] = { count: 0, success: 0 };
      icebreakerScores[ib].count++;
      if (t.outcome.isMeaningfulBond) icebreakerScores[ib].success++;
    });

    const effectiveIcebreakers: Record<string, number> = {};
    Object.entries(icebreakerScores).forEach(([k, v]) => {
      effectiveIcebreakers[k] = Math.round((v.success / Math.max(1, v.count)) * 100) / 100;
    });

    // 4. Extract friction triggers
    const frictionTriggersSet = new Set<string>();
    userTuples.filter(t => !t.outcome.isMeaningfulBond && t.outcome.stallReason).forEach(t => {
      if (t.outcome.stallReason) frictionTriggersSet.add(t.outcome.stallReason);
    });
    if (frictionTriggersSet.size === 0) {
      frictionTriggersSet.add('Respostas telegráficas sem perguntas de volta');
      frictionTriggersSet.add('Falta de iniciativa partilhada no diálogo');
    }

    // 5. Synthesize qualitative insight
    let synthesizedInsight = '';
    if (meaningfulTuples.length >= 2) {
      const topOrigName = topOrigins[0] === 'SERENDIPITY' ? 'descobertas inesperadas' : topOrigins[0] === 'CULTURAL_BRIDGE' ? 'pontes culturais lusófonas' : 'sintonia de valores';
      synthesizedInsight = `As tuas conexões mais duradouras florescem em ${topOrigName}, especialmente com parceiros de tom ${topResonantStyles.join(' e ')}, onde o diálogo ultrapassa a troca superficial nas primeiras 48h.`;
    } else {
      synthesizedInsight = `Observámos que o teu ritmo relacional valoriza reciprocidade genuína e conversas que começam com perguntas que convidam à partilha de mundividências.`;
    }

    const memory: UserRelationalMemory = {
      userId,
      totalConditionsAnalyzed: userTuples.length,
      meaningfulBondsCount: meaningfulTuples.length,
      fertileConditions: {
        topResonantStyles: topResonantStyles.length > 0 ? topResonantStyles : ['reflective', 'warm'],
        optimalDepthPreference: meaningfulTuples.some(t => t.person.targetDepth === 'deep') ? 'deep' : 'moderate',
        thrivingContexts: {
          topOrigins: topOrigins.length > 0 ? topOrigins : ['SERENDIPITY', 'VALUES_AFFINITY'],
          crossBorderSuccessRate: Math.round(crossBorderSuccessRate * 100) / 100,
          idealComplementarityFormula: '1-2 valores nucleares + interesses estimulantes'
        },
        reciprocityPace: {
          idealResponseWindow: '1h a 4h com desenvolvimento de ideias',
          preferredTurnBalance: 'symmetric',
          effectiveIcebreakers: Object.keys(effectiveIcebreakers).length > 0 ? effectiveIcebreakers : { values_reflection: 0.85, question: 0.75 }
        },
        frictionTriggers: Array.from(frictionTriggersSet).slice(0, 3),
        synthesizedInsight
      },
      lastUpdated: Date.now()
    };

    this.inMemoryUserMemories.set(userId, memory);
    return memory;
  }

  public getMemoryForUser(userId: string): UserRelationalMemory {
    if (!this.inMemoryUserMemories.has(userId)) {
      return this.synthesizeMemoryForUser(userId);
    }
    return this.inMemoryUserMemories.get(userId)!;
  }

  public getUserTuples(userId: string): RelationalConditionTuple[] {
    return this.inMemoryTuples.filter(t => t.userId === userId);
  }

  // -------------------------------------------------------------
  // CONDITION FITNESS EVALUATION (Avaliação Preditiva das Condições de Encontro)
  // -------------------------------------------------------------
  /**
   * Evaluates if a prospective candidate matches the fertile conditions previously learned for this user.
   */
  public evaluateConditionFit(
    userProfile: UserProfile,
    candidate: DiscoveryCandidate,
    contextOverride?: { discoveryOrigin?: string }
  ): ConditionFitnessEvaluation {
    const memory = this.getMemoryForUser(userProfile.uid);
    const graph = HumanConnectionGraph.getInstance();

    const userNode = graph.createNode(userProfile);
    const targetNode = graph.createNode(candidate.profile);
    const edge = graph.evaluateEdge(userNode, targetNode);

    const fertileSignals: string[] = [];
    const cautionFactors: string[] = [];
    let fitnessScore = 0.5;

    // 1. Person dimension
    if (memory.fertileConditions.topResonantStyles.includes(targetNode.communicationStyle)) {
      fitnessScore += 0.20;
      fertileSignals.push(`Ritmo comunicativo com forte histórico de ressonância (${targetNode.communicationStyle})`);
    }

    if (targetNode.conversationalDepth === memory.fertileConditions.optimalDepthPreference) {
      fitnessScore += 0.10;
      fertileSignals.push(`Profundidade de diálogo harmoniosa (${targetNode.conversationalDepth})`);
    }

    // 2. Context dimension
    const discoveryOrigin = contextOverride?.discoveryOrigin || (edge.isSerendipitous ? 'SERENDIPITY' : 'VALUES_AFFINITY');
    if (memory.fertileConditions.thrivingContexts.topOrigins.includes(discoveryOrigin)) {
      fitnessScore += 0.15;
      fertileSignals.push(`Contexto de descoberta de alta fertilidade (${discoveryOrigin === 'SERENDIPITY' ? '✦ Descoberta Inesperada' : 'Sintonia de Valores'})`);
    }

    const isCrossBorder = userProfile.countryCode !== candidate.profile.countryCode;
    if (isCrossBorder && memory.fertileConditions.thrivingContexts.crossBorderSuccessRate >= 0.6) {
      fitnessScore += 0.10;
      fertileSignals.push(`Ponte cultural ativa com histórico de sucesso transnacional (${userProfile.countryCode} ↔ ${candidate.profile.countryCode})`);
    }

    // 3. Complementarity & Behavior balance
    const sharedValues = userProfile.interests.filter(i => candidate.profile.interests.includes(i));
    const differing = candidate.profile.interests.filter(i => !userProfile.interests.includes(i));

    if (sharedValues.length >= 1 && differing.length >= 2) {
      fitnessScore += 0.15;
      fertileSignals.push(`Fórmula complementar equilibrada: ${sharedValues.length} ponto de ancoragem + ${differing.length} horizontes a explorar`);
    }

    // Caution factors based on historical frictions
    if (sharedValues.length === 0 && differing.length > 4) {
      fitnessScore -= 0.15;
      cautionFactors.push('Poucos pontos de ancoragem imediata nos interesses');
    }

    fitnessScore = Math.max(0.1, Math.min(1.0, fitnessScore));

    let predictedSynergyLevel: ConditionFitnessEvaluation['predictedSynergyLevel'] = 'exploratory';
    if (fitnessScore >= 0.8) {
      predictedSynergyLevel = 'high_probability_resonance';
    } else if (fitnessScore >= 0.6) {
      predictedSynergyLevel = 'moderate_resonance';
    }

    const recommendedOpeningContext = edge.isSerendipitous
      ? `Comece por uma reflexão sobre ${differing[0] || 'perspetivas complementares'}, mantendo espaço para diálogo aberto.`
      : `Partilhe uma perspetiva sobre ${sharedValues[0] || 'valores de vida'}, onde ambos têm sintonia natural.`;

    const fertileReasoning = fertileSignals.length > 0
      ? fertileSignals.join(' · ')
      : 'Sintonia equilibrada com base nas tuas preferências aprendidas de diálogo.';

    return {
      targetUid: candidate.profile.uid,
      fitnessScore: Math.round(fitnessScore * 100) / 100,
      predictedSynergyLevel,
      fertileSignals,
      cautionFactors,
      recommendedOpeningContext,
      fertileReasoning,
      matchedConditions: fertileSignals
    };
  }
}

export const relationalMemory = RelationalMemoryService.getInstance();
