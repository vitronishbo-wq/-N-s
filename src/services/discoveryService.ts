import {
  UserProfile,
  UserPreferences,
  PrivacySettings,
  InteractionSignals,
  DiscoveryCandidate,
  DiscoveryFeedResult,
  DiscoveryAvailability,
  ExpansionLevel,
  DiscoveryContext,
  CompatibilityResult,
  RelationshipIntent,
  Conversation,
  ChatMessage
} from '../types';
import { CandidateDiversityGuard, defaultDiversityGuard } from './diversityGuard';
import { DiscoveryExpansionPolicy, defaultExpansionPolicy } from './expansionPolicy';
import { recordSignalEvent } from './signals';
import { db, doc, setDoc } from '../firebase/config';

export interface AffinityWeightConfig {
  intentExact: number;
  intentHigh: number;
  intentCompatible: number;
  sharedInterestPoints: number;
  maxInterestPoints: number;
  sameCityBonus: number;
  sameCountryBonus: number;
  crossCulturalBaseBonus: number;
  dynamicCountryAffinityFactor: number;
  maxCountryAffinityBonus: number;
  verifiedBonus: number;
  onlineBonus: number;
  bioBonus: number;
  noveltyCrossCountryFirstBoost: number;
  clusterDeprioritizationPenalty: number;
}

export const DEFAULT_AFFINITY_WEIGHTS: AffinityWeightConfig = {
  intentExact: 25,
  intentHigh: 18,
  intentCompatible: 16,
  sharedInterestPoints: 6,
  maxInterestPoints: 20,
  sameCityBonus: 12,
  sameCountryBonus: 10,
  crossCulturalBaseBonus: 10,
  dynamicCountryAffinityFactor: 1.5,
  maxCountryAffinityBonus: 4,
  verifiedBonus: 4,
  onlineBonus: 3,
  bioBonus: 3,
  noveltyCrossCountryFirstBoost: 3,
  clusterDeprioritizationPenalty: -3
};

export interface IDiscoveryEngine {
  collectCandidates(pool: UserProfile[]): UserProfile[];
  checkEligibility(
    candidate: UserProfile,
    myProfile: UserProfile,
    myPrefs: UserPreferences,
    privacySettings: PrivacySettings,
    signals: InteractionSignals,
    context?: Partial<DiscoveryContext>
  ): boolean;
  calculateCompatibility(
    candidate: UserProfile,
    myProfile: UserProfile,
    myPrefs: UserPreferences,
    context?: Partial<DiscoveryContext>,
    customWeights?: Partial<AffinityWeightConfig>
  ): {
    score: number;
    deterministicScore: number;
    reasons: string[];
    compatibilityResult: CompatibilityResult;
  };
  calculateContext(
    candidate: UserProfile,
    signals: InteractionSignals,
    customWeights?: Partial<AffinityWeightConfig>
  ): {
    contextScore: number;
    countryAffinityBonus: number;
    confidence: number;
  };
  diversifyCandidates(
    candidates: DiscoveryCandidate[],
    myProfile: UserProfile,
    myPrefs: UserPreferences,
    customWeights?: Partial<AffinityWeightConfig>
  ): DiscoveryCandidate[];
  rankCandidates(candidates: DiscoveryCandidate[]): DiscoveryCandidate[];
  buildDiscoveryCandidate(
    candidate: UserProfile,
    compatibility: ReturnType<IDiscoveryEngine['calculateCompatibility']>,
    contextResult: ReturnType<IDiscoveryEngine['calculateContext']>,
    noveltyBonus?: number,
    expansionLevel?: ExpansionLevel
  ): DiscoveryCandidate;
  executePipeline(
    pool: UserProfile[],
    myProfile: UserProfile,
    myPrefs: UserPreferences,
    privacySettings: PrivacySettings,
    signals: InteractionSignals,
    context?: Partial<DiscoveryContext>,
    customWeights?: Partial<AffinityWeightConfig>
  ): DiscoveryCandidate[];
  generateDiscoveryFeed(
    pool: UserProfile[],
    myProfile: UserProfile,
    myPrefs: UserPreferences,
    privacySettings: PrivacySettings,
    signals: InteractionSignals,
    context?: Partial<DiscoveryContext>
  ): DiscoveryFeedResult;
}

/**
 * DiscoveryEngine
 * Isolates core discovery and business logic from the UI:
 * - Candidate collection & progressive expansion
 * - Strict eligibility checking (blocking, reporting, passed/liked filters, incognito/privacy)
 * - Deterministic compatibility & dynamic country affinity scoring
 * - Safe DTO projection to DiscoveryCandidate
 * - Interleaved diversity guard & rank calculation
 * - Multi-stage availability states (AVAILABLE, LOW_AVAILABILITY, NO_CANDIDATES)
 */
export class DiscoveryEngine implements IDiscoveryEngine {
  private weights: AffinityWeightConfig;
  private diversityGuard: CandidateDiversityGuard;
  private expansionPolicy: DiscoveryExpansionPolicy;

  constructor(
    customWeights?: Partial<AffinityWeightConfig>,
    diversityGuard: CandidateDiversityGuard = defaultDiversityGuard,
    expansionPolicy: DiscoveryExpansionPolicy = defaultExpansionPolicy
  ) {
    this.weights = { ...DEFAULT_AFFINITY_WEIGHTS, ...customWeights };
    this.diversityGuard = diversityGuard;
    this.expansionPolicy = expansionPolicy;
  }

  // 1. Collect
  public collectCandidates(pool: UserProfile[]): UserProfile[] {
    return Array.isArray(pool) ? [...pool] : [];
  }

  // 2. Check Eligibility (Excludes profile owner, bilateral blocks, past active likes, pass cooldowns, privacy-hidden, cross-cultural restrictions, and preference filters)
  public checkEligibility(
    candidate: UserProfile,
    myProfile: UserProfile,
    myPrefs: UserPreferences,
    privacySettings: PrivacySettings,
    signals: InteractionSignals,
    context?: Partial<DiscoveryContext>
  ): boolean {
    if (!candidate || !candidate.uid) return false;

    // 1. Filter out Profile Owner (Profile = quem sou)
    if (candidate.uid === myProfile.uid || (privacySettings && candidate.uid === privacySettings.uid)) {
      return false;
    }

    // 2. BLOCK produces bilateral exclusion
    if (signals.blockedUids && signals.blockedUids.includes(candidate.uid)) {
      return false;
    }

    // Excluded or already seen in current active session context
    if (context?.excludeUids && context.excludeUids.includes(candidate.uid)) {
      return false;
    }
    if (context?.seenInSessionUids && context.seenInSessionUids.includes(candidate.uid)) {
      return false;
    }

    // 3. LIKE prevents redundant re-presentation while active
    if (signals.likedCandidateUids && signals.likedCandidateUids.includes(candidate.uid)) {
      return false;
    }

    // 4. PASS utilizes cooldown (allowing controlled future reappearance after cooldown expires)
    const now = context?.currentTime ?? Date.now();
    const passCooldownMs = context?.recentlySeenWindowMs ?? 1000 * 60 * 60 * 24; // 24h default cooldown window
    if (signals.passedCandidateUids && signals.passedCandidateUids.includes(candidate.uid)) {
      const lastPassedAt =
        signals.passedTimestamps?.[candidate.uid] ??
        signals.recentlySeenTimestamps?.[candidate.uid];
      if (lastPassedAt && now - lastPassedAt < passCooldownMs) {
        return false; // Still within pass cooldown period
      }
    }

    // 5. Filter out candidates who do not meet visibility requirements (PrivacySettings = como posso aparecer)
    if (candidate.visibility === 'hidden') {
      return false;
    }

    // 6. Recently seen cooldown window
    const lastSeenTime = signals.recentlySeenTimestamps?.[candidate.uid];
    if (lastSeenTime && now - lastSeenTime < passCooldownMs) {
      // If candidate was recently seen and not eligible to re-show in this window
      if (!signals.passedCandidateUids?.includes(candidate.uid)) {
        return false;
      }
    }

    // 7. Preferences: Age bounds (Preferences = quem procuro)
    if (candidate.age < myPrefs.minAge || candidate.age > myPrefs.maxAge) {
      return false;
    }

    // 8. Preferences: Gender preferences
    if (myPrefs.genders && myPrefs.genders.length > 0) {
      if (!myPrefs.genders.includes(candidate.gender)) {
        return false;
      }
    }

    // 9. Preferences: Cross-cultural matching (exclusively in Preferences)
    if (!myPrefs.crossCultural) {
      // If crossCultural is disabled in Preferences, candidate must be from same country
      if (candidate.countryCode !== myProfile.countryCode) {
        return false;
      }
    } else if (myPrefs.countries && myPrefs.countries.length > 0) {
      const allowedCountries = new Set<string>(myPrefs.countries);
      if (!allowedCountries.has(candidate.countryCode)) {
        return false;
      }
    }

    // 10. Preferences: Verified only constraint
    if (myPrefs.verifiedOnly && candidate.verificationStatus !== 'verified') {
      return false;
    }

    return true;
  }

  // 3. Compatibility Calculation (Deterministic)
  public calculateCompatibility(
    candidate: UserProfile,
    myProfile: UserProfile,
    myPrefs: UserPreferences,
    _context?: Partial<DiscoveryContext>,
    customWeights?: Partial<AffinityWeightConfig>
  ): {
    score: number;
    deterministicScore: number;
    reasons: string[];
    compatibilityResult: CompatibilityResult;
  } {
    const w = { ...this.weights, ...customWeights };
    let deterministicScore = 40;
    const reasons: string[] = [];

    // Intent Alignment
    let intentAlignment: CompatibilityResult['intentAlignment'] = 'neutral';
    if (myProfile.intent === candidate.intent) {
      intentAlignment = 'exact';
      deterministicScore += w.intentExact;
      reasons.push(`Ambos procuram ${getIntentLabel(myProfile.intent)}`);
    } else if (
      (myProfile.intent === 'serious' && candidate.intent === 'dating') ||
      (myProfile.intent === 'dating' && candidate.intent === 'serious')
    ) {
      intentAlignment = 'high';
      deterministicScore += w.intentHigh;
      reasons.push('Intenções de relacionamento altamente compatíveis');
    } else if (
      (myProfile.intent === 'serious' && candidate.intent === 'marriage') ||
      (myProfile.intent === 'marriage' && candidate.intent === 'serious')
    ) {
      intentAlignment = 'high';
      deterministicScore += w.intentHigh;
      reasons.push('Foco mútuo em construir compromisso duradouro');
    } else if (
      (myProfile.intent === 'friendship' && candidate.intent === 'meet_people') ||
      (myProfile.intent === 'meet_people' && candidate.intent === 'friendship')
    ) {
      intentAlignment = 'compatible';
      deterministicScore += w.intentCompatible;
      reasons.push('Abertura mútua para expandir amizades na comunidade');
    } else {
      intentAlignment = 'neutral';
      deterministicScore += 6;
    }

    // Shared Interests
    const sharedInterests = (myProfile.interests || []).filter(i =>
      (candidate.interests || []).includes(i)
    );
    if (sharedInterests.length > 0) {
      const points = Math.min(sharedInterests.length * w.sharedInterestPoints, w.maxInterestPoints);
      deterministicScore += points;
      const sample = sharedInterests.slice(0, 3).join(' e ');
      reasons.push(`Interesses em comum: ${sample}`);
    }

    // Proximity & Cultural Connection
    let culturalConnection: CompatibilityResult['culturalConnection'] = 'cross_cultural_cplp';
    let crossCulturalHighlight: string | undefined;

    const isSameCountry = myProfile.countryCode === candidate.countryCode;
    const isSameCity =
      isSameCountry &&
      !!myProfile.cityName &&
      !!candidate.cityName &&
      myProfile.cityName.trim().toLowerCase() === candidate.cityName.trim().toLowerCase();

    if (isSameCity) {
      culturalConnection = 'same_city';
      deterministicScore += w.sameCityBonus;
      reasons.push(`Mesma cidade (${myProfile.cityName})`);
    } else if (isSameCountry) {
      culturalConnection = 'same_country';
      deterministicScore += w.sameCountryBonus;
      reasons.push(`Mesmo país (${myProfile.countryName})`);
    } else {
      culturalConnection = 'cross_cultural_cplp';
      if (myPrefs.crossCultural) {
        deterministicScore += w.crossCulturalBaseBonus;
        crossCulturalHighlight = `Sintonia intercultural (${myProfile.countryName} ↔ ${candidate.countryName})`;
        reasons.push(crossCulturalHighlight);
      } else {
        deterministicScore += 4;
        reasons.push(`Irmandade lusófona (${myProfile.countryName} & ${candidate.countryName})`);
      }
    }

    // Age Proximity
    const ageDiff = Math.abs(myProfile.age - candidate.age);
    if (ageDiff <= 2) deterministicScore += 6;
    else if (ageDiff <= 5) deterministicScore += 4;
    else if (ageDiff <= 8) deterministicScore += 2;

    if (reasons.length === 0) {
      reasons.push('Afinidade natural na comunidade lusófona');
    }

    const discoveryDistance = isSameCity
      ? 'Local (Mesma cidade)'
      : isSameCountry
      ? 'Nacional'
      : 'Comunidade CPLP';

    const finalScore = Math.min(Math.max(deterministicScore, 50), 99);

    return {
      score: finalScore,
      deterministicScore,
      reasons,
      compatibilityResult: {
        score: finalScore,
        reasons,
        sharedInterests,
        intentAlignment,
        culturalConnection,
        discoveryDistance,
        confidence: 0.85,
        crossCulturalHighlight
      }
    };
  }

  // 4. Context & Dynamic Country Affinity
  public calculateContext(
    candidate: UserProfile,
    signals: InteractionSignals,
    customWeights?: Partial<AffinityWeightConfig>
  ): {
    contextScore: number;
    countryAffinityBonus: number;
    confidence: number;
  } {
    const w = { ...this.weights, ...customWeights };
    let contextScore = 0;
    let confidence = 0.85;

    if (candidate.verificationStatus === 'verified') {
      contextScore += w.verifiedBonus;
      confidence += 0.05;
    }
    if (candidate.online) {
      contextScore += w.onlineBonus;
    }
    if (candidate.profilePhoto && candidate.bio && candidate.bio.length > 20) {
      contextScore += w.bioBonus;
    }

    // CountryAffinity calculated from actual historical interactions
    const likedInThisCountry = signals.likedCountries?.[candidate.countryCode] || 0;
    const skippedInThisCountry = signals.skippedCountries?.[candidate.countryCode] || 0;
    const netAffinity = Math.max(likedInThisCountry - skippedInThisCountry * 0.5, 0);
    const countryAffinityBonus = Math.min(
      netAffinity * w.dynamicCountryAffinityFactor,
      w.maxCountryAffinityBonus
    );

    return {
      contextScore,
      countryAffinityBonus,
      confidence: Math.min(confidence, 0.99)
    };
  }

  // 5. Safe DiscoveryCandidate Projection
  public buildDiscoveryCandidate(
    candidate: UserProfile,
    compatibility: ReturnType<IDiscoveryEngine['calculateCompatibility']>,
    contextResult: ReturnType<IDiscoveryEngine['calculateContext']>,
    noveltyBonus: number = 0,
    expansionLevel?: ExpansionLevel
  ): DiscoveryCandidate {
    const totalScore = Math.min(
      Math.max(
        compatibility.deterministicScore +
          contextResult.contextScore +
          contextResult.countryAffinityBonus +
          noveltyBonus,
        50
      ),
      99
    );

    return {
      profile: candidate,
      compatibilityScore: totalScore,
      deterministicScore: compatibility.deterministicScore + contextResult.countryAffinityBonus,
      contextScore: contextResult.contextScore,
      noveltyBonus,
      confidence: contextResult.confidence,
      compatibilityReasons: compatibility.reasons,
      expansionLevel,
      compatibilityResult: {
        ...compatibility.compatibilityResult,
        score: totalScore
      },
      crossCulturalHighlight: compatibility.compatibilityResult.crossCulturalHighlight
    };
  }

  // 6. Diversify Candidates
  public diversifyCandidates(
    candidates: DiscoveryCandidate[],
    myProfile: UserProfile,
    myPrefs: UserPreferences
  ): DiscoveryCandidate[] {
    const balanced = this.diversityGuard.balanceDiversity(candidates, myProfile, myPrefs);
    return this.diversityGuard.interleaveFeed(balanced);
  }

  // 7. Rank Candidates
  public rankCandidates(candidates: DiscoveryCandidate[]): DiscoveryCandidate[] {
    return [...candidates].sort((a, b) => b.compatibilityScore - a.compatibilityScore);
  }

  // Complete Pipeline Execution
  public executePipeline(
    pool: UserProfile[],
    myProfile: UserProfile,
    myPrefs: UserPreferences,
    privacySettings: PrivacySettings,
    signals: InteractionSignals,
    context?: Partial<DiscoveryContext>,
    customWeights?: Partial<AffinityWeightConfig>
  ): DiscoveryCandidate[] {
    const collected = this.collectCandidates(pool);

    const eligible = collected.filter(candidate =>
      this.checkEligibility(candidate, myProfile, myPrefs, privacySettings, signals, context)
    );

    const rawCandidates: DiscoveryCandidate[] = eligible.map(candidate => {
      const compat = this.calculateCompatibility(candidate, myProfile, myPrefs, context, customWeights);
      const ctx = this.calculateContext(candidate, signals, customWeights);
      return this.buildDiscoveryCandidate(candidate, compat, ctx, 0, context?.currentExpansionLevel);
    });

    const diversified = this.diversifyCandidates(rawCandidates, myProfile, myPrefs);
    return this.rankCandidates(diversified);
  }

  // Generate complete feed with progressive expansion and availability state
  public generateDiscoveryFeed(
    pool: UserProfile[],
    myProfile: UserProfile,
    myPrefs: UserPreferences,
    privacySettings: PrivacySettings,
    signals: InteractionSignals,
    context?: Partial<DiscoveryContext>
  ): DiscoveryFeedResult {
    const totalEvaluated = pool.length;

    // Check expansion requirement
    const expansionResult = this.expansionPolicy.evaluateExpansion(
      pool,
      myProfile,
      myPrefs,
      context?.threshold || 3
    );

    const candidates = this.executePipeline(
      expansionResult.candidates,
      myProfile,
      myPrefs,
      privacySettings,
      signals,
      {
        ...context,
        currentExpansionLevel: expansionResult.level
      }
    );

    const totalEligible = candidates.length;

    let availability: DiscoveryAvailability = 'AVAILABLE';
    let scarcityMessage: string | undefined;

    if (totalEligible === 0) {
      availability = 'NO_CANDIDATES';
      scarcityMessage = !myPrefs.crossCultural
        ? 'Dica: Ative a Conexão Intercultural nas preferências para descobrir perfis dos outros 8 países lusófonos.'
        : 'Você já visualizou todos os perfis compatíveis com os seus filtros atuais.';
    } else if (totalEligible < 3) {
      availability = 'LOW_AVAILABILITY';
      scarcityMessage = 'Poucos perfis restantes na sua seleção. Expandindo para conexões irmãs da lusofonia.';
    }

    const discoveryResult = {
      status: availability,
      expansionLevel: expansionResult.level,
      candidates,
      metadata: {
        totalEvaluated,
        totalEligible,
        scarcityMessage,
        sessionId: context?.sessionId,
        timestamp: Date.now()
      }
    };

    return {
      candidates,
      availability,
      currentExpansionLevel: expansionResult.level,
      scarcityMessage,
      totalEvaluated,
      totalEligible,
      result: discoveryResult
    };
  }
}

export const defaultDiscoveryEngine = new DiscoveryEngine();

export interface DiscoveryState {
  candidates: DiscoveryCandidate[];
  currentIndex: number;
  isLoading: boolean;
  availability: DiscoveryAvailability;
  currentExpansionLevel: ExpansionLevel;
  scarcityMessage?: string;
  sessionId: string;
}

/**
 * DiscoveryAppService
 * Manages discovery session lifecycle, session-aware seen candidates, pre-loading,
 * and high-performance user actions.
 */
export class DiscoveryAppService {
  private static instance: DiscoveryAppService;
  private currentSessionId: string = 'session_' + Date.now();
  private seenInSessionUids: Set<string> = new Set();
  private preloadedImages: Set<string> = new Set();

  private constructor() {}

  public static getInstance(): DiscoveryAppService {
    if (!DiscoveryAppService.instance) {
      DiscoveryAppService.instance = new DiscoveryAppService();
    }
    return DiscoveryAppService.instance;
  }

  public getSessionId(): string {
    return this.currentSessionId;
  }

  public resetSession(): void {
    this.currentSessionId = 'session_' + Date.now();
    this.seenInSessionUids.clear();
  }

  public markSeenInSession(uid: string): void {
    this.seenInSessionUids.add(uid);
  }

  public getSeenInSessionUids(): string[] {
    return Array.from(this.seenInSessionUids);
  }

  // 2.14: Light-First: loads only primary media for the first candidate and optionally thumbnail of the next
  public preloadCandidateMedia(candidates: DiscoveryCandidate[]): void {
    if (typeof window === 'undefined' || !Array.isArray(candidates) || candidates.length === 0) return;
    
    // First candidate: primary photo
    const first = candidates[0];
    if (first?.profile?.profilePhoto && !this.preloadedImages.has(first.profile.profilePhoto)) {
      this.preloadedImages.add(first.profile.profilePhoto);
      try {
        const img = new Image();
        img.src = first.profile.profilePhoto;
      } catch {}
    }

    // Next candidate (optional thumbnail)
    const second = candidates[1];
    const secondThumb = second?.profile?.profileThumbnail || second?.profile?.profilePhoto;
    if (secondThumb && !this.preloadedImages.has(secondThumb)) {
      this.preloadedImages.add(secondThumb);
      try {
        const thumb = new Image();
        thumb.src = secondThumb;
      } catch {}
    }
  }

  public evaluateDiscoveryFeed(
    pool: UserProfile[],
    myProfile: UserProfile,
    myPrefs: UserPreferences,
    privacy: PrivacySettings,
    signals: InteractionSignals
  ): DiscoveryState {
    const feedResult: DiscoveryFeedResult = defaultDiscoveryEngine.generateDiscoveryFeed(
      pool,
      myProfile,
      myPrefs,
      privacy,
      signals,
      {
        sessionId: this.currentSessionId,
        currentTime: Date.now(),
        userCountryCode: myProfile.countryCode,
        userCityName: myProfile.cityName,
        allowCrossCultural: myPrefs.crossCultural,
        seenInSessionUids: this.getSeenInSessionUids(),
        threshold: 3
      }
    );

    // Light-First single/next thumbnail preload
    this.preloadCandidateMedia(feedResult.candidates);

    return {
      candidates: feedResult.candidates,
      currentIndex: 0,
      isLoading: false,
      availability: feedResult.availability,
      currentExpansionLevel: feedResult.currentExpansionLevel,
      scarcityMessage: feedResult.scarcityMessage,
      sessionId: this.currentSessionId
    };
  }

  public async processLikeAction(
    targetCandidate: DiscoveryCandidate,
    myProfile: UserProfile,
    signals: InteractionSignals,
    onSuccessConversation?: (convo: Conversation, initialMsg: ChatMessage) => void
  ): Promise<{ updatedSignals: InteractionSignals; conversation?: Conversation }> {
    const target = targetCandidate.profile;
    this.markSeenInSession(target.uid);

    let updatedSignals = recordSignalEvent(signals, {
      type: 'like',
      targetUid: target.uid,
      countryCode: target.countryCode,
      interests: target.interests
    });

    const isFirstConnection = !updatedSignals.firstConnectionMoment;
    if (isFirstConnection) {
      updatedSignals = recordSignalEvent(updatedSignals, {
        type: 'firstMatch',
        targetUid: target.uid
      });
    }

    const convoId = `convo_${[myProfile.uid, target.uid].sort().join('_')}`;
    const newConvo: Conversation = {
      id: convoId,
      participantUids: [myProfile.uid, target.uid],
      participants: {
        [myProfile.uid]: {
          displayName: myProfile.displayName,
          profilePhoto: myProfile.profilePhoto,
          cityName: myProfile.cityName,
          countryCode: myProfile.countryCode
        },
        [target.uid]: {
          displayName: target.displayName,
          profilePhoto: target.profilePhoto,
          cityName: target.cityName,
          countryCode: target.countryCode
        }
      },
      lastMessageText: `Sintonia Lusófona (${targetCandidate.compatibilityScore}%)`,
      lastMessageTimestamp: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const initialMsg: ChatMessage = {
      id: 'msg_welcome_' + Date.now(),
      conversationId: convoId,
      senderId: target.uid,
      text: `Olá, ${myProfile.displayName}! Adorei ver nossa sintonia com ${target.cityName}. Vamos conversar? 🌍✨`,
      createdAt: Date.now(),
      status: 'delivered'
    };

    if (onSuccessConversation) {
      onSuccessConversation(newConvo, initialMsg);
    }

    try {
      await setDoc(doc(db, 'conversations', convoId), newConvo);
    } catch (e) {
      console.info('Optimized background sync notice:', e);
    }

    return { updatedSignals, conversation: newConvo };
  }

  public processPassAction(
    targetCandidate: DiscoveryCandidate,
    signals: InteractionSignals
  ): InteractionSignals {
    this.markSeenInSession(targetCandidate.profile.uid);
    return recordSignalEvent(signals, {
      type: 'pass',
      targetUid: targetCandidate.profile.uid,
      countryCode: targetCandidate.profile.countryCode
    });
  }

  public processBlockAction(
    targetCandidate: DiscoveryCandidate,
    signals: InteractionSignals
  ): InteractionSignals {
    this.markSeenInSession(targetCandidate.profile.uid);
    return recordSignalEvent(signals, {
      type: 'block',
      targetUid: targetCandidate.profile.uid
    });
  }

  public processReportAction(
    targetCandidate: DiscoveryCandidate,
    signals: InteractionSignals
  ): InteractionSignals {
    this.markSeenInSession(targetCandidate.profile.uid);
    return recordSignalEvent(signals, {
      type: 'report',
      targetUid: targetCandidate.profile.uid
    });
  }
}

export function runDiscoveryPipeline(
  candidatePool: UserProfile[],
  myProfile: UserProfile,
  myPrefs: UserPreferences,
  privacySettings: PrivacySettings,
  signals: InteractionSignals,
  context?: Partial<DiscoveryContext>
): DiscoveryCandidate[] {
  return defaultDiscoveryEngine.executePipeline(
    candidatePool,
    myProfile,
    myPrefs,
    privacySettings,
    signals,
    context
  );
}

export function filterEligibleCandidates(
  candidatePool: UserProfile[],
  myProfile: UserProfile,
  myPrefs: UserPreferences,
  privacySettings: PrivacySettings,
  signals: InteractionSignals,
  context?: Partial<DiscoveryContext>
): UserProfile[] {
  return defaultDiscoveryEngine
    .collectCandidates(candidatePool)
    .filter(c =>
      defaultDiscoveryEngine.checkEligibility(c, myProfile, myPrefs, privacySettings, signals, context)
    );
}

export function calculateDeterministicCompatibility(
  myProfile: UserProfile,
  myPrefs: UserPreferences,
  targetProfile: UserProfile,
  context?: Partial<DiscoveryContext>
) {
  const compat = defaultDiscoveryEngine.calculateCompatibility(targetProfile, myProfile, myPrefs, context);
  const ctx = defaultDiscoveryEngine.calculateContext(targetProfile, {
    uid: myProfile.uid,
    seenCandidateUids: [],
    recentlySeenTimestamps: {},
    likedCandidateUids: [],
    passedCandidateUids: [],
    blockedUids: [],
    reportedUids: [],
    likedCountries: {},
    skippedCountries: {},
    likedInterests: {},
    conversationStarts: 0,
    meaningfulInteractions: 0,
    totalLikesGiven: 0,
    totalPassesGiven: 0,
    isActivated: false,
    lastActiveTimestamp: Date.now()
  });

  return {
    score: compat.score,
    deterministicScore: compat.deterministicScore,
    contextScore: ctx.contextScore,
    noveltyBonus: 0,
    confidence: ctx.confidence,
    reasons: compat.reasons,
    compatibilityResult: compat.compatibilityResult
  };
}

export function getIntentLabel(intent: RelationshipIntent): string {
  switch (intent) {
    case 'serious':
      return 'Relacionamento Sério';
    case 'dating':
      return 'Namoro';
    case 'marriage':
      return 'Casamento';
    case 'friendship':
      return 'Amizade';
    case 'meet_people':
      return 'Conhecer Pessoas';
    default:
      return 'Conexão';
  }
}
