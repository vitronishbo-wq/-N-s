import { db, doc, setDoc, addDoc, collection, serverTimestamp } from '../firebase/config';
import { UserInteractionRecord } from '../types';

/**
 * Persists user responses to community questions in Firestore
 */
export async function persistCommunityAnswer(
  userId: string,
  userDisplayName: string,
  userCityName: string,
  userCountryCode: string,
  userProfilePhoto: string,
  questionId: string,
  questionTheme: string,
  answer: string
): Promise<string | null> {
  try {
    const docRef = await addDoc(collection(db, 'community_answers'), {
      userId,
      userDisplayName,
      userCityName,
      userCountryCode,
      userProfilePhoto,
      questionId,
      questionTheme,
      answer,
      createdAt: Date.now(),
      serverTimestamp: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    console.warn('Firestore answer persistence fallback to local:', error);
    return null;
  }
}

/**
 * Persists structured discovery interaction events in Firestore for telemetry
 */
export async function persistDiscoveryEvent(
  userId: string,
  targetUid: string,
  eventType: 'candidate_shown' | 'reason_viewed' | 'voice_played' | 'approach_initiated' | 'pass' | 'firstConnectionMoment',
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    const eventId = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    await setDoc(doc(db, 'discovery_events', eventId), {
      eventId,
      userId,
      targetUid,
      eventType,
      metadata: metadata || {},
      timestamp: Date.now(),
      serverTimestamp: serverTimestamp()
    });
  } catch (error) {
    // Non-blocking telemetry fallback
    console.warn('Telemetry event persistence fallback:', error);
  }
}
