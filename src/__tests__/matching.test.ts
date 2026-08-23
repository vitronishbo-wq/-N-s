import { describe, it, expect } from 'vitest';
import { calculateDeterministicCompatibility } from '../services/matching';
import { UserProfile, UserPreferences } from '../types';

describe('Deterministic Matching Engine (4.5 & 4.9 & 4.28)', () => {
  const baseProfileA: UserProfile = {
    uid: 'user_a',
    displayName: 'Mateus',
    age: 28,
    gender: 'man',
    intent: 'serious',
    interests: ['Música Lusófona', 'Empreendedorismo', 'Gastronomia'],
    bio: 'Apaixonado por viagens e literatura lusófona.',
    profilePhoto: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500',
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

  const prefsA: UserPreferences = {
    uid: 'user_a',
    minAge: 22,
    maxAge: 35,
    genders: ['woman'],
    countries: ['AO', 'PT', 'BR'],
    relationshipIntents: ['serious', 'dating'],
    crossCultural: true,
    verifiedOnly: false
  };

  it('should compute high compatibility for same city, intent and shared interests', () => {
    const candidateLocal: UserProfile = {
      uid: 'user_b',
      displayName: 'Yara',
      age: 27,
      gender: 'woman',
      intent: 'serious',
      interests: ['Música Lusófona', 'Gastronomia', 'Arte & Cinema'],
      bio: 'Adoro cultura e criar laços profundos.',
      profilePhoto: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=500',
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

    const result = calculateDeterministicCompatibility(baseProfileA, prefsA, candidateLocal);

    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.compatibilityResult.intentAlignment).toBe('exact');
    expect(result.compatibilityResult.culturalConnection).toBe('same_city');
    expect(result.compatibilityResult.sharedInterests).toContain('Música Lusófona');
    expect(result.compatibilityResult.sharedInterests).toContain('Gastronomia');
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('should compute cross-cultural affinity when enabled', () => {
    const candidateCross: UserProfile = {
      uid: 'user_c',
      displayName: 'Beatriz',
      age: 29,
      gender: 'woman',
      intent: 'dating',
      interests: ['Música Lusófona', 'Empreendedorismo'],
      bio: 'Vivendo em Lisboa.',
      profilePhoto: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=500',
      countryCode: 'PT',
      countryName: 'Portugal',
      cityName: 'Lisboa',
      verificationStatus: 'verified',
      visibility: 'public',
      online: false,
      lastActive: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const result = calculateDeterministicCompatibility(baseProfileA, prefsA, candidateCross);

    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.compatibilityResult.culturalConnection).toBe('cross_cultural_cplp');
    expect(result.compatibilityResult.crossCulturalHighlight).toBeDefined();
  });
});
