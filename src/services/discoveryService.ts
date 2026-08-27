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
  ChatMessage,
  ContextualPrioritizationScore,
  DiscoveryMode,
  DiscoveryEvidenceItem,
  DiscoveryEvidenceType,
  DiscoveryCandidateEvidence,
  TrustBadge
} from '../types';
import { CandidateDiversityGuard, defaultDiversityGuard } from './diversityGuard';
import { DiscoveryExpansionPolicy, defaultExpansionPolicy } from './expansionPolicy';
import { recordSignalEvent } from './signals';
import { connectionGraph } from './connectionGraph';
import { relationalMemory } from './relationalMemory';
import { trustGraph } from './trustGraph';
import { dataSaver } from './dataSaverService';
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

  // 5. Safe DiscoveryCandidate Projection with Evidence Deconstruction (3.1, 3.2, 3.3)
  public buildDiscoveryCandidate(
    candidate: UserProfile,
    compatibility: ReturnType<IDiscoveryEngine['calculateCompatibility']>,
    contextResult: ReturnType<IDiscoveryEngine['calculateContext']>,
    noveltyBonus: number = 0,
    expansionLevel?: ExpansionLevel,
    myProfile?: UserProfile
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

    // 3.2 & 3.3: Extract concrete real-profile evidence
    const myInterests = myProfile?.interests || [];
    const candidateInterests = candidate.interests || [];
    const sharedInterests = candidateInterests.filter(i => myInterests.includes(i));
    const differentInterests = candidateInterests.filter(i => !myInterests.includes(i));
    const isCrossCountry = myProfile && myProfile.countryCode !== candidate.countryCode;
    const isSameCity = myProfile && myProfile.cityName === candidate.cityName;

    const intentMatch = myProfile && myProfile.intent === candidate.intent
      ? 'Intenções sincronizadas (' + (candidate.intent === 'serious' ? 'Relacionamento Sério' : candidate.intent === 'dating' ? 'Encontros' : 'Conexão Autêntica') + ')'
      : 'Intenções complementares e abertas à convivência genuína';

    const culturalBridge = isSameCity
      ? `Partilham a mesma vivência local em ${candidate.cityName}`
      : isCrossCountry
        ? `Ponte lusófona transatlântica viva entre ${myProfile?.cityName || 'Lusofonia'} e ${candidate.cityName}`
        : `Partilham a mesma vivência nacional em ${candidate.cityName}`;

    const personalityHighlight = candidate.bio && candidate.bio.trim().length > 0
      ? `"${candidate.bio.slice(0, 90)}${candidate.bio.length > 90 ? '...' : ''}"`
      : 'Presença tranquila focada em partilha e valores partilhados.';

    // Generate grounded conversation starters
    const conversationStarters: string[] = [];
    if (sharedInterests.length > 0) {
      conversationStarters.push(`Fiquei curioso(a) com a tua afinidade com ${sharedInterests.slice(0, 2).join(' e ')}.`);
    }
    if (candidate.cityName) {
      conversationStarters.push(`Como é o teu dia a dia e vivência em ${candidate.cityName}?`);
    }
    if (differentInterests.length > 0) {
      conversationStarters.push(`Adoraria saber mais sobre o teu interesse por ${differentInterests[0]}.`);
    }
    if (conversationStarters.length === 0) {
      conversationStarters.push(`Olá! Notei a nossa sintonia em valores e vivências na Lusofonia.`);
    }

    // 3.3: Construct Structured Evidence Items across 5 Dimensions
    const structuredEvidence: DiscoveryEvidenceItem[] = [];

    // 1. Similarity (Afinidade em Interesses & Intenção)
    if (sharedInterests.length > 0 || (myProfile && myProfile.intent === candidate.intent)) {
      structuredEvidence.push({
        type: 'SIMILARITY',
        title: 'Afinidade & Intenção',
        description: sharedInterests.length > 0
          ? `Partilham afinidade concreta por ${sharedInterests.slice(0, 3).join(', ')}.`
          : `Sintonia em busca de ${candidate.intent === 'serious' ? 'relacionamento duradouro' : 'conexões autênticas'}.`,
        weight: Math.min(1.0, (sharedInterests.length * 0.3) + (myProfile?.intent === candidate.intent ? 0.4 : 0.1)),
        highlight: sharedInterests[0] || 'Intenção Alinhada'
      });
    }

    // 2. Complementarity (Diferenças Enriquecedoras)
    if (differentInterests.length > 0) {
      structuredEvidence.push({
        type: 'COMPLEMENTARITY',
        title: 'Diferenças Enriquecedoras',
        description: `Perspetivas que somam: ${differentInterests.slice(0, 2).join(' e ')} trazem novos horizontes ao diálogo.`,
        weight: Math.min(1.0, 0.4 + (differentInterests.length * 0.15)),
        highlight: differentInterests[0]
      });
    }

    // 3. Cultural Connection (Ponte Cultural Lusófona)
    structuredEvidence.push({
      type: 'CULTURAL_CONNECTION',
      title: 'Ponte Cultural Lusófona',
      description: culturalBridge,
      weight: isCrossCountry ? 0.9 : isSameCity ? 0.85 : 0.75,
      highlight: `${candidate.cityName}, ${candidate.countryName}`
    });

    // 4. Serendipity (Descoberta Inesperada & Valor Serendípico)
    const serendipityWeight = (isCrossCountry ? 0.45 : 0.2) + (noveltyBonus > 0 ? 0.3 : 0.1) + (candidate.online ? 0.25 : 0.1);
    structuredEvidence.push({
      type: 'SERENDIPITY',
      title: 'Descoberta Inesperada',
      description: isCrossCountry
        ? `Encontro serendípico transfronteiriço com elevado potencial de partilha e novas descobertas.`
        : `Possibilidade espontânea de descoberta com horizonte aberto em ${candidate.cityName}.`,
      weight: Math.min(1.0, serendipityWeight),
      highlight: isCrossCountry ? 'Ponte CPLP' : 'Pulso Local'
    });

    // 5. Conversation Potential (Potencial de Conversa)
    const conversationWeight = Math.min(
      1.0,
      0.35 +
      (candidate.bio && candidate.bio.length > 20 ? 0.3 : 0.1) +
      (sharedInterests.length > 0 ? 0.25 : 0.1) +
      (candidate.online ? 0.1 : 0)
    );
    structuredEvidence.push({
      type: 'CONVERSATION_POTENTIAL',
      title: 'Potencial Conversacional',
      description: conversationStarters[0] || 'Prontidão para um primeiro diálogo acolhedor e substancial.',
      weight: conversationWeight,
      highlight: candidate.online ? 'Disponível Agora' : 'Voz & Expressão'
    });

    // 3.1: Determine dominant discovery mode
    let discoveryMode: DiscoveryMode = 'SIMILARITY';
    if (isCrossCountry && (compatibility.compatibilityResult.crossCulturalHighlight || serendipityWeight > 0.7)) {
      discoveryMode = 'CULTURAL_BRIDGE';
    } else if (differentInterests.length >= 2 && (!myProfile || myProfile.intent !== candidate.intent)) {
      discoveryMode = 'COMPLEMENTARITY';
    } else if (serendipityWeight > 0.75 || noveltyBonus > 0) {
      discoveryMode = 'SERENDIPITY';
    } else if (candidate.bio && candidate.bio.length > 40 && conversationWeight > 0.7) {
      discoveryMode = 'DEEP_CONVERSATION';
    } else {
      discoveryMode = 'SIMILARITY';
    }

    // 3.1 & 3.2: Evidence-grounded primary discovery reason
    let discoveryReason: string;
    switch (discoveryMode) {
      case 'CULTURAL_BRIDGE':
        discoveryReason = culturalBridge + (sharedInterests.length > 0 ? ` e afinidade em ${sharedInterests[0]}` : '');
        break;
      case 'COMPLEMENTARITY':
        discoveryReason = `Diferenças enriquecedoras: vivências distintas em ${candidate.cityName} que expandem a perspetiva mútua`;
        break;
      case 'SERENDIPITY':
        discoveryReason = `Uma conexão serendípica com alto valor de descoberta entre ${myProfile?.cityName || 'Lusofonia'} e ${candidate.cityName}`;
        break;
      case 'DEEP_CONVERSATION':
        discoveryReason = `Expressão genuína e valores transparentes com prontidão para diálogo com substância`;
        break;
      case 'SIMILARITY':
      default:
        discoveryReason = sharedInterests.length > 0
          ? `Sintonia viva em ${sharedInterests.slice(0, 2).join(' e ')} com alinhamento de intenções`
          : compatibility.reasons[0] || `Sintonia autêntica em ${candidate.cityName}`;
        break;
    }

    const connectionContext = `${candidate.cityName}, ${candidate.countryName} · ${
      sharedInterests.length > 0 ? sharedInterests.slice(0, 2).join(' + ') : 'Valores Lusófonos'
    }`;

    const conversationPrompt = conversationStarters[0];

    const evidenceDetails: DiscoveryCandidateEvidence = {
      sharedInterests,
      intentMatch,
      culturalBridge,
      personalityHighlight,
      relevantDifferences: differentInterests.slice(0, 3),
      conversationStarters,
      contextScore: contextResult.contextScore,
      items: structuredEvidence
    };

    const trustBadges = trustGraph.getBadgesForProfile(candidate);

    const baseCandidate: DiscoveryCandidate = {
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
      crossCulturalHighlight: compatibility.compatibilityResult.crossCulturalHighlight,
      discoveryReason,
      evidence: structuredEvidence,
      connectionContext,
      conversationPrompt,
      discoveryMode,
      evidenceDetails,
      trustBadges
    };

    if (myProfile) {
      return connectionGraph.enrichCandidate(baseCandidate, myProfile);
    }

    return baseCandidate;
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

  // 7. Rank Candidates: Prioritizes Reason-first heuristic (Conversation Potential + Cultural Connection > basic profile similarity)
  public rankCandidates(
    candidates: DiscoveryCandidate[],
    myProfile?: UserProfile,
    signals?: InteractionSignals
  ): DiscoveryCandidate[] {
    return [...candidates].map(c => {
      const p = c.profile;

      // 1. Basic Profile Similarity (Subordinated to 0.14 weight)
      const relevance = c.deterministicScore / 100;

      // 2. Conversation Potential (High-priority reason signal: 0.38 weight)
      const bioLength = p.bio ? p.bio.trim().length : 0;
      const bioDepthBonus = bioLength > 70 ? 0.35 : bioLength > 25 ? 0.25 : 0.10;
      const startersBonus = (c.evidenceDetails?.conversationStarters?.length || 0) > 0 ? 0.25 : 0.05;
      const onlineBonus = p.online ? 0.20 : (p.lastActive && (Date.now() - p.lastActive < 3600000 * 24)) ? 0.10 : 0;
      const deepModeBonus = c.discoveryMode === 'DEEP_CONVERSATION' ? 0.20 : 0;
      const conversationPotential = Math.min(
        1.0,
        0.20 + bioDepthBonus + startersBonus + onlineBonus + deepModeBonus
      );

      // 3. Cultural Connection (High-priority reason signal: 0.32 weight)
      const isCross = myProfile && myProfile.countryCode !== p.countryCode;
      const isSameCity = myProfile && myProfile.cityName === p.cityName;
      const culturalEvidenceWeight = c.evidence?.find(e => e.type === 'CULTURAL_CONNECTION')?.weight || 0.7;
      const bridgeModeBonus = c.discoveryMode === 'CULTURAL_BRIDGE' ? 0.15 : 0;
      const baseCulturalSynergy = isCross ? 0.85 : isSameCity ? 0.80 : 0.70;
      const culturalConnection = Math.min(
        1.0,
        baseCulturalSynergy * 0.6 + culturalEvidenceWeight * 0.3 + bridgeModeBonus
      );

      // 4. Surprise & Serendipity (0.10 weight)
      const surprise = isCross ? 0.85 : (c.noveltyBonus > 0 || c.discoveryMode === 'SERENDIPITY' ? 0.80 : 0.45);

      // 5. Diversity (0.06 weight: Prevents over-representation of same region)
      const countrySeenCount = signals?.likedCountries?.[p.countryCode] || 0;
      const diversity = Math.max(0.2, 1 - Math.min(countrySeenCount * 0.1, 0.8));

      // 6. Recency (Active status / freshness)
      const recency = p.online ? 1.0 : (p.lastActive && (Date.now() - p.lastActive < 3600000 * 24)) ? 0.7 : 0.4;

      // 7. Signal Learning Bonus (Learn which reason types convert to interactions)
      const modeLikes = signals?.likedReasonTypes?.[c.discoveryMode] || 0;
      const modeConvs = signals?.conversationReasonTypes?.[c.discoveryMode] || 0;
      const signalLearningBonus = Math.min(0.15, (modeLikes * 0.02) + (modeConvs * 0.04));

      // 8. Relational Condition Fitness (Pessoa + Contexto + Comportamento + Reciprocidade + Resultado)
      let relationalFitnessBonus = 0;
      if (myProfile) {
        const fitnessEval = relationalMemory.evaluateConditionFit(myProfile, c);
        relationalFitnessBonus = fitnessEval.fitnessScore * 0.15; // Up to 15% boost for high fertile condition alignment
      }

      // Weighted Heuristic:
      // Conversation Potential (0.35) + Cultural Connection (0.30) + Relational Condition Fitness (0.15)
      // Basic Profile Similarity (0.10) + Surprise (0.06) + Diversity (0.04)
      const finalCompositeRank =
        conversationPotential * 0.35 +
        culturalConnection * 0.30 +
        relationalFitnessBonus +
        relevance * 0.10 +
        surprise * 0.06 +
        diversity * 0.04 +
        signalLearningBonus;

      const prioritizationScore: ContextualPrioritizationScore = {
        relevance,
        conversationPotential,
        culturalConnection,
        surprise,
        diversity,
        recency,
        finalCompositeRank
      };

      return {
        ...c,
        prioritizationScore
      };
    }).sort((a, b) => {
      const rankA = a.prioritizationScore?.finalCompositeRank ?? (a.compatibilityScore / 100);
      const rankB = b.prioritizationScore?.finalCompositeRank ?? (b.compatibilityScore / 100);
      return rankB - rankA;
    });
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
      return this.buildDiscoveryCandidate(candidate, compat, ctx, 0, context?.currentExpansionLevel, myProfile);
    });

    const diversified = this.diversifyCandidates(rawCandidates, myProfile, myPrefs);
    return this.rankCandidates(diversified, myProfile, signals);
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

  /**
   * Prioritize 'Reason-first' candidate ranking by applying a weighted heuristic
   * that heavily favors 'Conversation Potential' (0.38) and 'Cultural Connection' (0.32)
   * signals over basic profile similarity (0.14).
   */
  public rankCandidatesReasonFirst(
    candidates: DiscoveryCandidate[],
    myProfile: UserProfile,
    signals?: InteractionSignals
  ): DiscoveryCandidate[] {
    return defaultDiscoveryEngine.rankCandidates(candidates, myProfile, signals);
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

    // Apply Reason-First Prioritization Ranking (favors Conversation Potential & Cultural Connection)
    const rankedCandidates = this.rankCandidatesReasonFirst(
      feedResult.candidates,
      myProfile,
      signals
    );

    // Light-First single/next thumbnail preload
    this.preloadCandidateMedia(rankedCandidates);

    return {
      candidates: rankedCandidates,
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
    onSuccessConversation?: (convo: Conversation, initialMsg: ChatMessage) => void,
    customContextText?: string
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

    // PONTO 1 & PONTO 2: Record MCR Funnel Events (MUTUAL_INTEREST & CONVERSATION_INITIATED)
    const origin = targetCandidate.discoveryMode || 'VALUES_AFFINITY';
    connectionGraph.recordFunnelEvent({
      userId: myProfile.uid,
      targetUid: target.uid,
      stage: 'MUTUAL_INTEREST',
      countryPair: [myProfile.countryCode, target.countryCode],
      discoveryOrigin: origin,
      metadata: {
        discoveryOrigin: origin,
        discoveryMode: targetCandidate.discoveryMode,
        isSerendipitous: targetCandidate.discoveryMode === 'SERENDIPITY'
      }
    });

    const convoId = `convo_${[myProfile.uid, target.uid].sort().join('_')}`;
    const defaultReason = targetCandidate.compatibilityReasons?.[0] || `Sintonia Lusófona (${targetCandidate.compatibilityScore}%)`;
    const initialText = customContextText || `Olá, ${myProfile.displayName}! Adorei a nossa conexão sobre "${defaultReason}". Vamos conversar? 🌍✨`;

    // Record Conversation Initiated stage in MCR Funnel
    connectionGraph.recordFunnelEvent({
      userId: myProfile.uid,
      targetUid: target.uid,
      stage: 'CONVERSATION_INITIATED',
      countryPair: [myProfile.countryCode, target.countryCode],
      discoveryOrigin: origin,
      metadata: {
        discoveryOrigin: origin,
        discoveryMode: targetCandidate.discoveryMode,
        icebreakerUsed: !!customContextText
      }
    });

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
      lastMessageText: defaultReason,
      lastMessageTimestamp: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const initialMsg: ChatMessage = {
      id: 'msg_welcome_' + Date.now(),
      conversationId: convoId,
      senderId: target.uid,
      text: initialText,
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
