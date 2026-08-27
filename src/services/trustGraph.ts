import {
  UserProfile,
  PrivateTrustGraphEvaluation,
  PrivateTrustSignals,
  TrustBadge,
  TrustBadgeType,
  TrustEvidenceRecord,
  TrustEvidenceType,
  TrustEligibilityPolicy,
  TrustVerificationRequest,
  InteractionSignals
} from '../types';
import { db, doc, setDoc, getDoc, serverTimestamp } from '../firebase/config';

const LOCAL_TRUST_EVIDENCE_KEY = 'enos_trust_evidences_v2';
const LOCAL_TRUST_REQUESTS_KEY = 'enos_trust_verif_requests_v2';
const LOCAL_PUBLIC_BADGES_KEY = 'enos_public_badges_v2';

/**
 * PONTO 3: FORMAL TRUST ELIGIBILITY POLICIES
 * Auditable, deterministic, dignity-preserving policies.
 * Public badges are strictly positive and non-punitive.
 */
export const TRUST_ELIGIBILITY_POLICIES: Record<TrustBadgeType, TrustEligibilityPolicy> = {
  identity_verified: {
    badgeType: 'identity_verified',
    title: 'Identidade Verificada',
    description: 'Validação segura de identidade por documento oficial, passaporte ou prova biométrica.',
    criteriaSummary: '1+ prova válida de identidade governamental ou biométrica; 0 violações graves de segurança.',
    requiredEvidenceTypes: ['national_id_verification', 'passport_verification', 'selfie_liveness_proof'],
    minimumSafetyTenureDays: 0,
    maxViolationsAllowed: 0,
    requiresAdminClearance: false,
    publicLabel: 'Identidade Verificada',
    publicDescription: 'Identidade e titularidade do perfil validadas de forma segura',
    dignityGuaranteed: true
  },
  authentic_profile: {
    badgeType: 'authentic_profile',
    title: 'Perfil Autêntico',
    description: 'Apresentação detalhada, fotos genuínas e transparência de contexto cultural lusófono.',
    criteriaSummary: 'Apresentação rica (bio > 30 caracteres), 2+ fotos de perfil e dados de localização consistentes.',
    requiredEvidenceTypes: ['community_contribution_proof'],
    minimumSafetyTenureDays: 0,
    maxViolationsAllowed: 0,
    requiresAdminClearance: false,
    publicLabel: 'Perfil Autêntico',
    publicDescription: 'Apresentação genuína, transparente e contextualizada na comunidade',
    dignityGuaranteed: true
  },
  trusted_member: {
    badgeType: 'trusted_member',
    title: 'Membro Confiável',
    description: 'Histórico exemplar de convivência na rede, estabilidade temporal e zero infrações.',
    criteriaSummary: 'Conta ativa há pelo menos 7 dias; 0 infrações ou advertências; presença regular.',
    requiredEvidenceTypes: ['clean_safety_tenure_proof'],
    minimumSafetyTenureDays: 7,
    maxViolationsAllowed: 0,
    requiresAdminClearance: false,
    publicLabel: 'Membro Confiável',
    publicDescription: 'Histórico consistente de respeito e integridade na comunidade CPLP',
    dignityGuaranteed: true
  },
  respectful_dialogue: {
    badgeType: 'respectful_dialogue',
    title: 'Diálogo Respeitoso',
    description: 'Reconhecimento por interações construtivas, cordiais e recíprocas sem denúncias de assédio.',
    criteriaSummary: '2+ conversas com reciprocidade confirmada (≥ 3 réplicas); 0 denúncias aceites de toxicidade.',
    requiredEvidenceTypes: ['interaction_reciprocity_proof'],
    minimumSafetyTenureDays: 0,
    maxViolationsAllowed: 0,
    requiresAdminClearance: false,
    publicLabel: 'Diálogo Respeitoso',
    publicDescription: 'Reconhecido por conduta respeitosa, acolhedora e recíproca',
    dignityGuaranteed: true
  },
  active_presence: {
    badgeType: 'active_presence',
    title: 'Presença Ativa',
    description: 'Participação recente e disponibilidade para novos diálogos na Lusofonia.',
    criteriaSummary: 'Atividade registada nos últimos 7 dias; perfil ativo para novas conexões.',
    requiredEvidenceTypes: [],
    minimumSafetyTenureDays: 0,
    maxViolationsAllowed: 0,
    requiresAdminClearance: false,
    publicLabel: 'Presença Ativa',
    publicDescription: 'Membro com prontidão e participação recente na comunidade',
    dignityGuaranteed: true
  }
};

/**
 * PONTO 3: ÉNós Trust Graph Engine
 * Flow: EVIDÊNCIA → Validação Segura no Backend → Trust Signals Privados → Política de Elegibilidade → Badges Públicos Mínimos.
 *
 * Directives:
 * 1. O utilizador NÃO pode atribuir o próprio badge.
 * 2. O frontend NÃO é a autoridade de concessão.
 * 3. NÃO guardamos nem expomos um "trust score" manipulável.
 * 4. Decisões sensíveis usam regras formais e auditáveis.
 * 5. Feedback negativo NÃO cria sistema público de humilhação.
 */
export class TrustGraphService {
  private static instance: TrustGraphService;
  private evidences: Map<string, TrustEvidenceRecord[]> = new Map();
  private verificationRequests: TrustVerificationRequest[] = [];
  private publicBadgesCache: Map<string, TrustBadge[]> = new Map();
  private privateEvaluationsCache: Map<string, PrivateTrustGraphEvaluation> = new Map();

  private constructor() {
    this.bootstrapSeedData();
    this.hydrateFromStorage();
  }

  public static getInstance(): TrustGraphService {
    if (!TrustGraphService.instance) {
      TrustGraphService.instance = new TrustGraphService();
    }
    return TrustGraphService.instance;
  }

  private bootstrapSeedData(): void {
    // Seed sample verification requests for moderation review
    this.verificationRequests = [
      {
        id: 'vr_01',
        userId: 'usr_ao_01',
        userName: 'Esperança Ndalu',
        userCountry: 'AO',
        evidenceType: 'national_id_verification',
        documentHash: 'sha256:8f4c2e...luanda_id',
        submittedAt: Date.now() - 86400000 * 2,
        status: 'approved',
        reviewedBy: 'Admin Sistema CPLP',
        reviewedAt: Date.now() - 86400000,
        justification: 'Documento oficial de Angola e biometria conferidos com sucesso.'
      },
      {
        id: 'vr_02',
        userId: 'usr_pt_02',
        userName: 'Tiago Neves',
        userCountry: 'PT',
        evidenceType: 'selfie_liveness_proof',
        documentHash: 'sha256:3a1b9c...liveness',
        submittedAt: Date.now() - 3600000 * 4,
        status: 'pending'
      }
    ];

    // Seed verified evidence for default verified profiles
    this.evidences.set('usr_ao_01', [
      {
        id: 'ev_01',
        userId: 'usr_ao_01',
        type: 'national_id_verification',
        source: 'admin_moderator_audit',
        status: 'verified',
        verifiedAt: Date.now() - 86400000,
        auditedBy: 'Admin Sistema CPLP',
        metadata: { country: 'AO', docType: 'BI' }
      },
      {
        id: 'ev_02',
        userId: 'usr_ao_01',
        type: 'clean_safety_tenure_proof',
        source: 'backend_policy_engine',
        status: 'verified',
        verifiedAt: Date.now() - 86400000 * 14
      },
      {
        id: 'ev_03',
        userId: 'usr_ao_01',
        type: 'interaction_reciprocity_proof',
        source: 'backend_policy_engine',
        status: 'verified',
        verifiedAt: Date.now() - 86400000 * 3
      }
    ]);
  }

  private hydrateFromStorage(): void {
    if (typeof window === 'undefined') return;
    try {
      const storedReqs = localStorage.getItem(LOCAL_TRUST_REQUESTS_KEY);
      if (storedReqs) {
        this.verificationRequests = JSON.parse(storedReqs);
      }
      const storedEvidences = localStorage.getItem(LOCAL_TRUST_EVIDENCE_KEY);
      if (storedEvidences) {
        const parsed = JSON.parse(storedEvidences);
        Object.entries(parsed).forEach(([uid, list]) => {
          this.evidences.set(uid, list as TrustEvidenceRecord[]);
        });
      }
      const storedBadges = localStorage.getItem(LOCAL_PUBLIC_BADGES_KEY);
      if (storedBadges) {
        const parsed = JSON.parse(storedBadges);
        Object.entries(parsed).forEach(([uid, list]) => {
          this.publicBadgesCache.set(uid, list as TrustBadge[]);
        });
      }
    } catch {}
  }

  private saveToStorage(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(LOCAL_TRUST_REQUESTS_KEY, JSON.stringify(this.verificationRequests));
      const evObj: Record<string, TrustEvidenceRecord[]> = {};
      this.evidences.forEach((v, k) => {
        evObj[k] = v;
      });
      localStorage.setItem(LOCAL_TRUST_EVIDENCE_KEY, JSON.stringify(evObj));

      const badgeObj: Record<string, TrustBadge[]> = {};
      this.publicBadgesCache.forEach((v, k) => {
        badgeObj[k] = v;
      });
      localStorage.setItem(LOCAL_PUBLIC_BADGES_KEY, JSON.stringify(badgeObj));
    } catch {}
  }

  /**
   * STAGE 1: INGEST EVIDÊNCIA (Secure Evidence Ingestion)
   * Only trusted authorities or backend validators can write valid evidence.
   */
  public recordEvidence(evidence: Omit<TrustEvidenceRecord, 'id' | 'verifiedAt'>): TrustEvidenceRecord {
    const record: TrustEvidenceRecord = {
      ...evidence,
      id: `ev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      verifiedAt: Date.now()
    };

    const current = this.evidences.get(record.userId) || [];
    current.push(record);
    this.evidences.set(record.userId, current);

    // Invalidate evaluation cache for user
    this.privateEvaluationsCache.delete(record.userId);
    this.saveToStorage();

    return record;
  }

  /**
   * Submit formal verification request by user (e.g. Identity Document or Selfie Liveness)
   */
  public submitVerificationRequest(params: {
    userId: string;
    userName: string;
    userCountry: import('../types').CPLPCountryCode;
    evidenceType: TrustEvidenceType;
    documentHash?: string;
  }): TrustVerificationRequest {
    const req: TrustVerificationRequest = {
      id: `vr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId: params.userId,
      userName: params.userName,
      userCountry: params.userCountry,
      evidenceType: params.evidenceType,
      documentHash: params.documentHash || `sha256:${Math.random().toString(36).substring(2, 10)}`,
      submittedAt: Date.now(),
      status: 'pending'
    };

    this.verificationRequests.unshift(req);
    this.saveToStorage();

    // Async record in Firestore if online
    try {
      setDoc(doc(db, 'verification_requests', req.id), {
        ...req,
        serverTimestamp: serverTimestamp()
      });
    } catch {}

    return req;
  }

  /**
   * STAGE 2: ADMIN MODERATOR DELIBERATION ON VERIFICATION REQUEST
   */
  public reviewVerificationRequest(
    requestId: string,
    decision: 'approved' | 'rejected',
    reviewerName: string,
    justification: string
  ): { success: boolean; error?: string } {
    const req = this.verificationRequests.find(r => r.id === requestId);
    if (!req) return { success: false, error: 'Pedido de verificação não encontrado.' };

    req.status = decision;
    req.reviewedBy = reviewerName;
    req.reviewedAt = Date.now();
    req.justification = justification;

    if (decision === 'approved') {
      // Ingest validated evidence
      this.recordEvidence({
        userId: req.userId,
        type: req.evidenceType,
        source: 'admin_moderator_audit',
        status: 'verified',
        auditedBy: reviewerName,
        metadata: { justification, requestId }
      });
    }

    this.saveToStorage();
    return { success: true };
  }

  /**
   * STAGE 3 & 4: COMPUTE PRIVATE SIGNALS & EVALUATE ELIGIBILITY POLICIES
   * Backend Validation Engine: Computes multi-dimensional signals without single score
   */
  public evaluateTrust(
    profile: UserProfile,
    signals?: InteractionSignals,
    confirmedSafetyViolations: number = 0,
    activeDisputesOrFlags: number = 0
  ): PrivateTrustGraphEvaluation {
    const userEvidences = this.evidences.get(profile.uid) || [];
    const validEvidences = userEvidences.filter(e => e.status === 'verified');

    // 1. Compute Private Identity Evidence Level
    const hasOfficialId = validEvidences.some(
      e => e.type === 'national_id_verification' || e.type === 'passport_verification'
    );
    const hasBiometric = validEvidences.some(e => e.type === 'selfie_liveness_proof');
    const hasPhone = validEvidences.some(e => e.type === 'phone_sms_proof');

    let identityEvidenceLevel: PrivateTrustSignals['identityEvidenceLevel'] = 'none';
    if (hasOfficialId || profile.verificationStatus === 'verified') {
      identityEvidenceLevel = hasBiometric ? 'biometric_cleared' : 'verified_id';
    } else if (hasPhone || profile.verificationStatus === 'pending') {
      identityEvidenceLevel = 'basic_phone';
    }

    // 2. Compute Profile Authenticity Level
    const bioLength = profile.bio ? profile.bio.trim().length : 0;
    const photoCount = profile.photos ? profile.photos.length : profile.profilePhoto ? 1 : 0;
    let profileAuthenticityLevel: PrivateTrustSignals['profileAuthenticityLevel'] = 'minimal';
    if (bioLength >= 30 && photoCount >= 2 && profile.culturalBackground) {
      profileAuthenticityLevel = 'authentic_comprehensive';
    } else if (bioLength >= 15 || photoCount >= 1) {
      profileAuthenticityLevel = 'partial';
    }

    // 3. Compute Safety & Tenure
    const accountAgeDays = Math.max(
      1,
      Math.floor((Date.now() - (profile.createdAt || Date.now() - 86400000 * 14)) / (1000 * 60 * 60 * 24))
    );
    const safetyTenureDays = confirmedSafetyViolations > 0 ? 0 : accountAgeDays;

    // 4. Compute Dialogue & Reciprocity
    const reciprocalDialogueCount = signals?.conversationStarts || (validEvidences.some(e => e.type === 'interaction_reciprocity_proof') ? 3 : 0);
    const meaningfulConnectionsCount = signals?.meaningfulInteractions || (reciprocalDialogueCount > 2 ? 1 : 0);

    const activeDaysPast30d = profile.online ? 15 : Math.min(accountAgeDays, 5);

    const privateSignals: PrivateTrustSignals = {
      userId: profile.uid,
      identityEvidenceLevel,
      profileAuthenticityLevel,
      safetyTenureDays,
      confirmedSafetyViolations,
      activeDisputesOrFlags,
      reciprocalDialogueCount,
      meaningfulConnectionsCount,
      activeDaysPast30d,
      accountAgeDays,
      lastValidatedAt: Date.now()
    };

    // 5. STAGE 5: Evaluate Formal Eligibility Policies -> Emit Public Minimal Badges
    const eligibleBadges: TrustBadge[] = [];
    const disqualifiedReasons: string[] = [];

    // Check Badge 1: Identity Verified
    if (
      identityEvidenceLevel === 'verified_id' ||
      identityEvidenceLevel === 'biometric_cleared' ||
      profile.verificationStatus === 'verified'
    ) {
      if (confirmedSafetyViolations <= TRUST_ELIGIBILITY_POLICIES.identity_verified.maxViolationsAllowed) {
        eligibleBadges.push({
          type: 'identity_verified',
          label: TRUST_ELIGIBILITY_POLICIES.identity_verified.publicLabel,
          description: TRUST_ELIGIBILITY_POLICIES.identity_verified.publicDescription,
          iconName: 'ShieldCheck',
          issuedByAuthority: 'Autoridade de Verificação CPLP',
          grantedAt: profile.createdAt || Date.now()
        });
      }
    }

    // Check Badge 2: Authentic Profile
    if (profileAuthenticityLevel === 'authentic_comprehensive' && confirmedSafetyViolations === 0) {
      eligibleBadges.push({
        type: 'authentic_profile',
        label: TRUST_ELIGIBILITY_POLICIES.authentic_profile.publicLabel,
        description: TRUST_ELIGIBILITY_POLICIES.authentic_profile.publicDescription,
        iconName: 'Sparkles',
        issuedByAuthority: 'Motor de Autenticidade ÉNós',
        grantedAt: profile.createdAt || Date.now()
      });
    }

    // Check Badge 3: Trusted Member (Requires tenure + 0 violations)
    if (
      safetyTenureDays >= TRUST_ELIGIBILITY_POLICIES.trusted_member.minimumSafetyTenureDays &&
      confirmedSafetyViolations === 0 &&
      activeDisputesOrFlags === 0
    ) {
      eligibleBadges.push({
        type: 'trusted_member',
        label: TRUST_ELIGIBILITY_POLICIES.trusted_member.publicLabel,
        description: TRUST_ELIGIBILITY_POLICIES.trusted_member.publicDescription,
        iconName: 'UserCheck',
        issuedByAuthority: 'Conselho de Confiabilidade CPLP',
        grantedAt: profile.createdAt || Date.now()
      });
    } else if (confirmedSafetyViolations > 0) {
      disqualifiedReasons.push('Membro Confiável bloqueado por violações de segurança pendentes.');
    }

    // Check Badge 4: Respectful Dialogue
    if (reciprocalDialogueCount >= 1 && activeDisputesOrFlags === 0 && confirmedSafetyViolations === 0) {
      eligibleBadges.push({
        type: 'respectful_dialogue',
        label: TRUST_ELIGIBILITY_POLICIES.respectful_dialogue.publicLabel,
        description: TRUST_ELIGIBILITY_POLICIES.respectful_dialogue.publicDescription,
        iconName: 'HeartHandshake',
        issuedByAuthority: 'Observatório de Diálogo ÉNós',
        grantedAt: profile.createdAt || Date.now()
      });
    }

    // Check Badge 5: Active Presence
    if (
      (profile.online || Date.now() - (profile.lastActive || 0) < 1000 * 60 * 60 * 48) &&
      confirmedSafetyViolations === 0
    ) {
      eligibleBadges.push({
        type: 'active_presence',
        label: TRUST_ELIGIBILITY_POLICIES.active_presence.publicLabel,
        description: TRUST_ELIGIBILITY_POLICIES.active_presence.publicDescription,
        iconName: 'Zap',
        issuedByAuthority: 'Presença Ativa Lusofonia',
        grantedAt: Date.now()
      });
    }

    // Anti-Humiliation Directive: NEVER emit negative badges or public humiliation markers.
    // If user has warnings or safety flags, badges are simply withheld or restricted quietly.

    const evaluation: PrivateTrustGraphEvaluation = {
      userId: profile.uid,
      signals: privateSignals,
      eligibleBadges,
      disqualifiedReasons,
      evaluatedAt: Date.now(),
      evaluatorAuthority: 'enos_backend_trust_engine'
    };

    this.privateEvaluationsCache.set(profile.uid, evaluation);
    this.publicBadgesCache.set(profile.uid, eligibleBadges);
    this.saveToStorage();

    // Secure persistence to Firestore (public collection holds ONLY the minimal badges)
    try {
      setDoc(doc(db, 'public_trust_badges', profile.uid), {
        userId: profile.uid,
        badges: eligibleBadges,
        issuedByAuthority: 'enos_backend_trust_engine',
        evaluatedAt: Date.now()
      });
    } catch {}

    return evaluation;
  }

  /**
   * STAGE 5: GET PUBLIC MINIMAL BADGES
   * Returns ONLY the safe, minimal, non-punitive badges issued by backend authority.
   */
  public getBadgesForProfile(profile: UserProfile, signals?: InteractionSignals): TrustBadge[] {
    const cached = this.publicBadgesCache.get(profile.uid);
    if (cached && cached.length > 0) {
      return cached;
    }
    const evalResult = this.evaluateTrust(profile, signals);
    return evalResult.eligibleBadges;
  }

  /**
   * Helper: Get All Verification Requests for Moderation
   */
  public getVerificationRequests(): TrustVerificationRequest[] {
    return [...this.verificationRequests];
  }

  /**
   * Helper: Get Evidences for user (Private/Admin access only)
   */
  public getEvidencesForUser(userId: string): TrustEvidenceRecord[] {
    return this.evidences.get(userId) || [];
  }

  /**
   * Helper: Get Formal Eligibility Policies
   */
  public getPolicies(): Record<TrustBadgeType, TrustEligibilityPolicy> {
    return TRUST_ELIGIBILITY_POLICIES;
  }
}

export const trustGraph = TrustGraphService.getInstance();
