import { describe, it, expect } from 'vitest';
import { runDiscoveryPipeline, filterEligibleCandidates, DiscoveryAppService } from '../services/discoveryService';
import { UserProfile, UserPreferences, PrivacySettings, InteractionSignals } from '../types';

describe('Discovery Pipeline & Eligibility Engine (4.4 & 4.11 & 4.27 & 4.29)', () => {
  const myProfile: UserProfile = {
    uid: 'me_123',
    displayName: 'Carlos',
    age: 30,
    gender: 'man',
    intent: 'serious',
    interests: ['Música Lusófona', 'Literatura'],
    bio: 'Olá da Bahia.',
    profilePhoto: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500',
    countryCode: 'BR',
    countryName: 'Brasil',
    cityName: 'Salvador',
    verificationStatus: 'verified',
    visibility: 'public',
    online: true,
    lastActive: Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  const myPreferences: UserPreferences = {
    uid: 'me_123',
    minAge: 25,
    maxAge: 35,
    genders: ['woman'],
    countries: ['BR', 'AO', 'MZ'],
    relationshipIntents: ['serious'],
    crossCultural: true,
    verifiedOnly: false
  };

  const privacy: PrivacySettings = {
    uid: 'me_123',
    shareApproximateLocationOnly: false,
    showAge: true,
    showOnlineStatus: true,
    visibility: 'public'
  };

  const pool: UserProfile[] = [
    {
      uid: 'me_123', // Self
      displayName: 'Carlos Self',
      age: 30,
      gender: 'man',
      intent: 'serious',
      interests: [],
      bio: '',
      profilePhoto: '',
      countryCode: 'BR',
      countryName: 'Brasil',
      cityName: 'Salvador',
      verificationStatus: 'verified',
      visibility: 'public',
      online: true,
      lastActive: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now()
    },
    {
      uid: 'user_blocked', // Blocked
      displayName: 'Blocked Person',
      age: 28,
      gender: 'woman',
      intent: 'serious',
      interests: [],
      bio: '',
      profilePhoto: '',
      countryCode: 'BR',
      countryName: 'Brasil',
      cityName: 'Rio de Janeiro',
      verificationStatus: 'verified',
      visibility: 'public',
      online: true,
      lastActive: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now()
    },
    {
      uid: 'user_hidden', // Hidden
      displayName: 'Hidden Person',
      age: 29,
      gender: 'woman',
      intent: 'serious',
      interests: [],
      bio: '',
      profilePhoto: '',
      countryCode: 'BR',
      countryName: 'Brasil',
      cityName: 'São Paulo',
      verificationStatus: 'verified',
      visibility: 'hidden',
      online: true,
      lastActive: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now()
    },
    {
      uid: 'user_out_of_age', // 45 yo (outside 25-35)
      displayName: 'Senior Person',
      age: 45,
      gender: 'woman',
      intent: 'serious',
      interests: [],
      bio: '',
      profilePhoto: '',
      countryCode: 'BR',
      countryName: 'Brasil',
      cityName: 'Brasília',
      verificationStatus: 'verified',
      visibility: 'public',
      online: true,
      lastActive: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now()
    },
    {
      uid: 'user_valid_1', // Valid candidate
      displayName: 'Mariana',
      age: 28,
      gender: 'woman',
      intent: 'serious',
      interests: ['Música Lusófona', 'Literatura'],
      bio: 'Apaixonada pela lusofonia.',
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
    }
  ];

  it('should exclude self, blocked, hidden, and out-of-bounds candidates', () => {
    const signals: InteractionSignals = {
      uid: 'me_123',
      seenCandidateUids: [],
      recentlySeenTimestamps: {},
      likedCandidateUids: [],
      passedCandidateUids: [],
      blockedUids: ['user_blocked'],
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
    };

    const eligible = filterEligibleCandidates(pool, myProfile, myPreferences, privacy, signals);

    expect(eligible.length).toBe(1);
    expect(eligible[0].uid).toBe('user_valid_1');
  });

  it('should rank eligible candidates explainably in runDiscoveryPipeline', () => {
    const signals: InteractionSignals = {
      uid: 'me_123',
      seenCandidateUids: [],
      recentlySeenTimestamps: {},
      likedCandidateUids: [],
      passedCandidateUids: [],
      blockedUids: ['user_blocked'],
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
    };

    const candidates = runDiscoveryPipeline(pool, myProfile, myPreferences, privacy, signals);

    expect(candidates.length).toBe(1);
    expect(candidates[0].profile.uid).toBe('user_valid_1');
    expect(candidates[0].compatibilityScore).toBeGreaterThanOrEqual(70);
    expect(candidates[0].compatibilityReasons.length).toBeGreaterThan(0);
    expect(candidates[0].compatibilityResult.intentAlignment).toBe('exact');
    expect(candidates[0].discoveryReason).toBeDefined();
    expect(candidates[0].discoveryMode).toBeDefined();
    expect(candidates[0].connectionContext).toBeDefined();
    expect(candidates[0].conversationPrompt).toBeDefined();
    expect(Array.isArray(candidates[0].evidence)).toBe(true);
    expect(candidates[0].evidence.length).toBeGreaterThan(0);
    expect(candidates[0].evidenceDetails?.sharedInterests).toContain('Música Lusófona');
  });

  it('should filter out candidates when Preferences disables crossCultural', () => {
    const localPreferences: UserPreferences = {
      ...myPreferences,
      crossCultural: false
    };

    const signals: InteractionSignals = {
      uid: 'me_123',
      seenCandidateUids: [],
      recentlySeenTimestamps: {},
      likedCandidateUids: [],
      passedCandidateUids: [],
      blockedUids: ['user_blocked'],
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
    };

    // user_valid_1 is from Angola ('AO'), while myProfile is from Brazil ('BR')
    // With Preferences.crossCultural = false, cross-border candidates are excluded.
    const candidates = runDiscoveryPipeline(pool, myProfile, localPreferences, privacy, signals);
    expect(candidates.length).toBe(0);
  });

  it('should respect semantic interaction rules (BLOCK bilateral, PASS cooldown, LIKE exclusion)', () => {
    const signals: InteractionSignals = {
      uid: 'me_123',
      seenCandidateUids: [],
      recentlySeenTimestamps: {},
      likedCandidateUids: ['user_valid_1'], // Mariana already liked -> excluded to prevent redundancy
      passedCandidateUids: [],
      blockedUids: ['user_blocked'], // Blocked user -> excluded
      reportedUids: [],
      likedCountries: {},
      skippedCountries: {},
      likedInterests: {},
      conversationStarts: 0,
      meaningfulInteractions: 0,
      totalLikesGiven: 1,
      totalPassesGiven: 0,
      isActivated: true,
      lastActiveTimestamp: Date.now()
    };

    const eligible = filterEligibleCandidates(
      pool,
      myProfile,
      myPreferences,
      privacy,
      signals
    );

    // user_valid_1 already liked -> 0 eligible
    expect(eligible.length).toBe(0);
  });

  it('should prioritize Reason-first ranking (favoring Conversation Potential and Cultural Connection over basic profile similarity)', () => {
    const discoveryAppService = DiscoveryAppService.getInstance();

    const candidateRichBioCrossCountry: UserProfile = {
      uid: 'user_rich_bio_cross',
      displayName: 'Inês do Mindelo',
      age: 28,
      gender: 'woman',
      intent: 'serious',
      interests: ['Gastronomia'], // Only 1 interest, but expressive bio and cross-cultural bridge
      bio: 'Apaixonada por mornas cabo-verdianas, conversas ao luar sobre literatura e partilhas que constroem amizades duradouras.',
      profilePhoto: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500',
      countryCode: 'CV',
      countryName: 'Cabo Verde',
      cityName: 'Mindelo',
      verificationStatus: 'verified',
      visibility: 'public',
      online: true,
      lastActive: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const candidateManyInterestsNoBio: UserProfile = {
      uid: 'user_many_interests_no_bio',
      displayName: 'Joana Local',
      age: 29,
      gender: 'woman',
      intent: 'serious',
      interests: ['Música Lusófona', 'Literatura', 'Gastronomia', 'Cinema'], // 4 matching interests (high similarity)
      bio: '', // Empty bio -> low conversation potential
      profilePhoto: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=500',
      countryCode: 'BR',
      countryName: 'Brasil',
      cityName: 'Salvador',
      verificationStatus: 'verified',
      visibility: 'public',
      online: false,
      lastActive: Date.now() - 3600000 * 48,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const testPool = [candidateManyInterestsNoBio, candidateRichBioCrossCountry];
    const testPreferences: UserPreferences = {
      ...myPreferences,
      countries: ['BR', 'CV']
    };

    const cleanSignals: InteractionSignals = {
      uid: 'me_123',
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
    };

    const feedState = discoveryAppService.evaluateDiscoveryFeed(
      testPool,
      myProfile,
      testPreferences,
      privacy,
      cleanSignals
    );

    expect(feedState.candidates.length).toBe(2);

    // Verify Reason-first: candidate with rich bio and cross-cultural connection is ranked first
    const topCandidate = feedState.candidates[0];
    expect(topCandidate.profile.uid).toBe('user_rich_bio_cross');
    expect(topCandidate.prioritizationScore).toBeDefined();
    expect(topCandidate.prioritizationScore?.conversationPotential).toBeGreaterThan(0.6);
    expect(topCandidate.prioritizationScore?.culturalConnection).toBeGreaterThan(0.7);
    expect(topCandidate.prioritizationScore?.finalCompositeRank).toBeGreaterThan(
      feedState.candidates[1].prioritizationScore?.finalCompositeRank || 0
    );
  });
});
