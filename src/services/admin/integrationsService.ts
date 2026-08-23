import { IntegrationAdapterContract } from '../../types';

export class IntegrationsService {
  private static instance: IntegrationsService;
  private adapters: IntegrationAdapterContract[] = [];

  private constructor() {
    this.adapters = [
      {
        id: 'adapter_pay_1',
        name: 'Gateway de Pagamento Lusófono (Multicaixa/Pix/MBWay/SEPA)',
        category: 'payment_gateway',
        adapterKey: 'cplp_unified_payouts',
        status: 'connected',
        averageLatencyMs: 145,
        rateLimitUsagePercent: 12,
        lastHeartbeat: Date.now() - 60000,
        supportedRegions: ['AO', 'BR', 'PT', 'MZ', 'CV']
      },
      {
        id: 'adapter_sms_1',
        name: 'SMS OTP & Verificação Telefónica CPLP',
        category: 'sms_verification',
        adapterKey: 'cplp_telecom_sms',
        status: 'connected',
        averageLatencyMs: 310,
        rateLimitUsagePercent: 8,
        lastHeartbeat: Date.now() - 120000,
        supportedRegions: ['AO', 'BR', 'CV', 'GW', 'GQ', 'MZ', 'PT', 'ST', 'TL']
      },
      {
        id: 'adapter_storage_1',
        name: 'Armazenamento de Mídia Light-First (Cloud Object Storage)',
        category: 'object_storage',
        adapterKey: 'encrypted_cdn_storage',
        status: 'connected',
        averageLatencyMs: 35,
        rateLimitUsagePercent: 24,
        lastHeartbeat: Date.now() - 30000,
        supportedRegions: ['AO', 'BR', 'CV', 'GW', 'GQ', 'MZ', 'PT', 'ST', 'TL']
      },
      {
        id: 'adapter_ai_1',
        name: 'Motor de Inferência Semântica & Moderação IA',
        category: 'ai_inference',
        adapterKey: 'gemini_cultural_adapter',
        status: 'connected',
        averageLatencyMs: 220,
        rateLimitUsagePercent: 18,
        lastHeartbeat: Date.now() - 45000,
        supportedRegions: ['AO', 'BR', 'CV', 'GW', 'GQ', 'MZ', 'PT', 'ST', 'TL']
      }
    ];
  }

  public static getInstance(): IntegrationsService {
    if (!IntegrationsService.instance) {
      IntegrationsService.instance = new IntegrationsService();
    }
    return IntegrationsService.instance;
  }

  public getAdapters(): IntegrationAdapterContract[] {
    return [...this.adapters];
  }
}
