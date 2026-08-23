import {
  UserProfile,
  UserPreferences,
  ExpansionLevel,
  CPLPCountryCode
} from '../types';
import { CPLP_COUNTRY_LIST } from '../constants';

export const EXPANSION_LEVEL_HIERARCHY: ExpansionLevel[] = [
  'CITY',
  'REGION',
  'COUNTRY',
  'CPLP_SELECTED',
  'CPLP_GLOBAL'
];

export interface ExpansionPolicyConfig {
  minimumPoolThreshold: number; // default 3 candidates
}

export const DEFAULT_EXPANSION_CONFIG: ExpansionPolicyConfig = {
  minimumPoolThreshold: 3
};

/**
 * 4.8, 4.9 & 4.10: DiscoveryExpansionPolicy
 * Manages progressive geographical and cultural expansion strictly when candidate
 * availability is below the minimum threshold.
 */
export class DiscoveryExpansionPolicy {
  private config: ExpansionPolicyConfig;

  constructor(config?: Partial<ExpansionPolicyConfig>) {
    this.config = { ...DEFAULT_EXPANSION_CONFIG, ...config };
  }

  /**
   * Filters candidate pool according to a given expansion level
   */
  public filterByLevel(
    pool: UserProfile[],
    myProfile: UserProfile,
    myPrefs: UserPreferences,
    level: ExpansionLevel
  ): UserProfile[] {
    switch (level) {
      case 'CITY':
        return pool.filter(
          c =>
            c.countryCode === myProfile.countryCode &&
            c.cityName?.trim().toLowerCase() === myProfile.cityName?.trim().toLowerCase()
        );

      case 'REGION':
        return pool.filter(c => {
          if (c.countryCode !== myProfile.countryCode) return false;
          if (myProfile.regionName && c.regionName) {
            return c.regionName.trim().toLowerCase() === myProfile.regionName.trim().toLowerCase();
          }
          // Default region match fallback to same city or default cities in country
          return true;
        });

      case 'COUNTRY':
        return pool.filter(c => c.countryCode === myProfile.countryCode);

      case 'CPLP_SELECTED':
        if (myPrefs.countries && myPrefs.countries.length > 0) {
          const allowed = new Set<string>(myPrefs.countries);
          return pool.filter(c => allowed.has(c.countryCode));
        }
        return pool.filter(c => c.countryCode === myProfile.countryCode);

      case 'CPLP_GLOBAL':
      default:
        return [...pool];
    }
  }

  /**
   * Evaluates if expansion is required and returns the appropriate level and filtered candidates
   */
  public evaluateExpansion(
    pool: UserProfile[],
    myProfile: UserProfile,
    myPrefs: UserPreferences,
    targetThreshold: number = this.config.minimumPoolThreshold
  ): {
    level: ExpansionLevel;
    candidates: UserProfile[];
    expanded: boolean;
  } {
    // If crossCultural is disabled in preferences, limit expansion to COUNTRY max
    const maxLevel: ExpansionLevel = myPrefs.crossCultural ? 'CPLP_GLOBAL' : 'COUNTRY';
    const hierarchy = EXPANSION_LEVEL_HIERARCHY.slice(
      0,
      EXPANSION_LEVEL_HIERARCHY.indexOf(maxLevel) + 1
    );

    for (let i = 0; i < hierarchy.length; i++) {
      const currentLevel = hierarchy[i];
      const filtered = this.filterByLevel(pool, myProfile, myPrefs, currentLevel);

      // If we have enough candidates or reached max level, return
      if (filtered.length >= targetThreshold || i === hierarchy.length - 1) {
        return {
          level: currentLevel,
          candidates: filtered,
          expanded: i > 0
        };
      }
    }

    return {
      level: 'CPLP_GLOBAL',
      candidates: pool,
      expanded: true
    };
  }

  public getNextLevel(currentLevel: ExpansionLevel): ExpansionLevel | null {
    const idx = EXPANSION_LEVEL_HIERARCHY.indexOf(currentLevel);
    if (idx >= 0 && idx < EXPANSION_LEVEL_HIERARCHY.length - 1) {
      return EXPANSION_LEVEL_HIERARCHY[idx + 1];
    }
    return null;
  }
}

export const defaultExpansionPolicy = new DiscoveryExpansionPolicy();
