import {
  UserProfile,
  UserPreferences,
  DiscoveryCandidate,
  CPLPCountryCode
} from '../types';

export interface DiversityGuardConfig {
  maxConsecutiveSameCountry: number;
  maxCountryRepresentationRatio: number; // e.g. 0.5 (max 50% from same country if pool is diverse)
  noveltyCrossCountryFirstBoost: number;
  clusterDeprioritizationPenalty: number;
}

export const DEFAULT_DIVERSITY_CONFIG: DiversityGuardConfig = {
  maxConsecutiveSameCountry: 2,
  maxCountryRepresentationRatio: 0.6,
  noveltyCrossCountryFirstBoost: 3,
  clusterDeprioritizationPenalty: -3
};

/**
 * 4.11 & 4.21: CandidateDiversityGuard
 * Ensures fair cultural representation and avoids country/interest monopolies
 * while strictly preserving candidate relevance and compatibility integrity.
 */
export class CandidateDiversityGuard {
  private config: DiversityGuardConfig;

  constructor(customConfig?: Partial<DiversityGuardConfig>) {
    this.config = { ...DEFAULT_DIVERSITY_CONFIG, ...customConfig };
  }

  /**
   * Applies balanced diversity adjustments to scored candidates
   */
  public balanceDiversity(
    candidates: DiscoveryCandidate[],
    myProfile: UserProfile,
    myPrefs: UserPreferences
  ): DiscoveryCandidate[] {
    if (!candidates || candidates.length === 0) return [];

    const countryCounts: Record<string, number> = {};
    const interestCounts: Record<string, number> = {};

    return candidates.map(candidate => {
      const cCode = candidate.profile.countryCode;
      const currentCountryCount = countryCounts[cCode] || 0;
      countryCounts[cCode] = currentCountryCount + 1;

      let noveltyBonus = 0;

      // 1. Cross-Cultural Discovery Balancing
      if (myPrefs.crossCultural) {
        if (cCode !== myProfile.countryCode && currentCountryCount === 0) {
          // Boost first representative of an unexplored lusophone sister nation
          noveltyBonus += this.config.noveltyCrossCountryFirstBoost;
        } else if (currentCountryCount >= this.config.maxConsecutiveSameCountry) {
          // Penalize clustering to interleave distinct nationalities
          noveltyBonus += this.config.clusterDeprioritizationPenalty;
        }
      }

      // 2. Shared Interests Diversity
      let sharedInterestsBonus = 0;
      (candidate.profile.interests || []).forEach(interest => {
        const seenCount = interestCounts[interest] || 0;
        interestCounts[interest] = seenCount + 1;
        if (myProfile.interests.includes(interest) && seenCount === 0) {
          sharedInterestsBonus += 1;
        }
      });

      const totalNovelty = Math.min(Math.max(noveltyBonus + sharedInterestsBonus, -5), 5);
      const adjustedScore = Math.min(
        Math.max(candidate.compatibilityScore + totalNovelty, 50),
        99
      );

      return {
        ...candidate,
        noveltyBonus: totalNovelty,
        compatibilityScore: adjustedScore,
        compatibilityResult: {
          ...candidate.compatibilityResult,
          score: adjustedScore
        }
      };
    });
  }

  /**
   * Interleaves candidates so no single country dominates top-of-feed
   */
  public interleaveFeed(candidates: DiscoveryCandidate[]): DiscoveryCandidate[] {
    if (candidates.length <= 2) return candidates;

    const result: DiscoveryCandidate[] = [];
    const remaining = [...candidates];
    let lastCountry: string | null = null;
    let consecutiveCount = 0;

    while (remaining.length > 0) {
      let candidateIndex = -1;

      if (lastCountry && consecutiveCount >= this.config.maxConsecutiveSameCountry) {
        // Try finding candidate from different country
        candidateIndex = remaining.findIndex(c => c.profile.countryCode !== lastCountry);
      }

      if (candidateIndex === -1) {
        // Default to top candidate
        candidateIndex = 0;
      }

      const [selected] = remaining.splice(candidateIndex, 1);
      result.push(selected);

      if (selected.profile.countryCode === lastCountry) {
        consecutiveCount++;
      } else {
        lastCountry = selected.profile.countryCode;
        consecutiveCount = 1;
      }
    }

    return result;
  }
}

export const defaultDiversityGuard = new CandidateDiversityGuard();
