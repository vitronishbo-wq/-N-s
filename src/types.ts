export type CPLPCountryCode =
  | 'AO' // Angola
  | 'BR' // Brasil
  | 'CV' // Cabo Verde
  | 'GW' // Guiné-Bissau
  | 'GQ' // Guiné Equatorial
  | 'MZ' // Moçambique
  | 'PT' // Portugal
  | 'ST' // São Tomé e Príncipe
  | 'TL'; // Timor-Leste

export interface CPLPCountry {
  code: CPLPCountryCode;
  name: string;
  flag: string;
  capital: string;
  defaultCities: string[];
}

export type RelationshipIntent =
  | 'serious'
  | 'dating'
  | 'marriage'
  | 'friendship'
  | 'meet_people';

export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';

export type UserRole = 'member' | 'moderator' | 'admin' | 'super_admin' | 'founder';
export type AdminRole = 
  | 'founder'
  | 'super_admin'
  | 'moderator'
  | 'support'
  | 'engineer'
  | 'finance_lead'
  | 'deus_fundador' // Backwards compatibility alias for founder
  | 'moderador'     // Backwards compatibility alias for moderator
  | 'admin';

// Granular RBAC/ABAC Permissions
export type AdminPermission =
  | 'users:read'
  | 'users:update'
  | 'users:block'
  | 'trust:signal:read'
  | 'trust:review'
  | 'trust:decision'
  | 'trust:action'
  | 'product:flags:read'
  | 'product:flags:write'
  | 'product:rollout'
  | 'growth:read'
  | 'growth:manage'
  | 'engineering:metrics:read'
  | 'engineering:jobs:manage'
  | 'integrations:read'
  | 'integrations:manage'
  | 'finance:read'
  | 'finance:payout'
  | 'tasks:create'
  | 'tasks:assign'
  | 'tasks:transition'
  | 'tasks:close'
  | 'admin:read'
  | 'admin:manage'
  | 'governance:read'
  | 'governance:manage'
  | 'audit:read';

// 4.8: ABAC Policy Constraint Model
export interface AuthorizationConstraint {
  id: string;
  name: string;
  type: 'country_scope' | 'self_mutation_forbidden' | 'immutable_state' | 'require_reason' | 'time_window';
  targetResource: string;
  evaluate: (context: {
    actor: AdminUser;
    action: AdminPermission;
    resource?: {
      type: string;
      id?: string;
      state?: unknown;
      countryCode?: CPLPCountryCode;
    };
  }) => boolean;
}

export interface AdminTeam {
  id: string;
  name: string;
  description: string;
  leadId: string;
  memberIds: string[];
  moduleAccess: string[];
  createdAt: number;
}

// 4.19: AdminAuditEvent Model
export interface AdminAuditEvent {
  id: string;
  actorId: string;
  actorDisplayName: string;
  actorRole: AdminRole;
  module: 'operations' | 'people' | 'trust' | 'product' | 'growth' | 'engineering' | 'integrations' | 'finance' | 'tasks' | 'governance' | 'rbac' | 'settings';
  resourceType: string;
  resourceId: string;
  action: string;
  result: 'success' | 'denied' | 'error';
  previousState?: unknown;
  newState?: unknown;
  justification?: string;
  authContext?: {
    permissionsChecked: AdminPermission[];
    policyApplied?: string;
    clientIp?: string;
    userAgent?: string;
  };
  timestamp: number;
}

// 4.13: GROWTH Models
export interface GrowthFunnelMetrics {
  acquisitionDaily: number;
  activationRatePercent: number;
  retentionD7Percent: number;
  retentionD30Percent: number;
  referralConversionRate: number;
  cplpExpansionScores: Record<CPLPCountryCode, {
    activeUsers: number;
    growthMomPercent: number;
    marketReadiness: 'nascent' | 'scaling' | 'established';
    targetCampaign: string;
  }>;
  referralCampaigns: {
    id: string;
    name: string;
    code: string;
    targetCountry: CPLPCountryCode;
    rewardDescription: string;
    activeReferrals: number;
    status: 'active' | 'paused';
  }[];
}

// 4.14: ENGINEERING Extended Models
export interface EngineeringJob {
  id: string;
  name: string;
  type: 'cleanup' | 'sync' | 'index' | 'ai_batch' | 'backup';
  schedule: string;
  lastRunStatus: 'success' | 'failed' | 'running';
  lastRunAt: number;
  durationMs: number;
}

export interface EngineeringErrorEntry {
  id: string;
  service: string;
  message: string;
  stackTrace?: string;
  occurrences: number;
  firstSeenAt: number;
  lastSeenAt: number;
  status: 'unresolved' | 'acknowledged' | 'resolved';
}

// 4.15: INTEGRATIONS Extended Categories & Contracts
export type IntegrationCategory =
  | 'ai'
  | 'payments'
  | 'identity'
  | 'communications'
  | 'webhooks'
  | 'partners';

export interface IntegrationContract {
  id: string;
  category: IntegrationCategory;
  providerName: string;
  adapterKey: string;
  endpoint: string;
  authMethod: 'bearer' | 'hmac' | 'oauth2' | 'apiKey';
  status: 'connected' | 'degraded' | 'offline';
  avgLatencyMs: number;
  monthlyCalls: number;
  errorRate: number;
  supportedCountries: CPLPCountryCode[];
  lastPingAt: number;
}

// 4.18: GOVERNANCE Models
export interface GovernancePolicy {
  id: string;
  code: string;
  title: string;
  category: 'data_retention' | 'moderation_sla' | 'cplp_compliance' | 'security' | 'financial_limit';
  description: string;
  enforced: boolean;
  lastAuditedAt: number;
  updatedBy: string;
}

// 4.26: Feature Flags Definition
export interface AppFeatureFlags {
  MATCHING_V1: boolean;
  AI_PROFILE_ASSISTANT: boolean;
  VIDEO: boolean;
  AUDIO: boolean;
  RELATIONSHIP_SPACE: boolean;
  VERIFICATION: boolean;
  COMMUNITIES: boolean;
  EVENTS: boolean;
}

export const DEFAULT_FEATURE_FLAGS: AppFeatureFlags = {
  MATCHING_V1: true,
  AI_PROFILE_ASSISTANT: true,
  VIDEO: false, // Planned for v1.2
  AUDIO: false, // Planned for v1.2
  RELATIONSHIP_SPACE: true,
  VERIFICATION: true,
  COMMUNITIES: true,
  EVENTS: true
};

// 4.20: Shared Domain Entities & Contracts
export interface AuthUser {
  uid: string;
  isAnonymous: boolean;
  email?: string | null;
  emailVerified?: boolean;
  phoneNumber?: string | null;
  createdAt: number;
  lastLoginAt: number;
  linkedProviders?: string[];
  lastReauthAt?: number;
}

export type AuthProviderType = 'anonymous' | 'password' | 'google.com' | 'phone';

export interface UserSession {
  sessionId: string;
  userId: string;
  deviceName: string;
  browser: string;
  os: string;
  ipAddress?: string;
  approxLocation?: string;
  createdAt: number;
  lastActiveAt: number;
  isCurrent: boolean;
  status: 'active' | 'revoked';
}

export type SensitiveOperationType =
  | 'delete_account'
  | 'change_password'
  | 'change_email'
  | 'export_data_archive'
  | 'revoke_all_sessions'
  | 'unlink_identity';

export interface SecurityAuditEvent {
  id: string;
  userId: string;
  eventType:
    | 'ACCOUNT_CREATED'
    | 'ANONYMOUS_LOGIN'
    | 'EMAIL_PASSWORD_LOGIN'
    | 'GOOGLE_LOGIN'
    | 'ACCOUNT_LINKED'
    | 'PASSWORD_CHANGED'
    | 'EMAIL_CHANGED'
    | 'PASSWORD_RESET_REQUESTED'
    | 'SESSION_REVOKED'
    | 'SENSITIVE_REAUTH_SUCCESS'
    | 'SENSITIVE_REAUTH_FAILED'
    | 'ACCOUNT_DELETED';
  ipApprox?: string;
  userAgent?: string;
  details?: Record<string, unknown>;
  timestamp: number;
}


export interface UserProfile {
  uid: string;
  displayName: string;
  age: number;
  birthDate?: string;
  gender: 'man' | 'woman' | 'non_binary' | 'other';
  intent: RelationshipIntent;
  interests: string[];
  bio: string;
  profilePhoto: string;
  profileThumbnail?: string;
  photos?: string[];
  countryCode: CPLPCountryCode;
  countryName: string;
  regionCode?: string;
  regionName?: string;
  cityId?: string;
  cityName: string;
  culturalBackground?: string;
  verificationStatus: VerificationStatus;
  visibility: 'public' | 'hidden'; // FUTURE: INCOGNITO_MODE (planned for future privacy tier)
  online: boolean;
  lastActive: number;
  createdAt: number;
  updatedAt: number;
}

export interface UserPreferences {
  uid: string;
  minAge: number;
  maxAge: number;
  genders: ('man' | 'woman' | 'non_binary' | 'other')[];
  countries: CPLPCountryCode[];
  regionCodes?: string[];
  cityIds?: string[];
  cities?: string[];
  distanceKm?: number;
  relationshipIntents: RelationshipIntent[];
  crossCultural: boolean;
  verifiedOnly: boolean;
  discoveryEnabled?: boolean;
}

export interface PrivacySettings {
  uid: string;
  shareApproximateLocationOnly: boolean;
  showAge: boolean;
  showOnlineStatus: boolean;
  visibility: 'public' | 'hidden';
}

// 4.9: Progressive Expansion Levels
export type ExpansionLevel =
  | 'CITY'
  | 'REGION'
  | 'COUNTRY'
  | 'CPLP_SELECTED'
  | 'CPLP_GLOBAL';

// 4.3 & 4.19: Discovery Context Contract (Session-Aware)
export interface DiscoveryContext {
  sessionId: string;
  currentTime: number;
  userCountryCode: CPLPCountryCode;
  userCityName: string;
  userRegionName?: string;
  allowCrossCultural: boolean;
  targetIntents: RelationshipIntent[];
  preferredCountries?: CPLPCountryCode[];
  maxDistanceKm?: number;
  excludeUids: string[];
  seenInSessionUids: string[];
  currentExpansionLevel: ExpansionLevel;
  recentlySeenWindowMs?: number;
  threshold?: number;
}

// 4.4: Structured Interaction Event
export interface InteractionEvent {
  eventId: string;
  userId: string;
  targetUid: string;
  eventType:
    | 'firstCandidateShown'
    | 'candidate_shown'
    | 'like'
    | 'pass'
    | 'firstMatch'
    | 'match'
    | 'firstConversation'
    | 'conversation_start'
    | 'meaningfulInteraction'
    | 'block'
    | 'report';
  timestamp: number;
  countryCode?: CPLPCountryCode | string;
  interests?: string[];
  metadata?: Record<string, unknown>;
}

// 4.5: Compact Signals Summary
export interface SignalsSummary {
  uid: string;
  totalSeen: number;
  totalLikes: number;
  totalPasses: number;
  totalMatches: number;
  totalConversations: number;
  topLikedCountries: Record<string, number>;
  topLikedInterests: Record<string, number>;
  lastActiveTimestamp: number;
}

// 4.6 & 4.17 & 4.18: User Activation State Contract
export type ActivationStage =
  | 'cold_start'
  | 'first_candidate'
  | 'first_like'
  | 'first_match'
  | 'activated';

export interface ActivationState {
  uid: string;
  currentStage: ActivationStage;
  isActivated: boolean;
  firstCandidateShownAt: number | null;
  firstLikeAt: number | null;
  firstMatchAt: number | null;
  firstConversationAt: number | null;
  firstConnectionMoment: number | null;
  activatedAt: number | null;
  durationToActivationMs: number | null;
}

// 4.14 & 4.15 & 4.34: Interaction Signals & Telemetry
export interface InteractionSignals {
  uid: string;
  seenCandidateUids: string[];
  recentlySeenTimestamps: Record<string, number>;
  passedTimestamps?: Record<string, number>;
  likedCandidateUids: string[];
  passedCandidateUids: string[];
  blockedUids: string[];
  reportedUids: string[];
  likedCountries: Record<CPLPCountryCode | string, number>;
  skippedCountries: Record<CPLPCountryCode | string, number>;
  likedInterests: Record<string, number>;
  likedReasonTypes?: Record<string, number>;
  conversationReasonTypes?: Record<string, number>;
  conversationStarts: number;
  meaningfulInteractions: number;
  totalLikesGiven: number;
  totalPassesGiven: number;
  firstCandidateShownAt?: number | null;
  firstLikeAt?: number | null;
  firstMatchAt?: number | null;
  firstConversationAt?: number | null;
  firstConnectionMoment?: number | null;
  activatedAt?: number | null;
  isActivated: boolean;
  activationDurationMs?: number | null;
  lastActiveTimestamp: number;
}

// 4.9: Compatibility Result Contract
export interface CompatibilityResult {
  score: number;
  reasons: string[];
  sharedInterests: string[];
  intentAlignment: 'exact' | 'high' | 'compatible' | 'neutral';
  culturalConnection: 'same_city' | 'same_country' | 'cross_cultural_cplp';
  discoveryDistance?: string;
  confidence: number;
  crossCulturalHighlight?: string;
}

// 3.1, 3.3: Discovery Modes & Evidence Types (Human Connection Graph)
export type DiscoveryMode =
  | 'SIMILARITY'
  | 'COMPLEMENTARITY'
  | 'SERENDIPITY'
  | 'CULTURAL_BRIDGE'
  | 'DEEP_CONVERSATION';

export type DiscoveryEvidenceType =
  | 'SIMILARITY'
  | 'COMPLEMENTARITY'
  | 'SERENDIPITY'
  | 'CULTURAL_CONNECTION'
  | 'CONVERSATION_POTENTIAL';

export interface DiscoveryEvidenceItem {
  type: DiscoveryEvidenceType;
  title: string;
  description: string;
  weight: number;
  highlight?: string;
}

// 4.2: Discovery Candidate Presentation Safe Projection / DTO
export interface DiscoveryCandidateEvidence {
  sharedInterests: string[];
  intentMatch: string;
  culturalBridge: string;
  personalityHighlight?: string;
  relevantDifferences?: string[];
  conversationStarters: string[];
  contextScore: number;
  items?: DiscoveryEvidenceItem[];
}

export interface ContextualPrioritizationScore {
  relevance: number;             // basic profile similarity (lower weight)
  conversationPotential: number; // probability to ignite meaningful dialog (high weight)
  culturalConnection: number;    // cross-cultural bridge & lusophone synergy (high weight)
  surprise: number;              // novelty & unique complementary attributes
  diversity: number;             // cross-cultural and regional diversity
  recency: number;               // active status and freshness
  finalCompositeRank: number;
}

export interface DiscoveryCandidate {
  profile: UserProfile;
  compatibilityScore: number;
  deterministicScore: number;
  contextScore: number;
  noveltyBonus: number;
  confidence: number;
  compatibilityReasons: string[];
  compatibilityResult: CompatibilityResult;
  expansionLevel?: ExpansionLevel;
  crossCulturalHighlight?: string;
  aiExplanation?: string;
  isAiEnhanced?: boolean;

  // 3.1 & 3.3: Human Connection Graph & Structured Evidence
  discoveryReason: string;
  evidence: DiscoveryEvidenceItem[];
  connectionContext: string;
  conversationPrompt: string;
  discoveryMode: DiscoveryMode;
  evidenceDetails?: DiscoveryCandidateEvidence;
  prioritizationScore?: ContextualPrioritizationScore;
  trustBadges?: TrustBadge[];
  serendipityInsight?: string;
}

// -------------------------------------------------------------
// PONTO 1: Meaningful Connection Rate (MCR) & Connection Funnel
// 8-Stage Refined Funnel: IMPRESSION → QUALIFIED_DISCOVERY → INTENTIONAL_INTEREST → MUTUAL_INTEREST → CONVERSATION_STARTED → MEANINGFUL_RECIPROCITY → CONTINUITY → MEANINGFUL_CONNECTION
// -------------------------------------------------------------
export type MCRFunnelStage =
  | 'IMPRESSION'              // 1. Perfil/candidato exibido no feed (visualização inicial)
  | 'QUALIFIED_DISCOVERY'     // 2. Descoberta qualificada (leitura profunda de biografia, áudio, motivos)
  | 'INTENTIONAL_INTEREST'    // 3. Interesse intencional (like contextualizado, resposta a pergunta/prompt)
  | 'MUTUAL_INTEREST'         // 4. Interesse mútuo / match confirmado
  | 'CONVERSATION_STARTED'    // 5. Início de conversa (primeira mensagem enviada)
  | 'MEANINGFUL_RECIPROCITY'  // 6. Reciprocidade significativa (trocas mútuas de turnos com perguntas)
  | 'CONTINUITY'              // 7. Continuidade (diálogo mantido após 24h ou profundidade contínua)
  | 'MEANINGFUL_CONNECTION'   // 8. Conexão significativa confirmada (vínculo, áudio, troca de contactos)
  // Legacy aliases supported for backward compatibility:
  | 'DISCOVERY'
  | 'CONVERSATION_INITIATED'
  | 'RECIPROCITY';

export type DiscoveryOriginTag =
  | 'SERENDIPITY'
  | 'CULTURAL_BRIDGE'
  | 'COMPLEMENTARITY'
  | 'DEEP_CONVERSATION'
  | 'VALUES_AFFINITY'
  | 'COMMUNITY_QUESTION'
  | 'DIRECT_SEARCH';

// -------------------------------------------------------------
// PONTO 1.1: McrEventLogger Backend & Audit Persistence Types
// -------------------------------------------------------------
export interface McrAuditTrail {
  loggedAt: string; // ISO 8601 string
  timestamp: number; // numeric epoch
  serverTimestamp?: unknown; // Firestore server timestamp
  clientTimestamp?: number;
  ipOrOrigin?: string;
  userAgent?: string;
  isAudited: boolean;
  auditSource: 'mcr_backend_logger' | 'mcr_client_fallback';
  transitionIntegrity: 'VALID' | 'UNORDERED_SKIP' | 'REGRESSION' | 'INITIAL';
  stageRank: number; // 1 to 8
  environment?: string;
  sessionId?: string;
}

export interface McrAuditEvent {
  id: string;
  userId: string;
  targetUid: string;
  stage: MCRFunnelStage;
  previousStage?: MCRFunnelStage | string;
  stageRank: number;
  countryPair: [CPLPCountryCode, CPLPCountryCode];
  discoveryOrigin: DiscoveryOriginTag | string;
  communityTag?: string;
  metadata?: Record<string, unknown>;
  audit: McrAuditTrail;
  timestamp: number;
  createdAt: number;
}

export interface McrEventPayload {
  userId: string;
  targetUid: string;
  stage: MCRFunnelStage | string;
  previousStage?: MCRFunnelStage | string;
  countryPair: [CPLPCountryCode, CPLPCountryCode];
  discoveryOrigin?: string;
  communityTag?: string;
  metadata?: Record<string, unknown>;
  clientTimestamp?: number;
  sessionId?: string;
}

export interface McrAuditQueryFilters {
  userId?: string;
  targetUid?: string;
  stage?: MCRFunnelStage | string;
  origin?: string;
  timeframe?: '7d' | '30d' | 'all';
  limitCount?: number;
}

export interface ConnectionFunnelEvent {
  id: string;
  userId: string;
  targetUid: string;
  stage: MCRFunnelStage;
  timestamp: number;
  countryPair: [CPLPCountryCode, CPLPCountryCode];
  communityTag?: string;
  discoveryOrigin?: DiscoveryOriginTag | string;
  metadata?: {
    discoveryOrigin?: string;
    discoveryMode?: string;
    messageCount?: number;
    hoursActive?: number;
    icebreakerUsed?: boolean;
    communicationStyleMatch?: boolean;
    serendipityMode?: boolean;
    userRating?: number;
    rating?: number;
    revelationStep?: string;
    dwellTimeSec?: number;
  };
}

export interface MCRDiagnosticBottleneck {
  id: string;
  fromStage: MCRFunnelStage;
  toStage: MCRFunnelStage;
  stageLabel: string;
  conversionRatePercent: number;
  dropoffPercent: number;
  totalFrom: number;
  totalTo: number;
  status: 'EXEMPLARY' | 'HEALTHY' | 'WARNING' | 'CRITICAL';
  diagnosticRule: string; // e.g. "Muitas descobertas, poucos interesses → descoberta ruim"
  diagnosis: string;
  rootCauseCategory: 'DISCOVERY_QUALITY' | 'ICEBREAKER_QUALITY' | 'MATCHING_RESONANCE' | 'EXPECTATION_ALIGNMENT' | 'FERTILE_RETENTION';
  actionableRemedy: string;
}

export interface MCROriginBreakdown {
  origin: string;
  originLabel: string;
  totalImpressions: number;
  totalQualifiedDiscoveries: number;
  totalIntentionalInterests: number;
  totalMutualInterests: number;
  totalConversationsStarted: number;
  totalMeaningfulReciprocity: number;
  totalContinuity: number;
  totalMeaningfulConnections: number;
  // Legacy aliases
  totalDiscovered?: number;
  totalReciprocal?: number;
  totalContinuous?: number;
  totalMeaningful?: number;
  mcrScorePercent: number;
  reciprocityRatePercent: number;
}

export interface MCRMetrics {
  // Refined 8-stage counts
  totalImpressions: number;
  totalQualifiedDiscoveries: number;
  totalIntentionalInterests: number;
  totalMutualInterests: number;
  totalConversationsStarted: number;
  totalMeaningfulReciprocity: number;
  totalContinuity: number;
  totalMeaningfulConnections: number;

  // Legacy aliases for backward compatibility
  totalDiscovered: number;
  totalReciprocal: number;
  totalContinuous: number;
  totalMeaningful: number;

  // Primary KPIs
  mcrScorePercent: number; // (totalMeaningfulConnections / totalImpressions) * 100
  qualifiedDiscoveryRatePercent: number; // (totalQualifiedDiscoveries / totalImpressions) * 100
  interestIntentRatePercent: number; // (totalIntentionalInterests / totalQualifiedDiscoveries) * 100
  matchToConversationRatePercent: number; // (totalConversationsStarted / totalMutualInterests) * 100
  reciprocityRatePercent: number; // (totalMeaningfulReciprocity / totalConversationsStarted) * 100
  continuityRatePercent: number; // (totalContinuity / totalMeaningfulReciprocity) * 100
  meaningfulConversionRatePercent: number; // (totalMeaningfulConnections / totalContinuity) * 100

  // Diagnostics & Failure Points
  diagnostics: MCRDiagnosticBottleneck[];
  topBottleneck?: MCRDiagnosticBottleneck;
  thrivingLearnedPatterns: string[];

  calculatedAt: number;
  timeframe?: '7d' | '30d' | 'all';
  byCountryPair?: Record<string, number>;
  byCommunity?: Record<string, number>;
  byOrigin?: Record<string, MCROriginBreakdown>;
}

export interface ConnectionOutcomeLearning {
  userId: string;
  targetUid: string;
  successfulBond: boolean;
  icebreakerEffective: boolean;
  resonanceFactors: string[];
  stallStage?: MCRFunnelStage;
  learnedPreferences: {
    preferredStyles?: string[];
    complementaryBonusDelta?: number;
    depthTolerance?: 'light' | 'moderate' | 'deep';
  };
  recordedAt: number;
}

// -------------------------------------------------------------
// RELATIONAL CONDITION MEMORY (Memória sobre as Condições de Conexão Fértil)
// Unidade de valor: pessoa + contexto + comportamento + reciprocidade + resultado
// -------------------------------------------------------------
export interface RelationalConditionTuple {
  id: string;
  userId: string;
  targetUid: string;
  person: {
    userStyle: 'reflective' | 'expressive' | 'direct' | 'warm';
    targetStyle: 'reflective' | 'expressive' | 'direct' | 'warm';
    userDepth: 'light' | 'moderate' | 'deep';
    targetDepth: 'light' | 'moderate' | 'deep';
    intentMatch: boolean;
    culturalPair: [CPLPCountryCode, CPLPCountryCode];
    crossBorder: boolean;
  };
  context: {
    discoveryOrigin: string; // e.g. SERENDIPITY, CULTURAL_BRIDGE, VALUES_AFFINITY, COMMUNITY_QUESTION
    communityTag?: string;
    sharedValues: string[];
    differingInterests: string[];
    temporalMoment?: 'morning' | 'afternoon' | 'evening' | 'weekend';
  };
  behavior: {
    icebreakerType: 'question' | 'values_reflection' | 'audio_snippet' | 'direct_greeting';
    initiatorSpeedHours: number;
    responderSpeedHours: number;
    avgMessageWords: number;
    dialogueInitiative: 'balanced' | 'user_led' | 'target_led';
  };
  reciprocity: {
    turnExchangeRatio: number; // 0.0 - 1.0 (1.0 = perfect 50/50 balance)
    backAndForthTurns: number;
    questionReturnedRate: number; // 0.0 - 1.0
    sentimentResonance: number; // 0.0 - 1.0
    vulnerabilityDeepened: boolean;
  };
  outcome: {
    stage: MCRFunnelStage;
    isMeaningfulBond: boolean;
    continuityDays: number;
    stallReason?: string;
    thriveDrivers: string[];
    qualitativeFeedback?: string;
  };
  recordedAt: number;
}

export interface UserRelationalMemory {
  userId: string;
  totalConditionsAnalyzed: number;
  meaningfulBondsCount: number;
  fertileConditions: {
    topResonantStyles: ('reflective' | 'expressive' | 'direct' | 'warm')[];
    optimalDepthPreference: 'light' | 'moderate' | 'deep';
    thrivingContexts: {
      topOrigins: string[];
      crossBorderSuccessRate: number;
      idealComplementarityFormula: string; // e.g. "1-2 valores partilhados + 2 interesses complementares"
    };
    reciprocityPace: {
      idealResponseWindow: string; // e.g. "1h a 4h com desenvolvimento de ideias"
      preferredTurnBalance: 'symmetric' | 'fluid';
      effectiveIcebreakers: Record<string, number>; // e.g. { values_reflection: 0.88, question: 0.75 }
    };
    frictionTriggers: string[]; // e.g. ["Monólogos unilaterais", "Respostas curtas sem perguntas", "Quebra precoce de diálogo"]
    synthesizedInsight: string; // "As tuas conexões florescem quando..."
  };
  lastUpdated: number;
}

export interface ConditionFitnessEvaluation {
  targetUid: string;
  fitnessScore: number; // 0.0 - 1.0
  predictedSynergyLevel: 'high_probability_resonance' | 'moderate_resonance' | 'exploratory';
  fertileSignals: string[]; // Condições que combinam com a memória pessoal
  cautionFactors: string[];
  recommendedOpeningContext?: string;
  fertileReasoning?: string;
  matchedConditions?: string[];
}

// -------------------------------------------------------------
// PONTO 3: ÉNós Trust Graph (Evidence -> Backend Validation -> Private Signals -> Eligibility -> Public Badges)
// -------------------------------------------------------------
export type TrustBadgeType =
  | 'identity_verified'      // ✓ Identidade Verificada
  | 'authentic_profile'      // ✓ Perfil Autêntico
  | 'trusted_member'         // ✓ Membro Confiável
  | 'respectful_dialogue'    // ✓ Diálogo Respeitoso
  | 'active_presence';       // ✓ Presença Ativa

export type TrustEvidenceType =
  | 'national_id_verification'
  | 'passport_verification'
  | 'phone_sms_proof'
  | 'email_domain_proof'
  | 'selfie_liveness_proof'
  | 'interaction_reciprocity_proof'
  | 'clean_safety_tenure_proof'
  | 'community_contribution_proof'
  | 'moderator_manual_clearance';

export interface TrustEvidenceRecord {
  id: string;
  userId: string;
  type: TrustEvidenceType;
  source: 'system_crypto_validation' | 'backend_policy_engine' | 'admin_moderator_audit' | 'biometric_provider' | 'national_registry_verifier' | 'telecom_carrier_proof';
  status: 'verified' | 'pending' | 'rejected' | 'revoked';
  verifiedAt: number;
  expiresAt?: number;
  auditedBy?: string;
  metadata?: Record<string, unknown>;
}

export interface ImmutableTrustEvidenceRecord {
  id: string;
  userId: string;
  type: TrustEvidenceType;
  source: 'biometric_provider' | 'national_registry_verifier' | 'system_crypto_validation' | 'admin_moderator_audit' | 'telecom_carrier_proof';
  status: 'verified' | 'pending' | 'rejected' | 'revoked';
  evidenceHash: string; // SHA-256 fingerprint
  authoritySignature: string; // HMAC SHA-256 signature issued by verification authority
  verifiedAt: number;
  expiresAt?: number;
  auditedBy: string;
  verificationDetails: {
    documentType?: 'NATIONAL_ID' | 'PASSPORT' | 'DRIVING_LICENSE' | 'RESIDENCE_PERMIT';
    countryCode?: CPLPCountryCode;
    documentNumberMasked?: string;
    documentFormatValid?: boolean;
    biometricLivenessScore?: number; // 0.0 - 1.0 (e.g. 0.94)
    faceMatchParityScore?: number; // 0.0 - 1.0 (e.g. 0.96)
    antiSpoofingPassed?: boolean;
    phoneCarrierVerified?: boolean;
    safetyTenureDaysAttested?: number;
    auditedMcrConversations?: number;
    verificationNotes?: string;
  };
}

export interface VerificationSubmissionPayload {
  userId: string;
  evidenceType: TrustEvidenceType;
  documentPayload?: {
    countryCode: CPLPCountryCode;
    documentType: 'NATIONAL_ID' | 'PASSPORT' | 'DRIVING_LICENSE' | 'RESIDENCE_PERMIT';
    documentNumber: string;
    fullName: string;
    birthDate?: string;
    expiryDate?: string;
    documentFrontImageBase64?: string;
  };
  biometricPayload?: {
    selfieLivenessBase64?: string;
    livenessChallengesPassed?: string[]; // e.g. ['blink_detection', 'head_turn_left', 'smile_detection']
    captureTimestamp?: number;
    deviceSensorIntegrity?: boolean;
  };
  telecomPayload?: {
    phoneNumber: string;
    countryCode: CPLPCountryCode;
    smsVerificationCode?: string;
  };
}

export interface PrivateTrustSignals {
  userId: string;
  // Multi-dimensional private signals (NEVER exposed as a single gamified/manipulative public score)
  identityEvidenceLevel: 'none' | 'basic_phone' | 'verified_id' | 'biometric_cleared';
  profileAuthenticityLevel: 'minimal' | 'partial' | 'authentic_comprehensive';
  safetyTenureDays: number;
  confirmedSafetyViolations: number;
  activeDisputesOrFlags: number;
  reciprocalDialogueCount: number;
  meaningfulConnectionsCount: number;
  activeDaysPast30d: number;
  accountAgeDays: number;
  lastValidatedAt: number;
}

export interface TrustEligibilityPolicy {
  badgeType: TrustBadgeType;
  title: string;
  description: string;
  criteriaSummary: string;
  requiredEvidenceTypes: TrustEvidenceType[];
  minimumSafetyTenureDays: number;
  maxViolationsAllowed: number;
  requiresAdminClearance: boolean;
  publicLabel: string;
  publicDescription: string;
  dignityGuaranteed: boolean; // Anti-humiliation policy: only non-punitive, positive recognition
}

export interface TrustBadge {
  type: TrustBadgeType;
  label: string;
  description: string;
  iconName: string;
  issuedByAuthority: string;
  grantedAt: number;
}

export interface TrustVerificationRequest {
  id: string;
  userId: string;
  userName: string;
  userCountry: CPLPCountryCode;
  evidenceType: TrustEvidenceType;
  documentHash?: string;
  submittedAt: number;
  status: 'pending' | 'in_review' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewedAt?: number;
  justification?: string;
}

export interface PrivateTrustGraphEvaluation {
  userId: string;
  signals: PrivateTrustSignals;
  eligibleBadges: TrustBadge[];
  disqualifiedReasons?: string[];
  evaluatedAt: number;
  evaluatorAuthority: 'enos_backend_trust_engine' | 'cplp_moderation_board';
}

// -------------------------------------------------------------
// PONTO 4: Data Saver & CPLP Offline-Resilience Contracts (Architectural Philosophy)
// -------------------------------------------------------------
export type NetworkEffectiveType = 'slow-2g' | '2g' | '3g' | '4g' | 'unknown';
export type NetworkStateCategory = 'OFFLINE' | 'CONSTRAINED_2G' | 'BALANCED_3G' | 'HIGH_SPEED_4G';

export interface NetworkCondition {
  isOnline: boolean;
  effectiveType: NetworkEffectiveType;
  saveData: boolean; // navigator.connection.saveData (header Client Hint Save-Data)
  downlinkMbps?: number;
  rttMs?: number;
  category: NetworkStateCategory;
  isAutoAdapted: boolean;
  budgetKbTarget: number; // Target initial screen payload budget (e.g. 150 KB)
  canAutoplayMedia: boolean; // Always false on constrained networks
  supportsAvif: boolean;
  supportsWebp: boolean;
}

export interface DataSaverSettings {
  enabled: boolean;
  mode: 'auto_adaptive' | 'manual'; // Auto-adaptive recognizes network conditions seamlessly
  qualityLevel: 'ultra_low' | 'balanced' | 'high';
  autoDownloadAudio: boolean; // Default false on constrained networks
  loadThumbnailsOnly: boolean;
  offlineQueueSyncEnabled: boolean;
  avifWebpPreferred: boolean;
  progressiveProfileLoading: boolean; // First screen <150KB, secondary fields on-demand
}

export interface OfflineQueuedEvent {
  id: string;
  idempotencyKey: string; // Idempotent key to prevent double actions in Firestore
  type: 'like' | 'pass' | 'message' | 'telemetry' | 'outcome' | 'mcr_event';
  payload: Record<string, unknown>;
  enqueuedAt: number;
  retryCount: number;
  lastAttemptAt?: number;
  synced?: boolean;
}

// 4.22 & 4.23: Discovery Availability Status
export type DiscoveryAvailability =
  | 'AVAILABLE'
  | 'LOW_AVAILABILITY'
  | 'NO_CANDIDATES';

export interface DiscoveryResultMetadata {
  totalEvaluated: number;
  totalEligible: number;
  scarcityMessage?: string;
  sessionId?: string;
  timestamp: number;
}

// 2.15: DiscoveryResult encapsulating status + expansionLevel + candidates[] + metadata
export interface DiscoveryResult {
  status: DiscoveryAvailability;
  expansionLevel: ExpansionLevel;
  candidates: DiscoveryCandidate[];
  metadata: DiscoveryResultMetadata;
}

export interface DiscoveryFeedResult {
  candidates: DiscoveryCandidate[];
  availability: DiscoveryAvailability;
  currentExpansionLevel: ExpansionLevel;
  scarcityMessage?: string;
  totalEvaluated: number;
  totalEligible: number;
  result?: DiscoveryResult;
}

// 2.9: Interaction types and records with expiration/status
export type InteractionType = 'like' | 'pass' | 'block' | 'report' | 'superlike';
export type InteractionStatus = 'active' | 'expired' | 'revoked';

export interface UserInteractionRecord {
  id?: string;
  userId: string;
  targetUserId: string;
  type: InteractionType;
  createdAt: number;
  expiresAt?: number | null; // For PASS cooldown expiration
  status: InteractionStatus;
  metadata?: Record<string, unknown>;
}

// 4.15: AI Contracts
export interface AIProfileAssistant {
  generateBio(promptData: {
    interests: string[];
    intent: string;
    countryName: string;
    cityName: string;
  }): Promise<string>;
}

export interface AICompatibilityExplainer {
  explainAffinity(data: {
    userA: { displayName: string; countryName: string; cityName: string; intent: string; interests: string[] };
    userB: { displayName: string; countryName: string; cityName: string; intent: string; interests: string[] };
  }): Promise<string>;
}

export interface AIConversationAssistant {
  generateIcebreakers(context: {
    sharedInterests: string[];
    userACity: string;
    userBCity: string;
  }): Promise<string[]>;
}

export interface AIContentAssistant {
  moderate(content: string): Promise<{ isSafe: boolean; reason?: string }>;
}

// Media Storage Metadata (4.22 & 4.24)
export interface MediaMetadata {
  id: string;
  userId: string;
  url: string;
  thumbnailUrl?: string;
  mimeType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  variant: 'avatar' | 'gallery' | 'verification_id';
  createdAt: number;
}

export interface MatchInteraction {
  id?: string;
  fromUid: string;
  toUid: string;
  type: 'like' | 'pass' | 'superlike';
  compatibilityScore?: number;
  reasons?: string[];
  createdAt: number;
}

export interface MutualMatch {
  id: string;
  userA: string;
  userB: string;
  compatibilityScore: number;
  createdAt: number;
}

export interface Conversation {
  id: string;
  participantUids: string[];
  participantDetails?: {
    [uid: string]: {
      displayName: string;
      profilePhoto: string;
      countryCode: CPLPCountryCode;
      cityName?: string;
    };
  };
  participants?: {
    [uid: string]: {
      displayName: string;
      profilePhoto: string;
      countryCode: CPLPCountryCode;
      cityName?: string;
    };
  };
  lastMessageText: string;
  lastMessageTimestamp: number;
  createdAt: number;
  updatedAt: number;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderUid?: string;
  senderId?: string;
  text: string;
  imageUrl?: string;
  createdAt: number;
  status?: 'sending' | 'sent' | 'delivered' | 'read';
}

export interface AdminUser {
  id: string;
  name?: string;
  displayName?: string;
  email: string;
  phone?: string;
  role: AdminRole;
  team?: 'governance' | 'trust_safety' | 'product' | 'engineering' | 'finance' | 'operations';
  customPermissions?: AdminPermission[];
  pin: string;
  active?: boolean;
  status?: 'active' | 'inactive';
  createdBy?: string;
  createdAt: number;
  lastLoginAt?: number;
}

// 2.4: TRUST Lifecycle: Signal -> Detection -> Review -> Decision -> Action -> Audit
export type TrustSignalType = 'user_report' | 'automated_anomaly' | 'safety_heuristic' | 'manual_flag';
export type TrustSeverity = 'low' | 'medium' | 'high' | 'critical';
export type TrustReviewStatus = 'pending' | 'in_review' | 'escalated' | 'resolved';
export type TrustDecisionOutcome =
  | 'dismiss'
  | 'warning'
  | 'require_verification'
  | 'temporary_restriction'
  | 'permanent_ban';

export interface TrustSignal {
  id: string;
  reporterUid?: string;
  targetUid: string;
  type: TrustSignalType;
  category: 'harassment' | 'fake_profile' | 'inappropriate_content' | 'spam' | 'underage' | 'other';
  description: string;
  evidence?: string[];
  createdAt: number;
}

export interface TrustDetection {
  signalId: string;
  severity: TrustSeverity;
  score: number; // 0.0 - 1.0
  ruleMatches: string[];
  suggestedAction?: TrustDecisionOutcome;
  detectedAt: number;
}

export interface TrustReview {
  id: string;
  signalId: string;
  targetUid: string;
  reporterUid?: string;
  category: string;
  description: string;
  severity: TrustSeverity;
  status: TrustReviewStatus;
  assignedModeratorId?: string;
  assignedModeratorName?: string;
  detection?: TrustDetection;
  createdAt: number;
  updatedAt: number;
}

export interface TrustDecision {
  id: string;
  reviewId: string;
  targetUid: string;
  outcome: TrustDecisionOutcome;
  justification: string;
  decidedBy: string;
  decidedByRole: AdminRole;
  decidedAt: number;
  expiryTimestamp?: number;
}

export interface TrustActionExecution {
  id: string;
  decisionId: string;
  targetUid: string;
  actionTaken: string;
  executedBy: string;
  executedAt: number;
  status: 'applied' | 'reverted' | 'failed';
}

// 2.6: PRODUCT Feature Flags & Progressive Rollout
export interface ProductFeatureFlag {
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  rolloutPercentage: number; // 0 to 100
  allowedCohorts: ('all' | 'verified_only' | 'early_adopters' | 'beta_testers')[];
  allowedCountries: CPLPCountryCode[];
  tags: string[];
  updatedAt: number;
  updatedBy: string;
}

// 2.7: ENGINEERING Operational Observability (Non-substitute for cloud infra)
export interface EngineeringMetricPoint {
  timestamp: number;
  latencyP95Ms: number;
  errorRatePercent: number;
  activeSessions: number;
  discoveryThroughputPerMin: number;
  memoryUsagePercent: number;
}

export interface EngineeringHealthStatus {
  status: 'healthy' | 'degraded' | 'incident';
  uptimePercentage30d: number;
  activeAppVersion: string;
  lastDeploymentTimestamp: number;
  liveMetrics: EngineeringMetricPoint;
  systemAlerts: {
    id: string;
    level: 'info' | 'warning' | 'critical';
    service: string;
    message: string;
    timestamp: number;
  }[];
}

// 2.8: INTEGRATIONS Supplier Contracts & Adapters
export interface IntegrationAdapterContract {
  id: string;
  name: string;
  category: 'payment_gateway' | 'sms_verification' | 'email_delivery' | 'object_storage' | 'ai_inference';
  adapterKey: string;
  status: 'connected' | 'degraded' | 'offline';
  averageLatencyMs: number;
  rateLimitUsagePercent: number;
  lastHeartbeat: number;
  supportedRegions: CPLPCountryCode[];
}

// 2.9: FINANCE Metrics & Reconciliation (Decoupled from Integrations)
export interface FinanceTransaction {
  id: string;
  userId: string;
  amountEur: number;
  countryCode: CPLPCountryCode;
  type: 'subscription' | 'boost' | 'refund' | 'payout';
  status: 'settled' | 'pending' | 'failed';
  currency: 'EUR' | 'AOA' | 'BRL' | 'MZN' | 'CVE';
  createdAt: number;
}

export interface FinanceLedger {
  mrrEur: number;
  totalRevenueEur30d: number;
  activeSubscriptionsCount: number;
  refundRatePercent: number;
  arpuEur: number;
  countryRevenuesEur: Record<CPLPCountryCode, number>;
  recentTransactions: FinanceTransaction[];
}

// 2.10: TASKS Explicit Lifecycle: OPEN -> ASSIGNED -> IN_PROGRESS -> RESOLVED -> CLOSED
export type AdminTaskState = 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

export interface AdminTask {
  id: string;
  title: string;
  description: string;
  category: 'trust' | 'engineering' | 'product' | 'finance' | 'governance' | 'general';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  state: AdminTaskState;
  assigneeId?: string;
  assigneeName?: string;
  createdBy: string;
  createdByName: string;
  createdAt: number;
  updatedAt: number;
  resolvedAt?: number;
  closedAt?: number;
  comments?: {
    id: string;
    authorId: string;
    authorName: string;
    text: string;
    timestamp: number;
  }[];
}

// 2.14: AUDIT Structured Audit Entry
export interface AdminAuditEntry {
  id: string;
  actorId: string;
  actorDisplayName: string;
  actorRole: AdminRole;
  module: 'rbac' | 'trust' | 'product' | 'engineering' | 'integrations' | 'finance' | 'tasks' | 'settings';
  resourceType: string;
  resourceId: string;
  action: string;
  previousState?: unknown;
  newState?: unknown;
  justification?: string;
  ipOrContext?: string;
  timestamp: number;
}

export interface CPLPCountryInfo {
  code: CPLPCountryCode;
  name: string;
  flag: string;
  capital: string;
  demonym: string;
  majorCities: string[];
}

