import {
  UserProfile,
  PrivateTrustGraphEvaluation,
  TrustBadge,
  TrustBadgeType,
  InteractionSignals
} from '../types';
import { db, doc, setDoc, getDoc, serverTimestamp } from '../firebase/config';

const LOCAL_TRUST_CACHE_KEY = 'enos_trust_graph_cache_v1';

/**
 * PONTO 3: ÉNós Trust Graph Architecture
 * Multi-layer private trust evaluation (Identity, Authenticity, Safety, Consistency, Interaction Quality)
 * Emits clean, non-toxic badges without public numerical scores.
 */
export class TrustGraphService {
  private static instance: TrustGraphService;
  private memoryCache: Map<string, PrivateTrustGraphEvaluation> = new Map();

  private constructor() {
    this.hydrateFromLocal();
  }

  public static getInstance(): TrustGraphService {
    if (!TrustGraphService.instance) {
      TrustGraphService.instance = new TrustGraphService();
    }
    return TrustGraphService.instance;
  }

  private hydrateFromLocal(): void {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(LOCAL_TRUST_CACHE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        Object.entries(parsed).forEach(([k, v]) => {
          this.memoryCache.set(k, v as PrivateTrustGraphEvaluation);
        });
      }
    } catch {}
  }

  private persistLocal(): void {
    if (typeof window === 'undefined') return;
    try {
      const obj: Record<string, PrivateTrustGraphEvaluation> = {};
      this.memoryCache.forEach((v, k) => {
        obj[k] = v;
      });
      localStorage.setItem(LOCAL_TRUST_CACHE_KEY, JSON.stringify(obj));
    } catch {}
  }

  /**
   * Evaluates private trust levels across 5 layers and generates public-friendly badges
   */
  public evaluateTrust(
    profile: UserProfile,
    signals?: InteractionSignals,
    safetyIncidentsCount: number = 0
  ): PrivateTrustGraphEvaluation {
    const cached = this.memoryCache.get(profile.uid);
    if (cached && Date.now() - cached.evaluatedAt < 1000 * 60 * 60) {
      return cached;
    }

    // 1. Identity Layer (verification status, account age)
    let identityScore = 0.5;
    if (profile.verificationStatus === 'verified') identityScore = 0.95;
    else if (profile.verificationStatus === 'pending') identityScore = 0.7;

    // 2. Authenticity Layer (bio richness, photo count, genuine cultural background)
    let authenticityScore = 0.6;
    const bioLength = profile.bio ? profile.bio.trim().length : 0;
    if (bioLength > 30) authenticityScore += 0.2;
    if (profile.photos && profile.photos.length >= 2) authenticityScore += 0.15;
    if (profile.culturalBackground) authenticityScore += 0.05;
    authenticityScore = Math.min(1.0, authenticityScore);

    // 3. Safety Layer (zero confirmed incidents or blocks)
    let safetyScore = 1.0;
    if (safetyIncidentsCount > 0) safetyScore = Math.max(0.2, 1.0 - (safetyIncidentsCount * 0.4));

    // 4. Consistency Layer (declared intents and actions align)
    let consistencyScore = 0.8;
    if (profile.intent) consistencyScore += 0.1;
    if (profile.cityName && profile.countryName) consistencyScore += 0.1;
    consistencyScore = Math.min(1.0, consistencyScore);

    // 5. Interaction Quality Layer (reciprocity, respectful dialogue, responsiveness)
    let interactionQualityScore = 0.75;
    if (signals?.meaningfulInteractions && signals.meaningfulInteractions > 0) {
      interactionQualityScore = Math.min(1.0, 0.8 + (signals.meaningfulInteractions * 0.05));
    }

    const isSuspicious = safetyScore < 0.5 || identityScore < 0.3;

    // Generate human-friendly, clean badges
    const badges: TrustBadge[] = [];

    if (identityScore >= 0.85) {
      badges.push({
        type: 'identity_verified',
        label: 'Identidade Verificada',
        description: 'Identidade e titularidade do perfil validadas com sucesso',
        iconName: 'ShieldCheck',
        grantedAt: profile.createdAt || Date.now()
      });
    }

    if (authenticityScore >= 0.80) {
      badges.push({
        type: 'authentic_profile',
        label: 'Perfil Autêntico',
        description: 'Apresentação rica, transparente e genuína na comunidade',
        iconName: 'Sparkles',
        grantedAt: profile.createdAt || Date.now()
      });
    }

    if (safetyScore >= 0.90 && consistencyScore >= 0.80) {
      badges.push({
        type: 'trusted_member',
        label: 'Membro Confiável',
        description: 'Excelente histórico de respeito e convivência na CPLP',
        iconName: 'UserCheck',
        grantedAt: profile.createdAt || Date.now()
      });
    }

    if (interactionQualityScore >= 0.80) {
      badges.push({
        type: 'respectful_dialogue',
        label: 'Diálogo Respeitoso',
        description: 'Reconhecido por conversas cordiais, construtivas e recíprocas',
        iconName: 'HeartHandshake',
        grantedAt: profile.createdAt || Date.now()
      });
    }

    if (profile.online || (Date.now() - (profile.lastActive || 0) < 1000 * 60 * 60 * 24)) {
      badges.push({
        type: 'active_presence',
        label: 'Presença Ativa',
        description: 'Membro com alta prontidão e participação recente',
        iconName: 'Zap',
        grantedAt: Date.now()
      });
    }

    const evaluation: PrivateTrustGraphEvaluation = {
      userId: profile.uid,
      identityScore,
      authenticityScore,
      safetyScore,
      consistencyScore,
      interactionQualityScore,
      isSuspicious,
      badges,
      evaluatedAt: Date.now()
    };

    this.memoryCache.set(profile.uid, evaluation);
    this.persistLocal();

    // Async persist to Firestore
    try {
      setDoc(doc(db, 'trust_evaluations', profile.uid), {
        ...evaluation,
        serverTimestamp: serverTimestamp()
      });
    } catch {}

    return evaluation;
  }

  /**
   * Retrieves public badges for a user profile
   */
  public getBadgesForProfile(profile: UserProfile, signals?: InteractionSignals): TrustBadge[] {
    const evaluation = this.evaluateTrust(profile, signals);
    return evaluation.badges;
  }
}

export const trustGraph = TrustGraphService.getInstance();
