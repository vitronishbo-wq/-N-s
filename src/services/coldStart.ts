import {
  UserProfile,
  UserPreferences,
  PrivacySettings,
  InteractionSignals,
  DiscoveryCandidate
} from '../types';
import { defaultDiscoveryEngine } from './matching';
import { getInitialSignals } from './signals';

export interface ColdStartResult {
  primeCandidate: DiscoveryCandidate | null;
  initialFeed: DiscoveryCandidate[];
}

/**
 * 4.7 & 4.24: ColdStartEngine
 * Pre-prepares the initial candidate pool during user onboarding in memory, selecting the prime
 * first candidate to maximize first-connection quality and activation rate without heavy media downloading.
 */
export class ColdStartEngine {
  private static instance: ColdStartEngine;

  private constructor() {}

  public static getInstance(): ColdStartEngine {
    if (!ColdStartEngine.instance) {
      ColdStartEngine.instance = new ColdStartEngine();
    }
    return ColdStartEngine.instance;
  }

  /**
   * Pre-calculates and ranks the candidate pool ahead of time during onboarding steps (Light-First, in-memory)
   */
  public prepareColdStartFeed(
    candidatePool: UserProfile[],
    tempProfile: UserProfile,
    tempPreferences?: Partial<UserPreferences>
  ): ColdStartResult {
    const preferences: UserPreferences = {
      uid: tempProfile.uid,
      minAge: Math.max(tempProfile.age - 5, 18),
      maxAge: Math.min(tempProfile.age + 8, 75),
      genders: ['man', 'woman', 'non_binary', 'other'],
      countries: ['AO', 'BR', 'CV', 'GW', 'GQ', 'MZ', 'PT', 'ST', 'TL'],
      relationshipIntents: [tempProfile.intent],
      crossCultural: true,
      verifiedOnly: false,
      discoveryEnabled: true,
      ...tempPreferences
    };

    const privacy: PrivacySettings = {
      uid: tempProfile.uid,
      shareApproximateLocationOnly: false,
      showAge: true,
      showOnlineStatus: true,
      visibility: 'public'
    };

    const emptySignals: InteractionSignals = getInitialSignals(tempProfile.uid);

    const candidates = defaultDiscoveryEngine.executePipeline(
      candidatePool,
      tempProfile,
      preferences,
      privacy,
      emptySignals,
      {
        currentTime: Date.now(),
        userCountryCode: tempProfile.countryCode,
        userCityName: tempProfile.cityName,
        allowCrossCultural: preferences.crossCultural
      }
    );

    const primeCandidate = candidates.length > 0 ? candidates[0] : null;

    return {
      primeCandidate,
      initialFeed: candidates
    };
  }
}

export const defaultColdStartEngine = ColdStartEngine.getInstance();
