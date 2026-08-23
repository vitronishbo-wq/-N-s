import { describe, it, expect } from 'vitest';
import { getInitialSignals, recordSignalEvent } from '../services/signals';

describe('Interaction Signals & Activation Metrics (4.12 & 4.13 & 4.14 & 4.15 & 4.34)', () => {
  it('should initialize empty signals', () => {
    const signals = getInitialSignals('test_user');
    expect(signals.uid).toBe('test_user');
    expect(signals.isActivated).toBe(false);
    expect(signals.firstConnectionMoment).toBeNull();
    expect(signals.totalLikesGiven).toBe(0);
  });

  it('should record events incrementally and activate user upon first conversation', () => {
    let signals = getInitialSignals('test_user');

    // 1. First Candidate Shown
    signals = recordSignalEvent(signals, { type: 'firstCandidateShown', targetUid: 'cand_1' });
    expect(signals.firstCandidateShownAt).toBeDefined();
    expect(signals.seenCandidateUids).toContain('cand_1');

    // 2. First Like
    signals = recordSignalEvent(signals, {
      type: 'like',
      targetUid: 'cand_1',
      countryCode: 'AO',
      interests: ['Música Lusófona']
    });
    expect(signals.firstLikeAt).toBeDefined();
    expect(signals.likedCandidateUids).toContain('cand_1');
    expect(signals.likedCountries['AO']).toBe(1);
    expect(signals.likedInterests['Música Lusófona']).toBe(1);

    // 3. First Match (First Connection Moment)
    signals = recordSignalEvent(signals, { type: 'firstMatch', targetUid: 'cand_1' });
    expect(signals.firstMatchAt).toBeDefined();
    expect(signals.firstConnectionMoment).toBeDefined();

    // 4. First Conversation (User Activation achieved)
    signals = recordSignalEvent(signals, { type: 'firstConversation', conversationId: 'convo_123' });
    expect(signals.firstConversationAt).toBeDefined();
    expect(signals.isActivated).toBe(true);
    expect(signals.activatedAt).toBeDefined();
  });
});
