import { FinanceLedger, FinanceTransaction } from '../../types';

export class FinanceService {
  private static instance: FinanceService;
  private ledger: FinanceLedger;

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
}
