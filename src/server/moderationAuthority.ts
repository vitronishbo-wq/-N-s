import { moderateContent } from '../services/ai';

export interface ModerationResult {
  isSafe: boolean;
  reason?: string;
  flaggedCategories?: string[];
  severity?: 'none' | 'low' | 'medium' | 'high';
  checkedAt: number;
  authority: string;
}

export class ModerationAuthority {
  private static instance: ModerationAuthority;

  private constructor() {}

  public static getInstance(): ModerationAuthority {
    if (!ModerationAuthority.instance) {
      ModerationAuthority.instance = new ModerationAuthority();
    }
    return ModerationAuthority.instance;
  }

  public async evaluateText(text: string, context?: { userId?: string; field?: string }): Promise<ModerationResult> {
    const checkedAt = Date.now();
    const cleanText = (text || '').trim();

    if (!cleanText) {
      return {
        isSafe: true,
        checkedAt,
        authority: 'enos_moderation_authority_v2'
      };
    }

    // Heuristic pre-filter for severe abuse/scams
    const severePatterns = [
      /\b(fraude|golpe|esquema|piramide|cripto_falso|transferencia_urgente)\b/i,
      /\b(pedofilia|abuso|ameaça_morte|violencia_extrema)\b/i
    ];

    for (const pattern of severePatterns) {
      if (pattern.test(cleanText)) {
        return {
          isSafe: false,
          reason: 'Conteúdo viola as regras de segurança e integridade da comunidade ÉNós CPLP.',
          flaggedCategories: ['security_violation', 'scam_prevention'],
          severity: 'high',
          checkedAt,
          authority: 'enos_moderation_authority_v2'
        };
      }
    }

    try {
      const aiResult = await moderateContent(cleanText);
      return {
        isSafe: aiResult.isSafe,
        reason: aiResult.reason,
        flaggedCategories: aiResult.isSafe ? [] : ['cultural_respect'],
        severity: aiResult.isSafe ? 'none' : 'medium',
        checkedAt,
        authority: 'enos_moderation_authority_gemini'
      };
    } catch (err) {
      return {
        isSafe: true,
        checkedAt,
        authority: 'enos_moderation_fallback'
      };
    }
  }
}

export const moderationAuthority = ModerationAuthority.getInstance();
