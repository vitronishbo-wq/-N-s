import React from 'react';
import { ModuleProps } from '../moduleRegistry';
import { IntegrationsService } from '../../../services/admin/integrationsService';
import { Network, CheckCircle2, RefreshCw, Layers } from 'lucide-react';

export const IntegrationsModule: React.FC<ModuleProps> = () => {
  const integrationsService = IntegrationsService.getInstance();
  const adapters = integrationsService.getAdapters();

  return (
    <div className="space-y-6 text-stone-900">
      {/* Header */}
      <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-cyan-50 text-cyan-800 border border-cyan-200">
            Contratos & Adaptadores de Fornecedores
          </span>
          <span className="text-xs text-stone-700">Desacoplamento de provedores</span>
        </div>
        <h2 className="text-base font-bold text-stone-900 mt-1">Camada de Integrações CPLP</h2>
        <p className="text-xs text-stone-700 mt-0.5 max-w-xl">
          A aplicação opera mediante interfaces contratuais genéricas, permitindo troca transparente de fornecedores de pagamento, SMS, CDN e IA.
        </p>
      </div>

      {/* Adapters Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {adapters.map(adapter => (
          <div
            key={adapter.id}
            className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs space-y-3 text-xs"
          >
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

            <div className="pt-2 flex flex-wrap gap-1 items-center">
              <span className="text-[10px] text-stone-700 mr-1">Regiões Ativas:</span>
              {adapter.supportedRegions.map(reg => (
                <span key={reg} className="text-[9px] font-mono px-1.5 py-0.5 bg-stone-100 rounded text-stone-700 font-bold">
                  {reg}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
