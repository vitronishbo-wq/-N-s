import crypto from 'crypto';
import {
  TrustBadge,
  TrustEligibilityPolicy,
  TrustBadgeType,
  ImmutableTrustEvidenceRecord,
  VerificationSubmissionPayload,
  TrustVerificationRequest,
  CPLPCountryCode
} from '../types';
import { verificationAuthority } from './verificationAuthority';
import { mcrAuthority } from './mcrAuthority';

export interface CanonicalUserProfile {
  uid: string;
  displayName: string;
  bio?: string;
  photos?: string[];
  profilePhoto?: string;
  countryCode?: CPLPCountryCode;
  cityName?: string;
  verificationStatus?: 'verified' | 'pending' | 'unverified';
  createdAt: number;
  lastActive: number;
  online: boolean;
}

export interface BackendTrustEvaluationResponse {
  userId: string;
  badges: TrustBadge[];
  evaluatedAt: number;
  evaluatorAuthority: string;
  signature: string;
  verifiedEvidencesCount: number;
  disqualifiedReasons?: string[];
  signalsSummary: {
    identityLevel: 'none' | 'basic_phone' | 'verified_id' | 'biometric_cleared';
    authenticityLevel: 'minimal' | 'partial' | 'authentic_comprehensive';
    safetyTenureDays: number;
    dialogueReciprocity: number;
    serverAuditedMcrEvents: number;
    immutableEvidenceProofCount: number;
  };
}

export const SERVER_TRUST_POLICIES: Record<TrustBadgeType, TrustEligibilityPolicy> = {
  identity_verified: {
    badgeType: 'identity_verified',
    title: 'Identidade Verificada',
    description: 'Validação segura de identidade por documento oficial, passaporte ou prova biométrica.',
    criteriaSummary: 'Prova oficial de documento governamental ou biometria liveness no registo imutável; 0 violações.',
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
    criteriaSummary: 'Bio expressiva (>30 chars), múltiplas fotos genuínas e atestação de autenticidade comunitária.',
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
    criteriaSummary: 'Permanência ativa ≥ 7 dias, histórico limpo e zero incidentes no livro de segurança.',
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
    criteriaSummary: 'Múltiplas conversas com reciprocidade comprovada no funil MCR e zero denúncias aceites.',
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
    criteriaSummary: 'Atividade e prontidão recente na comunidade CPLP nos últimos 2 dias.',
    requiredEvidenceTypes: [],
    minimumSafetyTenureDays: 0,
    maxViolationsAllowed: 0,
    requiresAdminClearance: false,
    publicLabel: 'Presença Ativa',
    publicDescription: 'Membro com prontidão e participação recente na comunidade',
    dignityGuaranteed: true
  }
};

export class TrustAuthority {
  private static instance: TrustAuthority;
  private secretKey: string = process.env.TRUST_ENGINE_SECRET || 'enos_trust_engine_sec_key_cplp_2026';

  // Server-Authoritative Immutable Evidence Ledger: userId -> ImmutableTrustEvidenceRecord[]
  private immutableLedger: Map<string, ImmutableTrustEvidenceRecord[]> = new Map();

  // Server-Authoritative Safety Ledger: userId -> { violations, activeDisputes }
  private safetyLedger: Map<string, { violations: number; activeDisputes: number; flags: string[] }> = new Map();

  // Server-Authoritative User Repository: userId -> CanonicalUserProfile
  private canonicalProfiles: Map<string, CanonicalUserProfile> = new Map();

  // Verification Requests in review
  private verificationRequests: Map<string, TrustVerificationRequest> = new Map();

  private constructor() {
    this.seedCanonicalProfilesAndEvidences();
  }

  public static getInstance(): TrustAuthority {
    if (!TrustAuthority.instance) {
      TrustAuthority.instance = new TrustAuthority();
    }
    return TrustAuthority.instance;
  }

  private seedCanonicalProfilesAndEvidences() {
    // Seed canonical user profile: Esperança (AO)
    this.canonicalProfiles.set('usr_ao_01', {
      uid: 'usr_ao_01',
      displayName: 'Esperança Ndalu',
      bio: 'Engenheira de software em Luanda. Apaixonada pela cultura angolana e música lusófona.',
      photos: ['https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80'],
      profilePhoto: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80',
      countryCode: 'AO',
      cityName: 'Luanda',
      verificationStatus: 'verified',
      createdAt: Date.now() - 86400000 * 30,
      lastActive: Date.now() - 3600000,
      online: true
    });

    // Seed immutable evidences for Esperança (AO)
    const aoDocId = `ev_immut_${Date.now()}_ao01`;
    const aoDocHash = verificationAuthority.generateEvidenceHash('usr_ao_01', 'national_id_verification', 'AO:0048****A042:Esperança Ndalu');
    const aoDocSig = verificationAuthority.signEvidenceRecord(aoDocId, 'usr_ao_01', 'national_id_verification', aoDocHash, Date.now() - 86400000 * 15);

    const aoBioId = `ev_immut_${Date.now()}_ao02`;
    const aoBioHash = verificationAuthority.generateEvidenceHash('usr_ao_01', 'selfie_liveness_proof', 'liveness:0.95:parity:0.94');
    const aoBioSig = verificationAuthority.signEvidenceRecord(aoBioId, 'usr_ao_01', 'selfie_liveness_proof', aoBioHash, Date.now() - 86400000 * 15);

    const aoTenureId = `ev_immut_${Date.now()}_ao03`;
    const aoTenureHash = verificationAuthority.generateEvidenceHash('usr_ao_01', 'clean_safety_tenure_proof', 'attested:clean_record');
    const aoTenureSig = verificationAuthority.signEvidenceRecord(aoTenureId, 'usr_ao_01', 'clean_safety_tenure_proof', aoTenureHash, Date.now() - 86400000 * 15);

    const aoReciprocityId = `ev_immut_${Date.now()}_ao04`;
    const aoReciprocityHash = verificationAuthority.generateEvidenceHash('usr_ao_01', 'interaction_reciprocity_proof', 'attested:mcr_funnel');
    const aoReciprocitySig = verificationAuthority.signEvidenceRecord(aoReciprocityId, 'usr_ao_01', 'interaction_reciprocity_proof', aoReciprocityHash, Date.now() - 86400000 * 10);

    this.immutableLedger.set('usr_ao_01', [
      {
        id: aoDocId,
        userId: 'usr_ao_01',
        type: 'national_id_verification',
        source: 'national_registry_verifier',
        status: 'verified',
        evidenceHash: aoDocHash,
        authoritySignature: aoDocSig,
        verifiedAt: Date.now() - 86400000 * 15,
        auditedBy: 'Autoridade de Verificação CPLP (Validador Independente)',
        verificationDetails: {
          documentType: 'NATIONAL_ID',
          countryCode: 'AO',
          documentNumberMasked: '0048****A042',
          documentFormatValid: true,
          antiSpoofingPassed: true,
          verificationNotes: 'Bilhete de Identidade Angolano validado com sucesso.'
        }
      },
      {
        id: aoBioId,
        userId: 'usr_ao_01',
        type: 'selfie_liveness_proof',
        source: 'biometric_provider',
        status: 'verified',
        evidenceHash: aoBioHash,
        authoritySignature: aoBioSig,
        verifiedAt: Date.now() - 86400000 * 15,
        auditedBy: 'Motor Biométrico 3D Liveness ÉNós',
        verificationDetails: {
          biometricLivenessScore: 0.95,
          faceMatchParityScore: 0.94,
          antiSpoofingPassed: true
        }
      },
      {
        id: aoTenureId,
        userId: 'usr_ao_01',
        type: 'clean_safety_tenure_proof',
        source: 'system_crypto_validation',
        status: 'verified',
        evidenceHash: aoTenureHash,
        authoritySignature: aoTenureSig,
        verifiedAt: Date.now() - 86400000 * 15,
        auditedBy: 'Motor de Confiabilidade Comunitária ÉNós',
        verificationDetails: {
          safetyTenureDaysAttested: 30
        }
      },
      {
        id: aoReciprocityId,
        userId: 'usr_ao_01',
        type: 'interaction_reciprocity_proof',
        source: 'system_crypto_validation',
        status: 'verified',
        evidenceHash: aoReciprocityHash,
        authoritySignature: aoReciprocitySig,
        verifiedAt: Date.now() - 86400000 * 10,
        auditedBy: 'Observatório MCR ÉNós',
        verificationDetails: {
          auditedMcrConversations: 3
        }
      }
    ]);

    // Seed canonical profile: Mariana (PT)
    this.canonicalProfiles.set('usr_pt_02', {
      uid: 'usr_pt_02',
      displayName: 'Mariana Silva',
      bio: 'Arquiteta e fotógrafa em Lisboa. Curiosa por literatura africana e viagens no Atlântico Sul.',
      photos: [
        'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=600&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=600&auto=format&fit=crop&q=80'
      ],
      profilePhoto: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=600&auto=format&fit=crop&q=80',
      countryCode: 'PT',
      cityName: 'Lisboa',
      verificationStatus: 'verified',
      createdAt: Date.now() - 86400000 * 18,
      lastActive: Date.now() - 1800000,
      online: true
    });

    const ptDocId = `ev_immut_${Date.now()}_pt01`;
    const ptDocHash = verificationAuthority.generateEvidenceHash('usr_pt_02', 'national_id_verification', 'PT:1482****2ZZ8:Mariana Silva');
    const ptDocSig = verificationAuthority.signEvidenceRecord(ptDocId, 'usr_pt_02', 'national_id_verification', ptDocHash, Date.now() - 86400000 * 14);

    const ptBioId = `ev_immut_${Date.now()}_pt02`;
    const ptBioHash = verificationAuthority.generateEvidenceHash('usr_pt_02', 'selfie_liveness_proof', 'liveness:0.96:parity:0.95');
    const ptBioSig = verificationAuthority.signEvidenceRecord(ptBioId, 'usr_pt_02', 'selfie_liveness_proof', ptBioHash, Date.now() - 86400000 * 14);

    this.immutableLedger.set('usr_pt_02', [
      {
        id: ptDocId,
        userId: 'usr_pt_02',
        type: 'national_id_verification',
        source: 'national_registry_verifier',
        status: 'verified',
        evidenceHash: ptDocHash,
        authoritySignature: ptDocSig,
        verifiedAt: Date.now() - 86400000 * 14,
        auditedBy: 'Autoridade de Verificação CPLP (Validador Independente)',
        verificationDetails: {
          documentType: 'NATIONAL_ID',
          countryCode: 'PT',
          documentNumberMasked: '1482****2ZZ8',
          documentFormatValid: true,
          antiSpoofingPassed: true
        }
      },
      {
        id: ptBioId,
        userId: 'usr_pt_02',
        type: 'selfie_liveness_proof',
        source: 'biometric_provider',
        status: 'verified',
        evidenceHash: ptBioHash,
        authoritySignature: ptBioSig,
        verifiedAt: Date.now() - 86400000 * 14,
        auditedBy: 'Motor Biométrico 3D Liveness ÉNós',
        verificationDetails: {
          biometricLivenessScore: 0.96,
          faceMatchParityScore: 0.95,
          antiSpoofingPassed: true
        }
      }
    ]);

    // Seed pending verification request
    const reqId = 'vr_seed_pt_01';
    this.verificationRequests.set(reqId, {
      id: reqId,
      userId: 'usr_pt_09',
      userName: 'Tiago Neves',
      userCountry: 'PT',
      evidenceType: 'national_id_verification',
      documentHash: 'sha256:7b91a0...pt_cc',
      submittedAt: Date.now() - 3600000 * 6,
      status: 'pending'
    });
  }

  /**
   * Updates or registers canonical profile data on server
   */
  public registerCanonicalProfile(profile: Partial<CanonicalUserProfile> & { uid: string }) {
    const existing = this.canonicalProfiles.get(profile.uid) || {
      uid: profile.uid,
      displayName: profile.displayName || 'Membro ÉNós',
      createdAt: Date.now(),
      lastActive: Date.now(),
      online: true,
      verificationStatus: 'unverified'
    };

    this.canonicalProfiles.set(profile.uid, {
      ...existing,
      ...profile
    });
  }

  /**
   * STAGE 1 & 2: Process and Verify Evidence through Independent Verification Authority
   * Resulting record is cryptographically signed and stored in the Immutable Ledger.
   */
  public submitAndVerifyEvidence(payload: VerificationSubmissionPayload): {
    success: boolean;
    evidenceRecord?: ImmutableTrustEvidenceRecord;
    error?: string;
  } {
    const result = verificationAuthority.processSubmission(payload);
    if (!result.verified || !result.evidenceRecord) {
      return {
        success: false,
        error: result.rejectionReason || 'Submissão de evidência rejeitada pela autoridade independente.'
      };
    }

    const record = result.evidenceRecord;

    // Append to server immutable ledger
    const list = this.immutableLedger.get(payload.userId) || [];
    // Replace existing of same type if already present
    const updated = list.filter(e => e.type !== record.type);
    updated.push(record);
    this.immutableLedger.set(payload.userId, updated);

    // Update canonical profile verification status if official ID or biometric passed
    if (record.type === 'national_id_verification' || record.type === 'passport_verification' || record.type === 'selfie_liveness_proof') {
      const p = this.canonicalProfiles.get(payload.userId);
      if (p) {
        p.verificationStatus = 'verified';
        this.canonicalProfiles.set(payload.userId, p);
      }
    }

    return {
      success: true,
      evidenceRecord: record
    };
  }

  /**
   * STAGE 3: Retrieve Verified Immutable Evidences for a User (Guaranteed cryptographic integrity)
   */
  public getImmutableEvidences(userId: string): ImmutableTrustEvidenceRecord[] {
    const records = this.immutableLedger.get(userId) || [];
    // Verify each signature before returning
    return records.filter(r => r.status === 'verified' && verificationAuthority.verifyEvidenceSignature(r));
  }

  /**
   * Admin Manual Verification & Clearance
   */
  public adminVerifyRequest(params: {
    requestId: string;
    adminUid: string;
    approved: boolean;
    justification: string;
  }): { success: boolean; evidence?: ImmutableTrustEvidenceRecord; error?: string } {
    const req = this.verificationRequests.get(params.requestId);
    if (!req) {
      return { success: false, error: 'Pedido de verificação não encontrado' };
    }

    req.status = params.approved ? 'approved' : 'rejected';
    req.reviewedBy = params.adminUid;
    req.reviewedAt = Date.now();
    req.justification = params.justification;
    this.verificationRequests.set(params.requestId, req);

    if (params.approved) {
      const recordId = `ev_immut_${Date.now()}_admin_${crypto.randomBytes(3).toString('hex')}`;
      const hash = verificationAuthority.generateEvidenceHash(
        req.userId,
        req.evidenceType,
        `admin_clearance:${params.adminUid}:${req.userCountry}`
      );
      const sig = verificationAuthority.signEvidenceRecord(
        recordId,
        req.userId,
        req.evidenceType,
        hash,
        Date.now()
      );

      const record: ImmutableTrustEvidenceRecord = {
        id: recordId,
        userId: req.userId,
        type: req.evidenceType,
        source: 'admin_moderator_audit',
        status: 'verified',
        evidenceHash: hash,
        authoritySignature: sig,
        verifiedAt: Date.now(),
        auditedBy: `Administrador CPLP (${params.adminUid})`,
        verificationDetails: {
          countryCode: req.userCountry,
          verificationNotes: params.justification
        }
      };

      const list = this.immutableLedger.get(req.userId) || [];
      list.push(record);
      this.immutableLedger.set(req.userId, list);

      const p = this.canonicalProfiles.get(req.userId);
      if (p) {
        p.verificationStatus = 'verified';
      }

      return { success: true, evidence: record };
    }

    return { success: true };
  }

  public getPendingVerificationRequests(): TrustVerificationRequest[] {
    return Array.from(this.verificationRequests.values());
  }

  /**
   * STAGE 4 & 5: SERVER-AUTHORITATIVE POLICY EVALUATION
   * Evaluates Trust Graph ONLY based on Verified Immutable Evidence Ledger,
   * Server-Audited MCR History, and Canonical Safety Records.
   *
   * DIRECTIVE: Does NOT trust or accept client-supplied evidences or spoofed signals!
   */
  public evaluate(userId: string): BackendTrustEvaluationResponse {
    const evaluatedAt = Date.now();

    // 1. Retrieve verified immutable evidence records from server ledger
    const rawEvidences = this.immutableLedger.get(userId) || [];
    // Enforce cryptographic audit check on every single evidence record
    const verifiedEvidences = rawEvidences.filter(r => {
      return r.status === 'verified' && verificationAuthority.verifyEvidenceSignature(r);
    });

    // 2. Retrieve safety ledger and canonical profile
    const safety = this.safetyLedger.get(userId) || { violations: 0, activeDisputes: 0, flags: [] };
    const confirmedViolations = safety.violations;
    const activeDisputes = safety.activeDisputes;

    const profile = this.canonicalProfiles.get(userId) || {
      uid: userId,
      displayName: 'Membro Lusófono',
      createdAt: Date.now() - 86400000 * 14,
      lastActive: Date.now(),
      online: true,
      verificationStatus: verifiedEvidences.some(e => e.type === 'national_id_verification' || e.type === 'passport_verification') ? 'verified' : 'unverified'
    };

    // 3. Query Server-Audited MCR Funnel logs for real reciprocity metrics
    const auditedMcrLogs = mcrAuthority.queryAuditLogs(
      { userId, timeframe: 'all' },
      userId,
      true // system authority permission
    );
    const conversationsStarted = auditedMcrLogs.filter(
      l => l.stageRank >= 5 || l.stage === 'CONVERSATION_STARTED' || l.stage === 'MEANINGFUL_RECIPROCITY' || l.stage === 'MEANINGFUL_CONNECTION'
    ).length;

    // 4. Derive Server-Authoritative Trust Signals
    const hasNationalId = verifiedEvidences.some(e => e.type === 'national_id_verification' || e.type === 'passport_verification');
    const hasBiometric = verifiedEvidences.some(e => e.type === 'selfie_liveness_proof');
    const hasPhone = verifiedEvidences.some(e => e.type === 'phone_sms_proof');

    let identityLevel: 'none' | 'basic_phone' | 'verified_id' | 'biometric_cleared' = 'none';
    if (hasBiometric && hasNationalId) {
      identityLevel = 'biometric_cleared';
    } else if (hasNationalId || profile.verificationStatus === 'verified') {
      identityLevel = 'verified_id';
    } else if (hasPhone) {
      identityLevel = 'basic_phone';
    }

    const bioLength = profile.bio ? profile.bio.trim().length : 0;
    const photoCount = profile.photos ? profile.photos.length : profile.profilePhoto ? 1 : 0;
    const hasCommunityProof = verifiedEvidences.some(e => e.type === 'community_contribution_proof');
    const isAuthentic = (bioLength >= 30 && photoCount >= 2) || hasCommunityProof;
    const authenticityLevel: 'minimal' | 'partial' | 'authentic_comprehensive' = isAuthentic
      ? 'authentic_comprehensive'
      : bioLength >= 15
      ? 'partial'
      : 'minimal';

    const accountAgeDays = Math.max(
      1,
      Math.floor((Date.now() - (profile.createdAt || Date.now() - 86400000 * 14)) / (1000 * 60 * 60 * 24))
    );
    const hasTenureProof = verifiedEvidences.some(e => e.type === 'clean_safety_tenure_proof');
    const safetyTenureDays = confirmedViolations > 0 ? 0 : hasTenureProof ? Math.max(accountAgeDays, 14) : accountAgeDays;

    const hasReciprocityProof = verifiedEvidences.some(e => e.type === 'interaction_reciprocity_proof');
    const dialogueReciprocity = conversationsStarted + (hasReciprocityProof ? 2 : 0);

    // 5. Evaluate Formal Eligibility Policies -> Emits Signed Public Badges
    const badges: TrustBadge[] = [];
    const disqualifiedReasons: string[] = [];

    // Badge 1: Identity Verified
    if ((identityLevel === 'verified_id' || identityLevel === 'biometric_cleared') && confirmedViolations === 0) {
      badges.push({
        type: 'identity_verified',
        label: SERVER_TRUST_POLICIES.identity_verified.publicLabel,
        description: SERVER_TRUST_POLICIES.identity_verified.publicDescription,
        iconName: 'ShieldCheck',
        issuedByAuthority: 'Autoridade de Verificação CPLP',
        grantedAt: evaluatedAt
      });
    }

    // Badge 2: Authentic Profile
    if (authenticityLevel === 'authentic_comprehensive' && confirmedViolations === 0) {
      badges.push({
        type: 'authentic_profile',
        label: SERVER_TRUST_POLICIES.authentic_profile.publicLabel,
        description: SERVER_TRUST_POLICIES.authentic_profile.publicDescription,
        iconName: 'Sparkles',
        issuedByAuthority: 'Motor de Autenticidade ÉNós',
        grantedAt: evaluatedAt
      });
    }

    // Badge 3: Trusted Member
    if (safetyTenureDays >= SERVER_TRUST_POLICIES.trusted_member.minimumSafetyTenureDays && confirmedViolations === 0 && activeDisputes === 0) {
      badges.push({
        type: 'trusted_member',
        label: SERVER_TRUST_POLICIES.trusted_member.publicLabel,
        description: SERVER_TRUST_POLICIES.trusted_member.publicDescription,
        iconName: 'UserCheck',
        issuedByAuthority: 'Conselho de Confiabilidade CPLP',
        grantedAt: evaluatedAt
      });
    } else if (confirmedViolations > 0) {
      disqualifiedReasons.push('Distintivo de Membro Confiável retido devido a histórico de moderação ativo.');
    }

    // Badge 4: Respectful Dialogue
    if (dialogueReciprocity >= 1 && confirmedViolations === 0 && activeDisputes === 0) {
      badges.push({
        type: 'respectful_dialogue',
        label: SERVER_TRUST_POLICIES.respectful_dialogue.publicLabel,
        description: SERVER_TRUST_POLICIES.respectful_dialogue.publicDescription,
        iconName: 'HeartHandshake',
        issuedByAuthority: 'Observatório de Diálogo ÉNós',
        grantedAt: evaluatedAt
      });
    }

    // Badge 5: Active Presence
    if ((profile.online || Date.now() - (profile.lastActive || 0) < 1000 * 60 * 60 * 48) && confirmedViolations === 0) {
      badges.push({
        type: 'active_presence',
        label: SERVER_TRUST_POLICIES.active_presence.publicLabel,
        description: SERVER_TRUST_POLICIES.active_presence.publicDescription,
        iconName: 'Zap',
        issuedByAuthority: 'Presença Ativa Lusofonia',
        grantedAt: evaluatedAt
      });
    }

    // 6. Generate Cryptographic Signature to ensure badge tamper-resistance
    const badgePayload = `${userId}:${evaluatedAt}:${badges.map(b => b.type).sort().join(',')}:${verifiedEvidences.length}`;
    const signature = crypto.createHmac('sha256', this.secretKey).update(badgePayload).digest('hex');

    return {
      userId,
      badges,
      evaluatedAt,
      evaluatorAuthority: 'enos_backend_trust_authority_v2',
      signature,
      verifiedEvidencesCount: verifiedEvidences.length,
      disqualifiedReasons: disqualifiedReasons.length > 0 ? disqualifiedReasons : undefined,
      signalsSummary: {
        identityLevel,
        authenticityLevel,
        safetyTenureDays,
        dialogueReciprocity,
        serverAuditedMcrEvents: auditedMcrLogs.length,
        immutableEvidenceProofCount: verifiedEvidences.length
      }
    };
  }
}

export const trustAuthority = TrustAuthority.getInstance();
