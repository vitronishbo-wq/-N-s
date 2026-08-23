import { describe, it, expect } from 'vitest';
import { CPLP_COUNTRIES, CPLP_COUNTRY_LIST } from '../constants';
import { DEFAULT_FEATURE_FLAGS } from '../types';

describe('Shared Contracts & CPLP Structural Integrity (4.20 & 4.26 & 4.30 & 4.35)', () => {
  it('should support all 9 CPLP member states structurally', () => {
    const expectedCodes = ['AO', 'BR', 'CV', 'GW', 'GQ', 'MZ', 'PT', 'ST', 'TL'];
    
    expect(CPLP_COUNTRY_LIST.length).toBe(9);
    expectedCodes.forEach(code => {
      const country = CPLP_COUNTRIES[code as keyof typeof CPLP_COUNTRIES];
      expect(country).toBeDefined();
      expect(country.name).toBeDefined();
      expect(country.flag).toBeDefined();
      expect(country.capital).toBeDefined();
      expect(country.defaultCities.length).toBeGreaterThan(0);
    });
  });

  it('should define default feature flags correctly', () => {
    expect(DEFAULT_FEATURE_FLAGS.MATCHING_V1).toBe(true);
    expect(DEFAULT_FEATURE_FLAGS.AI_PROFILE_ASSISTANT).toBe(true);
    expect(DEFAULT_FEATURE_FLAGS.RELATIONSHIP_SPACE).toBe(true);
    expect(DEFAULT_FEATURE_FLAGS.VERIFICATION).toBe(true);
    expect(DEFAULT_FEATURE_FLAGS.VIDEO).toBe(false);
  });
});
