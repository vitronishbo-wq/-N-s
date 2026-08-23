import { GrowthFunnelMetrics, CPLPCountryCode, AdminUser } from '../../types';
import { AuditService } from './auditService';

export class GrowthService {
  private static instance: GrowthService;
  private metrics: GrowthFunnelMetrics;

  private constructor() {
    this.metrics = {
      acquisitionDaily: 148,
      activationRatePercent: 68.4,
      retentionD7Percent: 44.2,
      retentionD30Percent: 29.8,
      referralConversionRate: 18.5,
      cplpExpansionScores: {
        AO: { activeUsers: 4820, growthMomPercent: 24.5, marketReadiness: 'scaling', targetCampaign: 'Luanda Conecta ÉN' },
        BR: { activeUsers: 14200, growthMomPercent: 31.2, marketReadiness: 'established', targetCampaign: 'Brasil & CPLP Namoro' },
        CV: { activeUsers: 1950, growthMomPercent: 18.0, marketReadiness: 'scaling', targetCampaign: 'Morabeza Global' },
        GW: { activeUsers: 620, growthMomPercent: 12.3, marketReadiness: 'nascent', targetCampaign: 'Bissau Encontros' },
        GQ: { activeUsers: 340, growthMomPercent: 9.1, marketReadiness: 'nascent', targetCampaign: 'Malabo Expansão' },
        MZ: { activeUsers: 3890, growthMomPercent: 22.1, marketReadiness: 'scaling', targetCampaign: 'Maputo & Beira Amor' },
        PT: { activeUsers: 9400, growthMomPercent: 19.4, marketReadiness: 'established', targetCampaign: 'Lisboa & Porto Lusófono' },
        ST: { activeUsers: 480, growthMomPercent: 11.5, marketReadiness: 'nascent', targetCampaign: 'São Tomé Conexões' },
        TL: { activeUsers: 510, growthMomPercent: 8.7, marketReadiness: 'nascent', targetCampaign: 'Díli Encontros CPLP' }
      },
      referralCampaigns: [
        {
          id: 'ref_cplp_2026',
          name: 'Amigo Traz Amigo CPLP',
          code: 'CPLP2026',
          targetCountry: 'AO',
          rewardDescription: '1 mês de Destaque Cultural Gratuito',
          activeReferrals: 1280,
          status: 'active'
        },
        {
          id: 'ref_br_pt_bridge',
          name: 'Ponte Lisboa-Rio',
          code: 'PONTE26',
          targetCountry: 'PT',
          rewardDescription: 'Super Passaporte sem fronteiras por 14 dias',
          activeReferrals: 890,
          status: 'active'
        }
      ]
    };
  }

  public static getInstance(): GrowthService {
    if (!GrowthService.instance) {
      GrowthService.instance = new GrowthService();
    }
    return GrowthService.instance;
  }

  public getMetrics(): GrowthFunnelMetrics {
    return this.metrics;
  }

  public toggleCampaignStatus(campaignId: string, actor: AdminUser): { success: boolean; error?: string } {
    const campaign = this.metrics.referralCampaigns.find(c => c.id === campaignId);
    if (!campaign) return { success: false, error: 'Campanha não encontrada' };

    const oldStatus = campaign.status;
    campaign.status = oldStatus === 'active' ? 'paused' : 'active';

    AuditService.getInstance().logEvent(actor, {
      module: 'growth',
      resourceType: 'referral_campaign',
      resourceId: campaignId,
      action: 'TOGGLE_CAMPAIGN_STATUS',
      previousState: { status: oldStatus },
      newState: { status: campaign.status },
      justification: `Status da campanha alterado para ${campaign.status}`
    });

    return { success: true };
  }
}
