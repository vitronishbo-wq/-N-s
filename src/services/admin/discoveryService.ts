import { AdminUser, CPLPCountryCode } from '../../types';
import { AuditService } from './auditService';
import { RbacService } from './rbacService';

export interface DiscoveryEngineConfig {
  version: string;
  status: 'ACTIVE' | 'PAUSED' | 'MAINTENANCE';
  algorithm: 'DETERMINISTIC' | 'HYBRID' | 'VECTOR_SIMILARITY';
  aiInfluence: 'NONE' | 'EXPLANATION_ONLY' | 'RERANKING' | 'FULL';
  culturalWeight: number;
  proximityWeight: number;
  reciprocityWeight: number;
  updatedAt: number;
  updatedBy: string;
}

export interface DiscoveryAvailability {
  id: string;
  city: string;
  country: CPLPCountryCode;
  density: 'HIGH' | 'AVAILABLE' | 'LOW' | 'EXPANDING';
  activeProfiles: number;
  expansionIncentiveActive: boolean;
}

export interface ExpansionPolicy {
  scope: 'CITY' | 'REGION' | 'COUNTRY' | 'CPLP_SELECTED' | 'CPLP_GLOBAL';
  status: 'ACTIVE' | 'DISABLED';
  description: string;
  allowedCountries: CPLPCountryCode[];
}

export interface RankingFactor {
  id: string;
  name: string;
  weight: number;
  description: string;
  enabled: boolean;
}

export interface DiversityConfig {
  maxSameCityRatio: number;
  cplpCrossBorderRatio: number;
  minAgeSpan: number;
  maxAgeSpan: number;
  enforceCulturalVariety: boolean;
}

const DISCOVERY_CONFIG_STORAGE_KEY = 'en_discovery_config_v2';

export class DiscoveryService {
  private static instance: DiscoveryService;

  private engine: DiscoveryEngineConfig = {
    version: 'MATCHING_V1',
    status: 'ACTIVE',
    algorithm: 'DETERMINISTIC',
    aiInfluence: 'EXPLANATION_ONLY',
    culturalWeight: 85,
    proximityWeight: 70,
    reciprocityWeight: 90,
    updatedAt: Date.now() - 3600000 * 24,
    updatedBy: 'Marcelo Truman (Founder)'
  };

  private availability: DiscoveryAvailability[] = [
    { id: 'loc_luanda', city: 'Luanda', country: 'AO', density: 'AVAILABLE', activeProfiles: 3420, expansionIncentiveActive: false },
    { id: 'loc_huambo', city: 'Huambo', country: 'AO', density: 'LOW', activeProfiles: 280, expansionIncentiveActive: true },
    { id: 'loc_benguela', city: 'Benguela', country: 'AO', density: 'AVAILABLE', activeProfiles: 890, expansionIncentiveActive: false },
    { id: 'loc_sp', city: 'São Paulo', country: 'BR', density: 'AVAILABLE', activeProfiles: 8940, expansionIncentiveActive: false },
    { id: 'loc_rio', city: 'Rio de Janeiro', country: 'BR', density: 'AVAILABLE', activeProfiles: 4510, expansionIncentiveActive: false },
    { id: 'loc_lisboa', city: 'Lisboa', country: 'PT', density: 'AVAILABLE', activeProfiles: 5620, expansionIncentiveActive: false },
    { id: 'loc_porto', city: 'Porto', country: 'PT', density: 'AVAILABLE', activeProfiles: 2180, expansionIncentiveActive: false },
    { id: 'loc_maputo', city: 'Maputo', country: 'MZ', density: 'AVAILABLE', activeProfiles: 1840, expansionIncentiveActive: true },
    { id: 'loc_praia', city: 'Praia', country: 'CV', density: 'AVAILABLE', activeProfiles: 920, expansionIncentiveActive: true },
    { id: 'loc_dili', city: 'Díli', country: 'TL', density: 'LOW', activeProfiles: 190, expansionIncentiveActive: true },
    { id: 'loc_bissau', city: 'Bissau', country: 'GW', density: 'LOW', activeProfiles: 310, expansionIncentiveActive: true },
    { id: 'loc_saotome', city: 'São Tomé', country: 'ST', density: 'LOW', activeProfiles: 240, expansionIncentiveActive: true },
    { id: 'loc_malabo', city: 'Malabo', country: 'GQ', density: 'LOW', activeProfiles: 110, expansionIncentiveActive: true }
  ];

  private expansionPolicies: ExpansionPolicy[] = [
    { scope: 'CITY', status: 'ACTIVE', description: 'Descoberta dentro do mesmo município ou cidade.', allowedCountries: ['AO', 'BR', 'PT', 'MZ', 'CV', 'ST', 'GW', 'TL', 'GQ'] },
    { scope: 'REGION', status: 'ACTIVE', description: 'Descoberta na província ou estado adjacente.', allowedCountries: ['AO', 'BR', 'PT', 'MZ', 'CV', 'ST', 'GW', 'TL', 'GQ'] },
    { scope: 'COUNTRY', status: 'ACTIVE', description: 'Descoberta a nível nacional do utilizador.', allowedCountries: ['AO', 'BR', 'PT', 'MZ', 'CV', 'ST', 'GW', 'TL', 'GQ'] },
    { scope: 'CPLP_SELECTED', status: 'ACTIVE', description: 'Descoberta em pares de países selecionados (ex: AO-PT, BR-AO).', allowedCountries: ['AO', 'BR', 'PT', 'MZ', 'CV'] },
    { scope: 'CPLP_GLOBAL', status: 'ACTIVE', description: 'Descoberta irrestrita em todos os 9 países lusófonos.', allowedCountries: ['AO', 'BR', 'PT', 'MZ', 'CV', 'ST', 'GW', 'TL', 'GQ'] }
  ];

  private rankingFactors: RankingFactor[] = [
    { id: 'rf_completeness', name: 'Completude de Perfil & Bio', weight: 9, description: 'Perfis com fotos de alta qualidade e biografia preenchida.', enabled: true },
    { id: 'rf_reciprocity', name: 'Histórico de Reciprocidade', weight: 8, description: 'Taxa de resposta e engajamento mútuo pós-match.', enabled: true },
    { id: 'rf_verification', name: 'Identidade Verificada (Trust)', weight: 9, description: 'Prioridade a utilizadores com selo de verificação.', enabled: true },
    { id: 'rf_recent_activity', name: 'Atividade Recente (Recency)', weight: 7, description: 'Utilizadores ativos nas últimas 48 horas.', enabled: true },
    { id: 'rf_cultural_match', name: 'Afinidade de Interesses CPLP', weight: 8, description: 'Gostos musicais, culinária e valores compartilhados.', enabled: true }
  ];

  private diversityConfig: DiversityConfig = {
    maxSameCityRatio: 0.75,
    cplpCrossBorderRatio: 0.25,
    minAgeSpan: 2,
    maxAgeSpan: 8,
    enforceCulturalVariety: true
  };

  private constructor() {
    this.loadState();
  }

  public static getInstance(): DiscoveryService {
    if (!DiscoveryService.instance) {
      DiscoveryService.instance = new DiscoveryService();
    }
    return DiscoveryService.instance;
  }

  private loadState(): void {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(DISCOVERY_CONFIG_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.engine) this.engine = parsed.engine;
        if (parsed.availability) this.availability = parsed.availability;
        if (parsed.expansionPolicies) this.expansionPolicies = parsed.expansionPolicies;
        if (parsed.rankingFactors) this.rankingFactors = parsed.rankingFactors;
        if (parsed.diversityConfig) this.diversityConfig = parsed.diversityConfig;
      }
    } catch {}
  }

  private saveState(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(
        DISCOVERY_CONFIG_STORAGE_KEY,
        JSON.stringify({
          engine: this.engine,
          availability: this.availability,
          expansionPolicies: this.expansionPolicies,
          rankingFactors: this.rankingFactors,
          diversityConfig: this.diversityConfig
        })
      );
    } catch {}
  }

  public getEngineConfig(): DiscoveryEngineConfig {
    return { ...this.engine };
  }

  public updateEngineConfig(updates: Partial<DiscoveryEngineConfig>, actor: AdminUser): { success: boolean; error?: string } {
    const rbac = RbacService.getInstance();
    if (!rbac.can(actor, 'product:flags:write')) {
      return { success: false, error: 'Permissão insuficiente para alterar motor de Discovery.' };
    }

    const prev = { ...this.engine };
    this.engine = {
      ...this.engine,
      ...updates,
      updatedAt: Date.now(),
      updatedBy: actor.displayName || actor.name || actor.email
    };
    this.saveState();

    AuditService.getInstance().logMutation(actor, {
      module: 'product',
      resourceType: 'discovery_engine',
      resourceId: this.engine.version,
      action: 'UPDATE_DISCOVERY_ENGINE',
      previousState: prev,
      newState: this.engine,
      justification: `Atualização de parâmetros do motor: Status ${this.engine.status}, AI Influence ${this.engine.aiInfluence}`
    });

    return { success: true };
  }

  public getAvailability(): DiscoveryAvailability[] {
    return [...this.availability];
  }

  public toggleExpansionIncentive(locationId: string, actor: AdminUser): { success: boolean } {
    const loc = this.availability.find(l => l.id === locationId);
    if (!loc) return { success: false };

    loc.expansionIncentiveActive = !loc.expansionIncentiveActive;
    this.saveState();

    AuditService.getInstance().logMutation(actor, {
      module: 'growth',
      resourceType: 'discovery_availability',
      resourceId: locationId,
      action: 'TOGGLE_EXPANSION_INCENTIVE',
      newState: loc,
      justification: `Incentivo de expansão em ${loc.city} alterado para ${loc.expansionIncentiveActive}`
    });

    return { success: true };
  }

  public getExpansionPolicies(): ExpansionPolicy[] {
    return [...this.expansionPolicies];
  }

  public toggleExpansionPolicy(scope: ExpansionPolicy['scope'], actor: AdminUser): { success: boolean } {
    const pol = this.expansionPolicies.find(p => p.scope === scope);
    if (!pol) return { success: false };

    pol.status = pol.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    this.saveState();

    AuditService.getInstance().logMutation(actor, {
      module: 'product',
      resourceType: 'expansion_policy',
      resourceId: scope,
      action: 'TOGGLE_EXPANSION_POLICY',
      newState: pol,
      justification: `Política de expansão ${scope} alterada para ${pol.status}`
    });

    return { success: true };
  }

  public getRankingFactors(): RankingFactor[] {
    return [...this.rankingFactors];
  }

  public updateRankingFactorWeight(id: string, weight: number, actor: AdminUser): { success: boolean } {
    const factor = this.rankingFactors.find(f => f.id === id);
    if (!factor) return { success: false };

    factor.weight = weight;
    this.saveState();
    return { success: true };
  }

  public getDiversityConfig(): DiversityConfig {
    return { ...this.diversityConfig };
  }

  public updateDiversityConfig(updates: Partial<DiversityConfig>, actor: AdminUser): { success: boolean } {
    this.diversityConfig = { ...this.diversityConfig, ...updates };
    this.saveState();
    return { success: true };
  }
}
