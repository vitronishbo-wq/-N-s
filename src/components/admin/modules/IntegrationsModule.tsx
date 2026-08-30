import React, { useState } from 'react';
import { ModuleProps } from '../moduleRegistry';
import { IntegrationsService } from '../../../services/admin/integrationsService';
import { AuditService } from '../../../services/admin/auditService';
import {
  Network,
  CheckCircle2,
  RefreshCw,
  Layers,
  Bot,
  CreditCard,
  Code2,
  Webhook,
  Building2,
  Zap,
  Globe2,
  Check,
  ShieldCheck
} from 'lucide-react';

interface AiContractConfig {
  primaryModel: string;
  fallbackModel: string;
  autoModerationThreshold: number;
  profileAssistantEnabled: boolean;
  tokensConsumed30d: number;
  avgLatencyMs: number;
}

const INITIAL_AI_CONFIG: AiContractConfig = {
  primaryModel: 'Google Gemini 2.5 Flash',
  fallbackModel: 'Anthropic Claude 3.5 Haiku',
  autoModerationThreshold: 85,
  profileAssistantEnabled: true,
  tokensConsumed30d: 4280500,
  avgLatencyMs: 240
};

interface PaymentGatewayContract {
  id: string;
  name: string;
  region: string;
  provider: string;
  status: 'ACTIVE' | 'DEGRADED' | 'MAINTENANCE';
  successRatePercent: number;
  supportedCurrencies: string[];
}

const INITIAL_GATEWAYS: PaymentGatewayContract[] = [
  { id: 'gw_ao', name: 'Multicaixa Express (EMIS)', region: 'Angola (AO)', provider: 'EMIS Adapter Contract', status: 'ACTIVE', successRatePercent: 99.4, supportedCurrencies: ['AOA'] },
  { id: 'gw_br', name: 'Pix & Cartões Nacionais', region: 'Brasil (BR)', provider: 'Banco Central SPI Contract', status: 'ACTIVE', successRatePercent: 99.9, supportedCurrencies: ['BRL'] },
  { id: 'gw_pt', name: 'MB Way & Multibanco', region: 'Portugal (PT)', provider: 'SIBS Contract Adapter', status: 'ACTIVE', successRatePercent: 99.7, supportedCurrencies: ['EUR'] },
  { id: 'gw_mz', name: 'M-Pesa Moçambique', region: 'Moçambique (MZ)', provider: 'Vodacom FinTech Gateway', status: 'ACTIVE', successRatePercent: 98.9, supportedCurrencies: ['MZN'] },
  { id: 'gw_intl', name: 'Stripe International CPLP', region: 'Global / CPLP', provider: 'Stripe Direct v3', status: 'ACTIVE', successRatePercent: 99.8, supportedCurrencies: ['USD', 'EUR', 'BRL'] }
];

export const IntegrationsModule: React.FC<ModuleProps & { activeSubmoduleId?: string }> = ({
  currentAdmin,
  activeSubmoduleId = 'ia'
}) => {
  const integrationsService = IntegrationsService.getInstance();
  const adapters = integrationsService.getAdapters();

  const [aiConfig, setAiConfig] = useState<AiContractConfig>(INITIAL_AI_CONFIG);
  const [gateways, setGateways] = useState<PaymentGatewayContract[]>(INITIAL_GATEWAYS);

  const [webhooks, setWebhooks] = useState([
    { id: 'wh_01', name: 'EMIS Payment Notification', url: 'https://api.encontrol.cplp/webhooks/emis', events: ['payment.success', 'payment.failed'], status: 'HEALTHY', lastTriggered: 'Há 4 min' },
    { id: 'wh_02', name: 'Trust & Safety External Auditor', url: 'https://security.cplp-en.org/audit-feed', events: ['trust.decision.executed'], status: 'HEALTHY', lastTriggered: 'Há 12 min' }
  ]);

  const currentTab = activeSubmoduleId || 'ia';

  return (
    <div className="space-y-6 text-stone-900">
      {/* Header */}
      <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-cyan-50 text-cyan-800 border border-cyan-200">
            INTEGRAÇÕES · Contratos & Adaptadores
          </span>
          <span className="text-xs text-stone-700">IA · Pagamentos · APIs · Webhooks · Parceiros</span>
        </div>
        <h2 className="text-base font-bold text-stone-900 mt-1">Desacoplamento de Fornecedores & Serviços Externos</h2>
        <p className="text-xs text-stone-700 mt-0.5 max-w-xl">
          Arquitetura de adaptadores independentes: o núcleo do domínio nunca se acopla a um fornecedor específico, garantindo soberania técnica.
        </p>
      </div>

      {/* SUBMODULE: IA */}
      {currentTab === 'ia' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
              <Bot className="w-4 h-4 text-rose-600" />
              Contrato de Inteligência Artificial & Modelos Lusófonos
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200">
                <span className="text-xs text-stone-700 block">Modelo Primário</span>
                <span className="text-sm font-bold text-stone-900 mt-1 block">{aiConfig.primaryModel}</span>
                <span className="text-[10px] text-emerald-600 font-bold mt-1 block">● Operacional</span>
              </div>
              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200">
                <span className="text-xs text-stone-700 block">Modelo de Fallback Automático</span>
                <span className="text-sm font-bold text-stone-900 mt-1 block">{aiConfig.fallbackModel}</span>
                <span className="text-[10px] text-stone-700 mt-1 block">Standby com chave pronta</span>
              </div>
              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200">
                <span className="text-xs text-stone-700 block">Tokens Consumidos (30d)</span>
                <span className="text-lg font-bold font-mono text-stone-900 mt-1 block">
                  {(aiConfig?.tokensConsumed30d ?? 0).toLocaleString()}
                </span>
                <span className="text-[10px] text-stone-700 mt-1 block">Latência média: {aiConfig?.avgLatencyMs ?? 0}ms</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-2 text-xs">
              <div className="font-bold text-stone-900">Capacidades Contratuais Ativas</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-stone-700">
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Assistente Cultural de Biografia de Perfis</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Detecção Heurística de Linguagem Tóxica CPLP</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Verificação de Adequação de Fotos por Visão Computacional</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Sugestão Contextual de Tópicos de Conversa</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBMODULE: PAGAMENTOS */}
      {currentTab === 'pagamentos' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-600" />
              Contratos de Gateways Financeiros CPLP
            </h3>

            <div className="space-y-3">
              {gateways.map(gw => (
                <div key={gw.id} className="p-4 rounded-xl bg-stone-50 border border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-stone-900">{gw.name}</span>
                      <span className="font-mono text-[10px] text-stone-700">({gw.region})</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 uppercase">
                        {gw.status}
                      </span>
                    </div>
                    <span className="text-stone-700 mt-1 block">Adaptador: {gw.provider} · Moedas: {gw.supportedCurrencies.join(', ')}</span>
                  </div>

                  <div className="text-right">
                    <span className="text-stone-700 block text-[10px]">Taxa de Sucesso:</span>
                    <span className="text-sm font-bold font-mono text-emerald-600">{gw.successRatePercent}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SUBMODULE: APIS */}
      {currentTab === 'apis' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {adapters.map(adapter => (
              <div key={adapter.id} className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs space-y-3 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-mono uppercase text-stone-700 block">
                      {adapter.category.replace('_', ' ')}
                    </span>
                    <h3 className="text-sm font-bold text-stone-900 mt-0.5">{adapter.name}</h3>
                  </div>
                  <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Conectado</span>
                  </span>
                </div>

                <div className="pt-2 border-t border-stone-100 grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-stone-700">Chave do Adaptador:</span>
                    <p className="font-mono font-bold text-stone-800">{adapter.adapterKey}</p>
                  </div>
                  <div>
                    <span className="text-stone-700">Latência Média:</span>
                    <p className="font-mono font-bold text-stone-800">{adapter.averageLatencyMs}ms</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUBMODULE: WEBHOOKS */}
      {currentTab === 'webhooks' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
              <Webhook className="w-4 h-4 text-purple-600" />
              Webhooks Registrados
            </h3>

            <div className="space-y-3">
              {webhooks.map(wh => (
                <div key={wh.id} className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-stone-900">{wh.name}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 uppercase">
                      {wh.status}
                    </span>
                  </div>
                  <div className="font-mono text-[11px] text-stone-700 truncate">{wh.url}</div>
                  <div className="text-[10px] text-stone-700 pt-1 flex items-center justify-between border-t border-stone-200/80">
                    <span>Eventos: {wh.events.join(', ')}</span>
                    <span>Último disparo: {wh.lastTriggered}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SUBMODULE: PARCEIROS */}
      {currentTab === 'parceiros' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-stone-700" />
              Parceiros Comerciais & Institucionais CPLP
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-1">
                <div className="font-bold text-stone-900">Associação Cultural Lusófona</div>
                <div className="text-stone-700">Validação de eventos e intercâmbio comunitário em Lisboa e Rio.</div>
              </div>
              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-1">
                <div className="font-bold text-stone-900">Hub de Inovação Luanda / Maputo</div>
                <div className="text-stone-700">Parceria para aceleração de conectividade e pagamentos móveis.</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
