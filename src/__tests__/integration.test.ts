import { describe, it, expect } from 'vitest';
import { runDiscoveryPipeline } from '../services/matching';
import { getInitialSignals, recordSignalEvent } from '../services/signals';
import { UserProfile, UserPreferences, PrivacySettings, Conversation } from '../types';

describe('End-to-End Flow Integration (4.32): Onboarding -> Profile -> Discovery -> Like -> Match -> Conversation', () => {
  it('should transition through full discovery, match, and conversation lifecycle seamlessly', () => {
    // 1. User Completes Onboarding & Profile
    const myProfile: UserProfile = {
      uid: 'user_onboarded',
      displayName: 'Adilson',
      age: 26,
      gender: 'man',
      intent: 'serious',
      interests: ['Música Lusófona', 'Dança & Kizomba', 'Gastronomia'],
      bio: 'Vivendo em Luanda e conectado com a lusofonia.',
      profilePhoto: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500',
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

    const preferences: UserPreferences = {
      uid: 'user_onboarded',
      minAge: 20,
      maxAge: 32,
      genders: ['woman'],
      countries: ['AO', 'PT', 'BR'],
      relationshipIntents: ['serious', 'dating'],
      crossCultural: true,
      verifiedOnly: false
    };

    const privacy: PrivacySettings = {
      uid: 'user_onboarded',
      shareApproximateLocationOnly: false,
      showAge: true,
      showOnlineStatus: true,
      visibility: 'public'
    };

    let signals = getInitialSignals(myProfile.uid);

    // 2. Candidate Pool
    const candidatePool: UserProfile[] = [
      {
        uid: 'partner_clara',
        displayName: 'Clara',
        age: 25,
        gender: 'woman',
        intent: 'serious',
        interests: ['Música Lusófona', 'Dança & Kizomba', 'Fotografia'],
        bio: 'De Salvador para o mundo lusófono.',
        profilePhoto: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500',
        countryCode: 'BR',
        countryName: 'Brasil',
        cityName: 'Salvador',
        verificationStatus: 'verified',
        visibility: 'public',
        online: true,
        lastActive: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
    ];

    // 3. Discovery Pipeline
    const candidates = runDiscoveryPipeline(
      candidatePool,
      myProfile,
      preferences,
      privacy,
      signals,
      {
        currentTime: Date.now(),
        userCountryCode: myProfile.countryCode,
        userCityName: myProfile.cityName,
        allowCrossCultural: preferences.crossCultural
      }
    );

    expect(candidates.length).toBe(1);
    const topCandidate = candidates[0];
    expect(topCandidate.profile.uid).toBe('partner_clara');
    expect(topCandidate.compatibilityScore).toBeGreaterThanOrEqual(75);

    // Record Candidate Shown
    signals = recordSignalEvent(signals, {
      type: 'firstCandidateShown',
      targetUid: topCandidate.profile.uid
    });

    // 4. Like Action
    signals = recordSignalEvent(signals, {
      type: 'like',
      targetUid: topCandidate.profile.uid,
      countryCode: topCandidate.profile.countryCode,
      interests: topCandidate.profile.interests
    });
    expect(signals.likedCandidateUids).toContain('partner_clara');

    // 5. Mutual Match Occurs (First Connection Moment)
    signals = recordSignalEvent(signals, {
      type: 'firstMatch',
      targetUid: topCandidate.profile.uid
    });
    expect(signals.firstConnectionMoment).toBeDefined();

    // 6. Conversation Initialization
    const convoId = `convo_${[myProfile.uid, topCandidate.profile.uid].sort().join('_')}`;
    const conversation: Conversation = {
      id: convoId,
      participantUids: [myProfile.uid, topCandidate.profile.uid],
      participantDetails: {
        [myProfile.uid]: {
          displayName: myProfile.displayName,
          profilePhoto: myProfile.profilePhoto,
          countryCode: myProfile.countryCode,
          cityName: myProfile.cityName
        },
        [topCandidate.profile.uid]: {
          displayName: topCandidate.profile.displayName,
          profilePhoto: topCandidate.profile.profilePhoto,
          countryCode: topCandidate.profile.countryCode,
          cityName: topCandidate.profile.cityName
        }
      },
      lastMessageText: 'Olá! Conexão iniciada.',
      lastMessageTimestamp: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    expect(conversation.participantUids).toContain(myProfile.uid);
    expect(conversation.participantUids).toContain('partner_clara');

    // 7. Conversation Event -> User Activation
    signals = recordSignalEvent(signals, {
      type: 'firstConversation',
      conversationId: convoId
    });
    expect(signals.isActivated).toBe(true);
    expect(signals.activatedAt).toBeDefined();
  });
});
