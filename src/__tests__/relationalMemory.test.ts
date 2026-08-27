import { describe, it, expect, beforeEach } from 'vitest';
import { relationalMemory } from '../services/relationalMemory';
import { UserProfile, RelationalConditionTuple, DiscoveryCandidate } from '../types';

describe('Relational Memory (Pessoa + Contexto + Comportamento + Reciprocidade + Resultado)', () => {
  const testUser: UserProfile = {
    uid: 'user_rel_test_1',
    displayName: 'Carlos',
    age: 30,
    gender: 'man',
    intent: 'serious',
    interests: ['Música Lusófona', 'Literatura', 'Gastronomia'],
    bio: 'Aprecio conversas tranquilas e com conteúdo sobre os nossos países.',
    profilePhoto: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500',
    countryCode: 'AO',
    countryName: 'Angola',
    cityName: 'Luanda',
    verificationStatus: 'verified',
    visibility: 'public',
    online: true,
    lastActive: Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  const resonantCandidate: DiscoveryCandidate = {
    profile: {
      uid: 'user_rel_cand_1',
      displayName: 'Marta',
      age: 28,
      gender: 'woman',
      intent: 'serious',
      interests: ['Literatura', 'Música Lusófona', 'Viagens CPLP'],
      bio: 'Apaixonada por histórias, poesia e pontes culturais atlânticas.',
      profilePhoto: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500',
      countryCode: 'PT',
      countryName: 'Portugal',
      cityName: 'Porto',
      verificationStatus: 'verified',
      visibility: 'public',
      online: true,
      lastActive: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now()
    },
    compatibilityScore: 88,
    deterministicScore: 85,
    contextScore: 80,
    noveltyBonus: 5,
    confidence: 0.9,
    compatibilityReasons: ['Ponte Cultural Lusófona', 'Interesses em Literatura'],
    expansionLevel: 'CITY',
    compatibilityResult: {
      score: 88,
      sharedInterests: ['Literatura', 'Música Lusófona'],
      intentAlignment: 'exact',
      culturalConnection: 'cross_cultural_cplp',
      confidence: 0.9,
      crossCulturalHighlight: 'Ponte Angola - Portugal',
      reasons: ['Literatura']
    },
    crossCulturalHighlight: 'Ponte Angola - Portugal',
    discoveryReason: 'Ponte Cultural Lusófona com ressonância literária',
    evidence: [],
    conversationPrompt: 'Que livro lusófono mudou a tua visão de mundo?',
    connectionContext: 'Porto, Portugal · Literatura',
    discoveryMode: 'CULTURAL_BRIDGE'
  };

  beforeEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  it('should initialize with an initial calibrated baseline memory for a user', () => {
    const memory = relationalMemory.getMemoryForUser(testUser.uid);
    expect(memory).toBeDefined();
    expect(memory.userId).toBe(testUser.uid);
    expect(memory.fertileConditions.topResonantStyles).toBeInstanceOf(Array);
    expect(memory.fertileConditions.thrivingContexts.topOrigins).toContain('CULTURAL_BRIDGE');
  });

  it('should record a successful condition tuple and re-synthesize memory', async () => {
    const tuple: Omit<RelationalConditionTuple, 'id' | 'recordedAt'> = {
      userId: testUser.uid,
      targetUid: resonantCandidate.profile.uid,
      person: {
        userStyle: 'reflective',
        targetStyle: 'reflective',
        userDepth: 'deep',
        targetDepth: 'deep',
        intentMatch: true,
        culturalPair: ['AO', 'PT'],
        crossBorder: true
      },
      context: {
        discoveryOrigin: 'CULTURAL_BRIDGE',
        sharedValues: ['Literatura', 'Música Lusófona'],
        differingInterests: ['Viagens CPLP']
      },
      behavior: {
        icebreakerType: 'values_reflection',
        initiatorSpeedHours: 1.5,
        responderSpeedHours: 2.0,
        avgMessageWords: 24,
        dialogueInitiative: 'balanced'
      },
      reciprocity: {
        turnExchangeRatio: 0.92,
        backAndForthTurns: 8,
        questionReturnedRate: 0.9,
        sentimentResonance: 0.95,
        vulnerabilityDeepened: true
      },
      outcome: {
        stage: 'MEANINGFUL_CONNECTION',
        isMeaningfulBond: true,
        continuityDays: 2,
        thriveDrivers: ['Ponte Cultural', 'Diálogo Reflexivo'],
        qualitativeFeedback: 'Alta sintonia em literatura e diálogo pausado'
      }
    };

    const recorded = await relationalMemory.recordConditionTuple(tuple);
    expect(recorded.id).toBeDefined();
    expect(recorded.recordedAt).toBeGreaterThan(0);

    const memory = relationalMemory.getMemoryForUser(testUser.uid);
    expect(memory.totalConditionsAnalyzed).toBeGreaterThanOrEqual(1);
    expect(memory.fertileConditions.topResonantStyles).toContain('reflective');
  });

  it('should accurately evaluate condition fitness for candidates', () => {
    const evaluation = relationalMemory.evaluateConditionFit(testUser, resonantCandidate);
    expect(evaluation.fitnessScore).toBeGreaterThanOrEqual(0.6);
    expect(evaluation.fertileReasoning).toBeDefined();
    expect(evaluation.fertileSignals.length).toBeGreaterThan(0);
  });
});
