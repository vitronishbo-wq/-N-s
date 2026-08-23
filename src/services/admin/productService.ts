import { ProductFeatureFlag, AdminUser, CPLPCountryCode } from '../../types';
import { AuditService } from './auditService';
import { RbacService } from './rbacService';

const PRODUCT_FLAGS_STORAGE_KEY = 'en_product_flags_v1';

export class ProductService {
  private static instance: ProductService;
  private flags: ProductFeatureFlag[] = [];

  private constructor() {
    this.bootstrapFlags();
  }

  public static getInstance(): ProductService {
    if (!ProductService.instance) {
      ProductService.instance = new ProductService();
    }
    return ProductService.instance;
  }

  private bootstrapFlags(): void {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(PRODUCT_FLAGS_STORAGE_KEY);
        if (stored) {
          this.flags = JSON.parse(stored);
          return;
        }
      } catch {}
    }

    this.flags = [
      {
        key: 'cplp_expansion_v2',
        name: 'Expansão Lusófona Inteligente (v2)',
        description: 'Algoritmo de expansão progressiva para países irmãos da lusofonia em baixa densidade.',
        enabled: true,
        rolloutPercentage: 100,
        allowedCohorts: ['all'],
        allowedCountries: ['AO', 'BR', 'CV', 'GW', 'GQ', 'MZ', 'PT', 'ST', 'TL'],
        tags: ['discovery', 'core'],
        updatedAt: Date.now() - 86400000,
        updatedBy: 'Sila Marco'
      },
      {
        key: 'ai_bio_enhancer',
        name: 'Gerador Assistido de Bios Culturais',
        description: 'Sugestões de bio orientadas por IA com foco em interesses e gírias lusófonas.',
        enabled: true,
        rolloutPercentage: 50,
        allowedCohorts: ['verified_only', 'early_adopters'],
        allowedCountries: ['AO', 'BR', 'PT', 'MZ', 'CV'],
        tags: ['ai', 'profile'],
        updatedAt: Date.now() - 43200000,
        updatedBy: 'Sila Marco'
      },
      {
        key: 'video_intro_tier',
        name: 'Vídeo Apresentação (Short Clips)',
        description: 'Permite clipes curtos de 10s no perfil para demonstrar sotaque e carisma.',
        enabled: false,
        rolloutPercentage: 0,
        allowedCohorts: ['beta_testers'],
        allowedCountries: ['BR', 'PT'],
        tags: ['media', 'experimental'],
        updatedAt: Date.now() - 172800000,
        updatedBy: 'Sila Marco'
      }
    ];
  }

  private saveState(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(PRODUCT_FLAGS_STORAGE_KEY, JSON.stringify(this.flags));
    } catch {}
  }

  public getFlags(): ProductFeatureFlag[] {
    return [...this.flags];
  }

  /**
   * Evaluates feature flag exposure without coupling UI components to flag internal store
   */
  public isFeatureEnabled(
    flagKey: string,
    context?: {
      userId?: string;
      countryCode?: CPLPCountryCode;
      isVerified?: boolean;
    }
  ): boolean {
    const flag = this.flags.find(f => f.key === flagKey);
    if (!flag || !flag.enabled) return false;

    // Check Country
    if (context?.countryCode && flag.allowedCountries.length > 0) {
      if (!flag.allowedCountries.includes(context.countryCode)) {
        return false;
      }
    }

    // Check Cohorts
    if (flag.allowedCohorts.includes('verified_only') && !context?.isVerified) {
      return false;
    }

    // Check Percentage Rollout (deterministic hash on userId if provided)
    if (flag.rolloutPercentage < 100) {
      if (flag.rolloutPercentage <= 0) return false;
      if (context?.userId) {
        let hash = 0;
        for (let i = 0; i < context.userId.length; i++) {
          hash = (hash << 5) - hash + context.userId.charCodeAt(i);
          hash |= 0;
        }
        const bucket = Math.abs(hash) % 100;
        return bucket < flag.rolloutPercentage;
      }
    }

    return true;
  }

  public updateFlag(
    flagKey: string,
    updates: Partial<Pick<ProductFeatureFlag, 'enabled' | 'rolloutPercentage' | 'allowedCohorts' | 'allowedCountries'>>,
    actor: AdminUser
  ): { success: boolean; error?: string } {
    const rbac = RbacService.getInstance();
    if (!rbac.can(actor, 'product:flags:write')) {
      return { success: false, error: 'Permissão insuficiente para atualizar feature flags.' };
    }

    const flag = this.flags.find(f => f.key === flagKey);
    if (!flag) {
      return { success: false, error: 'Feature Flag não encontrada.' };
    }

    const prev = { ...flag };
    Object.assign(flag, updates, {
      updatedAt: Date.now(),
      updatedBy: actor.displayName || actor.name || actor.email
    });

    this.saveState();

    AuditService.getInstance().logMutation(actor, {
      module: 'product',
      resourceType: 'feature_flag',
      resourceId: flagKey,
      action: 'UPDATE_FEATURE_FLAG',
      previousState: prev,
      newState: flag,
      justification: `Atualização de rollout para ${flag.rolloutPercentage}% e status ${flag.enabled ? 'Ativo' : 'Inativo'}`
    });

    return { success: true };
  }
}
