import { FinanceLedger, FinanceTransaction, AdminUser, CPLPCountryCode } from '../../types';
import { AuditService } from './auditService';

export interface FinanceProduct {
  id: string;
  name: string;
  category: 'subscription' | 'boost' | 'verification' | 'gift';
  priceEur: number;
  activeSubscribers: number;
  status: 'active' | 'archived';
}

export interface FinanceProviderStatus {
  id: string;
  name: string;
  type: 'multicaixa' | 'pix' | 'mbway' | 'stripe_sepa' | 'emola_mpesa';
  supportedCountries: CPLPCountryCode[];
  feePercent: number;
  settlementTime: string;
  status: 'operational' | 'delayed' | 'maintenance';
}

export class FinanceService {
  private static instance: FinanceService;
  private ledger: FinanceLedger;

  private products: FinanceProduct[] = [
    {
      id: 'prod_cplp_passport_vip',
      name: 'Passaporte ÉN CPLP Sem Fronteiras (Mensal)',
      category: 'subscription',
      priceEur: 14.99,
      activeSubscribers: 540,
      status: 'active'
    },
    {
      id: 'prod_cultural_highlight',
      name: 'Destaque Cultural Lusófono (7 dias)',
      category: 'boost',
      priceEur: 4.99,
      activeSubscribers: 220,
      status: 'active'
    },
    {
      id: 'prod_cplp_verified_badge',
      name: 'Selo Oficial de Verificação de Identidade CPLP',
      category: 'verification',
      priceEur: 9.99,
      activeSubscribers: 610,
      status: 'active'
    }
  ];

  private providers: FinanceProviderStatus[] = [
    {
      id: 'prov_multicaixa',
      name: 'EMIS / Multicaixa Express (Angola)',
      type: 'multicaixa',
      supportedCountries: ['AO'],
      feePercent: 1.5,
      settlementTime: 'T+1',
      status: 'operational'
    },
    {
      id: 'prov_pix',
      name: 'BACEN / Pix Instantâneo (Brasil)',
      type: 'pix',
      supportedCountries: ['BR'],
      feePercent: 0.9,
      settlementTime: 'Instantâneo',
      status: 'operational'
    },
    {
      id: 'prov_mbway_sepa',
      name: 'SIBS / MBWay & SEPA Instant (Portugal)',
      type: 'mbway',
      supportedCountries: ['PT'],
      feePercent: 1.2,
      settlementTime: 'Instantâneo',
      status: 'operational'
    },
    {
      id: 'prov_emola',
      name: 'M-Pesa / e-Mola Carteira Móvel (Moçambique)',
      type: 'emola_mpesa',
      supportedCountries: ['MZ'],
      feePercent: 2.0,
      settlementTime: 'T+0',
      status: 'operational'
    }
  ];

  private constructor() {
    this.ledger = {
      mrrEur: 8450,
      totalRevenueEur30d: 12680,
      activeSubscriptionsCount: 680,
      refundRatePercent: 0.4,
      arpuEur: 12.4,
      countryRevenuesEur: {
        AO: 2450,
        BR: 3890,
        PT: 4120,
        MZ: 1100,
        CV: 620,
        ST: 180,
        GW: 140,
        TL: 110,
        GQ: 70
      },
      recentTransactions: [
        {
          id: 'tx_901',
          userId: 'usr_premium_12',
          amountEur: 14.99,
          countryCode: 'PT',
          type: 'subscription',
          status: 'settled',
          currency: 'EUR',
          createdAt: Date.now() - 1800000
        },
        {
          id: 'tx_902',
          userId: 'usr_premium_15',
          amountEur: 12.5,
          countryCode: 'AO',
          type: 'subscription',
          status: 'settled',
          currency: 'AOA',
          createdAt: Date.now() - 3600000
        },
        {
          id: 'tx_903',
          userId: 'usr_boost_9',
          amountEur: 4.99,
          countryCode: 'BR',
          type: 'boost',
          status: 'settled',
          currency: 'BRL',
          createdAt: Date.now() - 7200000
        },
        {
          id: 'tx_904',
          userId: 'usr_moz_44',
          amountEur: 9.99,
          countryCode: 'MZ',
          type: 'subscription',
          status: 'settled',
          currency: 'MZN',
          createdAt: Date.now() - 14400000
        }
      ]
    };
  }

  public static getInstance(): FinanceService {
    if (!FinanceService.instance) {
      FinanceService.instance = new FinanceService();
    }
    return FinanceService.instance;
  }

  public getLedger(): FinanceLedger {
    return { ...this.ledger };
  }

  public getProducts(): FinanceProduct[] {
    return [...this.products];
  }

  public getProviders(): FinanceProviderStatus[] {
    return [...this.providers];
  }

  public runReconciliation(actor: AdminUser): { success: boolean; reconciledCount: number; varianceEur: number } {
    const reconciledCount = this.ledger.recentTransactions.length;
    const varianceEur = 0.00;

    AuditService.getInstance().logEvent(actor, {
      module: 'finance',
      resourceType: 'reconciliation_run',
      resourceId: `rec_${Date.now()}`,
      action: 'RUN_FINANCIAL_RECONCILIATION',
      newState: { status: 'reconciled', reconciledCount, varianceEur },
      justification: 'Conciliação automática diária de transações e saldos CPLP'
    });

    return { success: true, reconciledCount, varianceEur };
  }
}

