import { IntegrationAdapterContract, IntegrationContract, IntegrationCategory, AdminUser } from '../../types';
import { AuditService } from './auditService';

export class IntegrationsService {
  private static instance: IntegrationsService;
  private contracts: IntegrationContract[] = [
    {
      id: 'int_ai_gemini',
      category: 'ai',
      providerName: 'Google Gemini 2.5 & Cultural Affinity Engine',
      adapterKey: 'adapter:ai:gemini_cplp',
      endpoint: 'https://generativelanguage.googleapis.com/v1beta',
      authMethod: 'apiKey',
      status: 'connected',
      avgLatencyMs: 180,
      monthlyCalls: 84200,
      errorRate: 0.008,
      supportedCountries: ['AO', 'BR', 'CV', 'GW', 'GQ', 'MZ', 'PT', 'ST', 'TL'],
      lastPingAt: Date.now() - 45000
    },
    {
      id: 'int_pay_cplp',
      category: 'payments',
      providerName: 'CPLP Unified Gateway (Multicaixa / Pix / MBWay / SEPA)',
      adapterKey: 'adapter:pay:cplp_unified',
      endpoint: 'https://api.cplp-payments.internal/v2',
      authMethod: 'hmac',
      status: 'connected',
      avgLatencyMs: 120,
      monthlyCalls: 45200,
      errorRate: 0.012,
      supportedCountries: ['AO', 'BR', 'PT', 'MZ', 'CV'],
      lastPingAt: Date.now() - 30000
    },
    {
      id: 'int_identity_doc',
      category: 'identity',
      providerName: 'CPLP Document & Biometric Verification Adapter',
      adapterKey: 'adapter:identity:cplp_trust',
      endpoint: 'https://identity.cplp-trust.internal/v1',
      authMethod: 'bearer',
      status: 'connected',
      avgLatencyMs: 240,
      monthlyCalls: 9800,
      errorRate: 0.005,
      supportedCountries: ['AO', 'BR', 'CV', 'GW', 'GQ', 'MZ', 'PT', 'ST', 'TL'],
      lastPingAt: Date.now() - 90000
    },
    {
      id: 'int_comm_sms',
      category: 'communications',
      providerName: 'Global Lusophone SMS OTP & WhatsApp Notifier',
      adapterKey: 'adapter:comm:lusophone_telco',
      endpoint: 'https://sms.cplp-connect.internal/v3',
      authMethod: 'apiKey',
      status: 'connected',
      avgLatencyMs: 290,
      monthlyCalls: 62000,
      errorRate: 0.021,
      supportedCountries: ['AO', 'BR', 'CV', 'GW', 'GQ', 'MZ', 'PT', 'ST', 'TL'],
      lastPingAt: Date.now() - 15000
    },
    {
      id: 'int_google_workspace_gmail',
      category: 'communications',
      providerName: 'Google Workspace · Gmail REST API v1 (OAuth 2.0)',
      adapterKey: 'adapter:workspace:gmail_v1',
      endpoint: 'https://gmail.googleapis.com/gmail/v1/users/me',
      authMethod: 'oauth2',
      status: 'connected',
      avgLatencyMs: 145,
      monthlyCalls: 28400,
      errorRate: 0.002,
      supportedCountries: ['AO', 'BR', 'CV', 'GW', 'GQ', 'MZ', 'PT', 'ST', 'TL'],
      lastPingAt: Date.now() - 5000
    },
    {
      id: 'int_webhooks_dispatch',
      category: 'webhooks',
      providerName: 'Event Bus & Webhook Dispatcher (EventGrid)',
      adapterKey: 'adapter:webhooks:event_bus',
      endpoint: 'https://events.cplp-en.internal/dispatch',
      authMethod: 'hmac',
      status: 'connected',
      avgLatencyMs: 35,
      monthlyCalls: 312000,
      errorRate: 0.001,
      supportedCountries: ['AO', 'BR', 'CV', 'GW', 'GQ', 'MZ', 'PT', 'ST', 'TL'],
      lastPingAt: Date.now() - 10000
    },
    {
      id: 'int_partner_cultural',
      category: 'partners',
      providerName: 'Parcerias Culturais & Eventos Lusófonos Hub',
      adapterKey: 'adapter:partner:cultural_hub',
      endpoint: 'https://partners.cplp-cultura.internal/api',
      authMethod: 'oauth2',
      status: 'connected',
      avgLatencyMs: 160,
      monthlyCalls: 12400,
      errorRate: 0.004,
      supportedCountries: ['AO', 'BR', 'PT', 'MZ', 'CV'],
      lastPingAt: Date.now() - 120000
    }
  ];

  private constructor() {}

  public static getInstance(): IntegrationsService {
    if (!IntegrationsService.instance) {
      IntegrationsService.instance = new IntegrationsService();
    }
    return IntegrationsService.instance;
  }

  public getContracts(category?: IntegrationCategory): IntegrationContract[] {
    if (category) {
      return this.contracts.filter(c => c.category === category);
    }
    return [...this.contracts];
  }

  /**
   * Backwards compatible getAdapters
   */
  public getAdapters(): IntegrationAdapterContract[] {
    return this.contracts.map(c => ({
      id: c.id,
      name: c.providerName,
      category: c.category === 'payments' ? 'payment_gateway' : c.category === 'communications' ? 'sms_verification' : c.category === 'ai' ? 'ai_inference' : 'object_storage',
      adapterKey: c.adapterKey,
      status: c.status,
      averageLatencyMs: c.avgLatencyMs,
      rateLimitUsagePercent: Math.floor(c.errorRate * 1000),
      lastHeartbeat: c.lastPingAt,
      supportedRegions: c.supportedCountries
    }));
  }

  public testPing(contractId: string, actor: AdminUser): { success: boolean; latencyMs: number; error?: string } {
    const contract = this.contracts.find(c => c.id === contractId);
    if (!contract) return { success: false, latencyMs: 0, error: 'Contrato não encontrado' };

    const simulatedLatency = Math.floor(Math.random() * 80) + 30;
    contract.lastPingAt = Date.now();
    contract.avgLatencyMs = simulatedLatency;

    AuditService.getInstance().logEvent(actor, {
      module: 'integrations',
      resourceType: 'integration_contract',
      resourceId: contractId,
      action: 'PING_INTEGRATION_CONTRACT',
      newState: { status: contract.status, latencyMs: simulatedLatency },
      justification: `Teste de conectividade em ${contract.providerName}`
    });

    return { success: true, latencyMs: simulatedLatency };
  }
}

