import { GovernancePolicy, AdminUser } from '../../types';
import { AuditService } from './auditService';

export class GovernanceService {
  private static instance: GovernanceService;
  private policies: GovernancePolicy[];

  private constructor() {
    this.policies = [
      {
        id: 'pol_gdpr_cplp',
        code: 'GOV-DATA-01',
        title: 'Retenção e Conformidade de Dados CPLP',
        category: 'data_retention',
        description: 'Retenção de logs administrativos por 365 dias e expurgo de dados sensíveis após encerramento de conta.',
        enforced: true,
        lastAuditedAt: Date.now() - 86400000 * 5,
        updatedBy: 'Sila Marco (Founder)'
      },
      {
        id: 'pol_trust_sla',
        code: 'GOV-TRUST-02',
        title: 'SLA Máximo de Moderação de Denúncias',
        category: 'moderation_sla',
        description: 'Sinais de alta severidade (assédio, menores) devem ser deliberados em menos de 15 minutos.',
        enforced: true,
        lastAuditedAt: Date.now() - 86400000 * 2,
        updatedBy: 'Sila Marco (Founder)'
      },
      {
        id: 'pol_sec_pin',
        code: 'GOV-SEC-03',
        title: 'Autenticação Robusta e Restrição de Auto-Mutação',
        category: 'security',
        description: 'Sessão administrativa restrita por PIN de 6 dígitos com trilha imutável obrigatória e barreira de autodestruição de conta.',
        enforced: true,
        lastAuditedAt: Date.now() - 86400000 * 1,
        updatedBy: 'Sila Marco (Founder)'
      },
      {
        id: 'pol_fin_payout',
        code: 'GOV-FIN-04',
        title: 'Teto de Desembolso Sem Aprovação Dupla',
        category: 'financial_limit',
        description: 'Pagamentos ou reembolsos acima de €500 exigem aprovação formal de Founder ou Finance Lead.',
        enforced: true,
        lastAuditedAt: Date.now() - 86400000 * 10,
        updatedBy: 'Sila Marco (Founder)'
      }
    ];
  }

  public static getInstance(): GovernanceService {
    if (!GovernanceService.instance) {
      GovernanceService.instance = new GovernanceService();
    }
    return GovernanceService.instance;
  }

  public getPolicies(): GovernancePolicy[] {
    return [...this.policies];
  }

  public togglePolicyEnforcement(policyId: string, actor: AdminUser): { success: boolean; error?: string } {
    const policy = this.policies.find(p => p.id === policyId);
    if (!policy) return { success: false, error: 'Política não encontrada' };

    const oldState = policy.enforced;
    policy.enforced = !oldState;
    policy.lastAuditedAt = Date.now();
    policy.updatedBy = `${actor.displayName || actor.name} (${actor.role})`;

    AuditService.getInstance().logEvent(actor, {
      module: 'governance',
      resourceType: 'governance_policy',
      resourceId: policyId,
      action: 'TOGGLE_POLICY_ENFORCEMENT',
      previousState: { enforced: oldState },
      newState: { enforced: policy.enforced },
      justification: `Enforcement de política alterado para ${policy.enforced}`
    });

    return { success: true };
  }
}
