import {
  InteractionSignals,
  InteractionEvent,
  SignalsSummary,
  ActivationState,
  ActivationStage,
  CPLPCountryCode
} from '../types';

export const SIGNALS_STORAGE_KEY = 'enos_interaction_signals';
export const SIGNALS_BOUNDS = {
  MAX_SEEN_UIDS: 500,
  MAX_RECENT_TIMESTAMPS: 300,
  MAX_LIKED_UIDS: 1000,
  MAX_PASSED_UIDS: 1000,
  MAX_BLOCKED_UIDS: 500,
  MAX_REPORTED_UIDS: 500,
  MAX_INTERESTS_MAP: 100,
  PRUNE_WINDOW_MS: 1000 * 60 * 60 * 24 * 7 // 7 days
} as const;

/**
 * 4.5: Extracts a compact SignalsSummary from full interaction telemetry
 */
export function getSignalsSummary(signals: InteractionSignals): SignalsSummary {
  const topLikedCountries: Record<string, number> = {};
  Object.entries(signals.likedCountries || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .forEach(([k, v]) => {
      topLikedCountries[k] = v;
    });

  const topLikedInterests: Record<string, number> = {};
  Object.entries(signals.likedInterests || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([k, v]) => {
      topLikedInterests[k] = v;
    });

  return {
    uid: signals.uid,
    totalSeen: (signals.seenCandidateUids || []).length,
    totalLikes: signals.totalLikesGiven || 0,
    totalPasses: signals.totalPassesGiven || 0,
    totalMatches: signals.firstMatchAt ? 1 : 0,
    totalConversations: signals.conversationStarts || 0,
    topLikedCountries,
    topLikedInterests,
    lastActiveTimestamp: signals.lastActiveTimestamp || Date.now()
  };
}

/**
 * 4.6 & 4.17 & 4.18: Computes current ActivationState from interaction signals
 */
export function getActivationState(signals: InteractionSignals): ActivationState {
  let stage: ActivationStage = 'cold_start';

  if (signals.isActivated || signals.firstConversationAt) {
    stage = 'activated';
  } else if (signals.firstMatchAt || signals.firstConnectionMoment) {
    stage = 'first_match';
  } else if (signals.firstLikeAt) {
    stage = 'first_like';
  } else if (signals.firstCandidateShownAt) {
    stage = 'first_candidate';
  }

  const durationToActivationMs =
    signals.firstCandidateShownAt && signals.activatedAt
      ? signals.activatedAt - signals.firstCandidateShownAt
      : signals.activationDurationMs || null;

  return {
    uid: signals.uid,
    currentStage: stage,
    isActivated: signals.isActivated || false,
    firstCandidateShownAt: signals.firstCandidateShownAt || null,
    firstLikeAt: signals.firstLikeAt || null,
    firstMatchAt: signals.firstMatchAt || null,
    firstConversationAt: signals.firstConversationAt || null,
    firstConnectionMoment: signals.firstConnectionMoment || null,
    activatedAt: signals.activatedAt || null,
    durationToActivationMs
  };
}

/**
 * 4.14: Prunes arrays and timestamp maps to prevent unbounded document bloat
 */
export function sanitizeAndPruneSignals(signals: InteractionSignals): InteractionSignals {
  const now = Date.now();
  const cutoff = now - SIGNALS_BOUNDS.PRUNE_WINDOW_MS;

  // Prune recent timestamps older than cutoff
  const prunedTimestamps: Record<string, number> = {};
  const sortedEntries = Object.entries(signals.recentlySeenTimestamps || {})
    .filter(([_, ts]) => ts > cutoff)
    .sort((a, b) => b[1] - a[1])
    .slice(0, SIGNALS_BOUNDS.MAX_RECENT_TIMESTAMPS);

  for (const [k, v] of sortedEntries) {
    prunedTimestamps[k] = v;
  }

  // Cap array sizes
  const seenCandidateUids = (signals.seenCandidateUids || []).slice(-SIGNALS_BOUNDS.MAX_SEEN_UIDS);
  const likedCandidateUids = (signals.likedCandidateUids || []).slice(-SIGNALS_BOUNDS.MAX_LIKED_UIDS);
  const passedCandidateUids = (signals.passedCandidateUids || []).slice(-SIGNALS_BOUNDS.MAX_PASSED_UIDS);
  const blockedUids = (signals.blockedUids || []).slice(-SIGNALS_BOUNDS.MAX_BLOCKED_UIDS);
  const reportedUids = (signals.reportedUids || []).slice(-SIGNALS_BOUNDS.MAX_REPORTED_UIDS);

  // Prune top interests map
  const topInterestsEntries = Object.entries(signals.likedInterests || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, SIGNALS_BOUNDS.MAX_INTERESTS_MAP);
  const likedInterests: Record<string, number> = {};
  for (const [k, v] of topInterestsEntries) {
    likedInterests[k] = v;
  }

  return {
    ...signals,
    seenCandidateUids,
    recentlySeenTimestamps: prunedTimestamps,
    likedCandidateUids,
    passedCandidateUids,
    blockedUids,
    reportedUids,
    likedInterests
  };
}

export function getInitialSignals(uid: string): InteractionSignals {
  try {
    const cached = localStorage.getItem(`${SIGNALS_STORAGE_KEY}_${uid}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      return sanitizeAndPruneSignals({
        uid,
        seenCandidateUids: parsed.seenCandidateUids || [],
        recentlySeenTimestamps: parsed.recentlySeenTimestamps || {},
        likedCandidateUids: parsed.likedCandidateUids || [],
        passedCandidateUids: parsed.passedCandidateUids || [],
        blockedUids: parsed.blockedUids || [],
        reportedUids: parsed.reportedUids || [],
        likedCountries: parsed.likedCountries || {},
        skippedCountries: parsed.skippedCountries || {},
        likedInterests: parsed.likedInterests || {},
        conversationStarts: parsed.conversationStarts || 0,
        meaningfulInteractions: parsed.meaningfulInteractions || 0,
        totalLikesGiven: parsed.totalLikesGiven || 0,
        totalPassesGiven: parsed.totalPassesGiven || 0,
        firstCandidateShownAt: parsed.firstCandidateShownAt || null,
        firstLikeAt: parsed.firstLikeAt || null,
        firstMatchAt: parsed.firstMatchAt || null,
        firstConversationAt: parsed.firstConversationAt || null,
        firstConnectionMoment: parsed.firstConnectionMoment || null,
        activatedAt: parsed.activatedAt || null,
        isActivated: parsed.isActivated || false,
        activationDurationMs: parsed.activationDurationMs || null,
        lastActiveTimestamp: parsed.lastActiveTimestamp || Date.now()
      });
    }
  } catch {}

  return {
    uid,
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
    firstCandidateShownAt: null,
    firstLikeAt: null,
    firstMatchAt: null,
    firstConversationAt: null,
    firstConnectionMoment: null,
    activatedAt: null,
    isActivated: false,
    activationDurationMs: null,
    lastActiveTimestamp: Date.now()
  };
}

export function saveSignals(signals: InteractionSignals): void {
  try {
    const pruned = sanitizeAndPruneSignals(signals);
    localStorage.setItem(`${SIGNALS_STORAGE_KEY}_${signals.uid}`, JSON.stringify(pruned));
  } catch {}
}

export type SignalEvent =
  | { type: 'firstCandidateShown'; targetUid: string }
  | { type: 'candidate_shown'; targetUid: string }
  | { type: 'seen'; targetUid: string }
  | { type: 'like'; targetUid: string; countryCode?: CPLPCountryCode | string; interests?: string[] }
  | { type: 'pass'; targetUid: string; countryCode?: CPLPCountryCode | string }
  | { type: 'firstMatch'; targetUid: string }
  | { type: 'match'; targetUid: string }
  | { type: 'firstConversation'; conversationId: string }
  | { type: 'conversation_start'; conversationId: string }
  | { type: 'meaningfulInteraction'; conversationId: string }
  | { type: 'block'; targetUid: string }
  | { type: 'report'; targetUid: string };

/**
 * 4.4, 4.17 & 4.18: Incremental Signal Collection, Real Activation Detection & FirstConnectionMoment Measurement
 */
export function recordSignalEvent(
  signals: InteractionSignals,
  event: SignalEvent
): InteractionSignals {
  const now = Date.now();
  const updated: InteractionSignals = {
    ...signals,
    lastActiveTimestamp: now,
    recentlySeenTimestamps: { ...signals.recentlySeenTimestamps },
    likedCountries: { ...signals.likedCountries },
    skippedCountries: { ...signals.skippedCountries },
    likedInterests: { ...signals.likedInterests }
  };

  switch (event.type) {
    case 'firstCandidateShown':
    case 'candidate_shown':
    case 'seen':
      if (!updated.firstCandidateShownAt) {
        updated.firstCandidateShownAt = now;
      }
      if (!updated.seenCandidateUids.includes(event.targetUid)) {
        updated.seenCandidateUids = [...updated.seenCandidateUids, event.targetUid];
      }
      updated.recentlySeenTimestamps[event.targetUid] = now;
      break;

    case 'like':
      if (!updated.likedCandidateUids.includes(event.targetUid)) {
        updated.likedCandidateUids = [...updated.likedCandidateUids, event.targetUid];
        updated.totalLikesGiven += 1;
      }
      if (!updated.firstLikeAt) {
        updated.firstLikeAt = now;
      }
      if (event.countryCode) {
        updated.likedCountries[event.countryCode] = (updated.likedCountries[event.countryCode] || 0) + 1;
      }
      if (event.interests && Array.isArray(event.interests)) {
        event.interests.forEach(interest => {
          updated.likedInterests[interest] = (updated.likedInterests[interest] || 0) + 1;
        });
      }
      break;

    case 'pass':
      if (!updated.passedCandidateUids.includes(event.targetUid)) {
        updated.passedCandidateUids = [...updated.passedCandidateUids, event.targetUid];
        updated.totalPassesGiven += 1;
      }
      if (!updated.passedTimestamps) {
        updated.passedTimestamps = {};
      }
      updated.passedTimestamps[event.targetUid] = now;
      if (event.countryCode) {
        updated.skippedCountries[event.countryCode] = (updated.skippedCountries[event.countryCode] || 0) + 1;
      }
      break;

    case 'firstMatch':
    case 'match':
      if (!updated.firstMatchAt) {
        updated.firstMatchAt = now;
      }
      if (!updated.firstConnectionMoment) {
        updated.firstConnectionMoment = now;
      }
      break;

    case 'firstConversation':
    case 'conversation_start':
      if (!updated.firstConversationAt) {
        updated.firstConversationAt = now;
      }
      updated.conversationStarts += 1;
      if (!updated.isActivated) {
        updated.isActivated = true;
        updated.activatedAt = now;
        if (updated.firstCandidateShownAt) {
          updated.activationDurationMs = now - updated.firstCandidateShownAt;
        }
      }
      break;

    case 'meaningfulInteraction':
      updated.meaningfulInteractions += 1;
      if (!updated.isActivated) {
        updated.isActivated = true;
        updated.activatedAt = now;
        if (updated.firstCandidateShownAt) {
          updated.activationDurationMs = now - updated.firstCandidateShownAt;
        }
      }
      break;

    case 'block':
      if (!updated.blockedUids.includes(event.targetUid)) {
        updated.blockedUids = [...updated.blockedUids, event.targetUid];
      }
      break;

    case 'report':
      if (!updated.reportedUids.includes(event.targetUid)) {
        updated.reportedUids = [...updated.reportedUids, event.targetUid];
      }
      break;
  }

  const pruned = sanitizeAndPruneSignals(updated);
  saveSignals(pruned);
  return pruned;
}

/**
 * 4.4: Bridge from structured InteractionEvent to recordSignalEvent
 */
export function processInteractionEvent(
  signals: InteractionSignals,
  event: InteractionEvent
): InteractionSignals {
  return recordSignalEvent(signals, {
    type: event.eventType as any,
    targetUid: event.targetUid,
    countryCode: event.countryCode,
    interests: event.interests
  });
}
