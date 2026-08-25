import React, { useState } from 'react';
import { ModuleProps } from '../moduleRegistry';
import { ProductService } from '../../../services/admin/productService';
import { RbacService } from '../../../services/admin/rbacService';
import { AuditService } from '../../../services/admin/auditService';
import { ProductFeatureFlag } from '../../../types';
import {
  Flag,
  Sliders,
  ToggleLeft,
  ToggleRight,
  CheckCircle2,
  Shield,
  Layers,
  Sparkles,
  Video,
  Heart,
  Users,
  Calendar,
  Settings,
  Rocket
} from 'lucide-react';

interface CoreFeatureSwitch {
  key: string;
  name: string;
  description: string;
  status: 'ON' | 'OFF';
  icon: any;
}

const INITIAL_CORE_FEATURES: CoreFeatureSwitch[] = [
  { key: 'MATCHING_V1', name: 'Motor de Matching V1', description: 'Algoritmo determinístico de compatibilidade lusófona.', status: 'ON', icon: Sparkles },
  { key: 'AI_PROFILE_ASSISTANT', name: 'Assistente de Perfil IA', description: 'Geração e aprimoramento cultural de biografias.', status: 'ON', icon: Sparkles },
  { key: 'VIDEO', name: 'Vídeo Chamada & Clipes', description: 'Apresentação em vídeo e chamadas interativas.', status: 'OFF', icon: Video },
  { key: 'RELATIONSHIP_SPACE', name: 'Espaço de Relacionamento Dedicado', description: 'Recursos para casais pós-match.', status: 'OFF', icon: Heart },
  { key: 'COMMUNITIES', name: 'Comunidades Temáticas Lusófonas', description: 'Grupos abertos de interesses musicais e gastronómicos.', status: 'OFF', icon: Users },
  { key: 'EVENTS', name: 'Eventos & Encontros CPLP', description: 'Calendário de encontros presenciais e digitais.', status: 'OFF', icon: Calendar }
];

export const ProductModule: React.FC<ModuleProps & { activeSubmoduleId?: string }> = ({
  currentAdmin,
  activeSubmoduleId = 'funcionalidades'
}) => {
  const productService = ProductService.getInstance();
  const rbac = RbacService.getInstance();

  const [coreFeatures, setCoreFeatures] = useState<CoreFeatureSwitch[]>(INITIAL_CORE_FEATURES);
  const [flags, setFlags] = useState<ProductFeatureFlag[]>(() => productService.getFlags());
  const canWrite = rbac.can(currentAdmin, 'product:flags:write');

  const [dailyLikeLimit, setDailyLikeLimit] = useState(50);
  const [defaultSearchRadiusKm, setDefaultSearchRadiusKm] = useState(100);
  const [matchCooldownSec, setMatchCooldownSec] = useState(10);

  const reload = () => setFlags(productService.getFlags());

  const handleToggleCoreFeature = (key: string) => {
    if (!canWrite) return;
    setCoreFeatures(prev =>
      prev.map(f => {
        if (f.key === key) {
          const nextStatus = f.status === 'ON' ? 'OFF' : 'ON';
          AuditService.getInstance().logMutation(currentAdmin, {
            module: 'product',
            resourceType: 'core_feature',
            resourceId: key,
            action: 'TOGGLE_CORE_FEATURE',
            newState: { status: nextStatus },
            justification: `Chave de funcionalidade ${key} alterada para ${nextStatus}`
          });
          return { ...f, status: nextStatus };
        }
        return f;
      })
    );
  };

  const handleToggleFlag = (flag: ProductFeatureFlag) => {
    const res = productService.updateFlag(flag.key, { enabled: !flag.enabled }, currentAdmin);
    if (res.success) {
      reload();
    } else {
      alert(res.error);
    }
  };

  const handleRolloutChange = (flagKey: string, percentage: number) => {
    const res = productService.updateFlag(flagKey, { rolloutPercentage: percentage }, currentAdmin);
    if (res.success) {
      reload();
    } else {
      alert(res.error);
    }
  };

  const currentTab = activeSubmoduleId || 'funcionalidades';

  return (
    <div className="space-y-6 text-stone-900">
      {/* Header */}
      <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200">
            PRODUTO · Capacidades da Plataforma
          </span>
          <span className="text-xs text-stone-700">Funcionalidades · Feature Flags · Configurações · Lançamentos</span>
        </div>
        <h2 className="text-base font-bold text-stone-900 mt-1">Gestão de Produto & Rollout de Funcionalidades</h2>
        <p className="text-xs text-stone-700 mt-0.5 max-w-xl">
          Supervisão das funcionalidades mestre da aplicação, ajuste de percentual de rollout e parametrização do ecossistema.
        </p>
      </div>

      {/* SUBMODULE: FUNCIONALIDADES */}
      {currentTab === 'funcionalidades' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs space-y-4">
            <div>
              <h3 className="text-sm font-bold text-stone-900">Chaves de Funcionalidades Mestres</h3>
              <p className="text-xs text-stone-700 mt-0.5">
                Controle imediato de ativação/desativação de módulos do produto no ar.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {coreFeatures.map(f => {
                const Icon = f.icon;
                const isOn = f.status === 'ON';

                return (
                  <div key={f.key} className="p-4 rounded-xl bg-stone-50 border border-stone-200 flex items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${isOn ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-200 text-stone-700'}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-stone-900">{f.name}</span>
                          <span className="font-mono text-[10px] text-stone-700">({f.key})</span>
                        </div>
                        <p className="text-xs text-stone-700 mt-0.5">{f.description}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                        isOn ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200 text-stone-700'
                      }`}>
                        {f.status}
                      </span>
                      {canWrite && (
                        <button
                          type="button"
                          onClick={() => handleToggleCoreFeature(f.key)}
                          className={`text-xs font-semibold px-2.5 py-1 rounded-lg cursor-pointer ${
                            isOn ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100' : 'bg-emerald-600 text-white hover:bg-emerald-700'
                          }`}
                        >
                          {isOn ? 'Desligar' : 'Ligar'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SUBMODULE: FEATURE FLAGS */}
      {currentTab === 'flags' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-stone-900">Feature Flags & Rollouts Progressivos</h3>

            <div className="space-y-4">
              {flags.map(flag => (
                <div key={flag.key} className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-stone-900">{flag.name}</span>
                        <span className="font-mono text-[10px] px-2 py-0.5 bg-white border border-stone-200 text-stone-700 rounded">
                          {flag.key}
                        </span>
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase ${
                          flag.enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200 text-stone-700'
                        }`}>
                          {flag.enabled ? 'Ativo' : 'Desativado'}
                        </span>
                      </div>
                      <p className="text-xs text-stone-700 mt-1">{flag.description}</p>
                    </div>

                    {canWrite && (
                      <button
                        type="button"
                        onClick={() => handleToggleFlag(flag)}
                        className={`px-3 py-1 text-xs font-semibold rounded-lg cursor-pointer ${
                          flag.enabled ? 'bg-stone-200 hover:bg-stone-300 text-stone-700' : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        }`}
                      >
                        {flag.enabled ? 'Desativar Flag' : 'Ativar Flag'}
                      </button>
                    )}
                  </div>

                  <div className="pt-3 border-t border-stone-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex-1 max-w-sm">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-stone-700">Rollout:</span>
                        <strong className="font-mono text-stone-900">{flag.rolloutPercentage}%</strong>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        disabled={!canWrite}
                        value={flag.rolloutPercentage}
                        onChange={e => handleRolloutChange(flag.key, Number(e.target.value))}
                        className="w-full accent-rose-600 cursor-pointer"
                      />
                    </div>

                    <div className="text-[11px] text-stone-700">
                      Países: <strong className="text-stone-700">{flag.allowedCountries.join(', ')}</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SUBMODULE: CONFIGURAÇÕES */}
      {currentTab === 'configuracoes' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
              <Settings className="w-4 h-4 text-stone-700" />
              Configurações de Produto
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200">
                <span className="text-stone-700 block">Limite de Curtidas Diárias (Free)</span>
                <strong className="text-lg font-bold text-stone-900 font-mono mt-1 block">{dailyLikeLimit}</strong>
                {canWrite && (
                  <input
                    type="range"
                    min={10}
                    max={100}
                    value={dailyLikeLimit}
                    onChange={e => setDailyLikeLimit(Number(e.target.value))}
                    className="w-full mt-2 accent-rose-600 cursor-pointer"
                  />
                )}
              </div>

              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200">
                <span className="text-stone-700 block">Raio Padrão de Busca</span>
                <strong className="text-lg font-bold text-stone-900 font-mono mt-1 block">{defaultSearchRadiusKm} km</strong>
                {canWrite && (
                  <input
                    type="range"
                    min={20}
                    max={500}
                    step={10}
                    value={defaultSearchRadiusKm}
                    onChange={e => setDefaultSearchRadiusKm(Number(e.target.value))}
                    className="w-full mt-2 accent-rose-600 cursor-pointer"
                  />
                )}
              </div>

              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200">
                <span className="text-stone-700 block">Intervalo de Recarga (Cooldown)</span>
                <strong className="text-lg font-bold text-stone-900 font-mono mt-1 block">{matchCooldownSec} seg</strong>
                {canWrite && (
                  <input
                    type="range"
                    min={0}
                    max={60}
                    value={matchCooldownSec}
                    onChange={e => setMatchCooldownSec(Number(e.target.value))}
                    className="w-full mt-2 accent-rose-600 cursor-pointer"
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBMODULE: LANÇAMENTOS */}
      {currentTab === 'lancamentos' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
              <Rocket className="w-4 h-4 text-rose-600" />
              Histórico de Lançamentos & Versões
            </h3>

            <div className="space-y-3 text-xs">
              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-stone-900">v2.1.0-control-cplp (Versão Ativa em Produção)</span>
                  <span className="font-mono text-emerald-600 font-bold">● Lançado</span>
                </div>
                <p className="text-stone-700 mt-1">Implementação da nova arquitetura ÉN CONTROL com VS Code hierarchy e 10 módulos raiz.</p>
              </div>

              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-stone-900">v2.0.4-cplp-multicaixa</span>
                  <span className="font-mono text-stone-700">Lançado há 7 dias</span>
                </div>
                <p className="text-stone-700 mt-1">Conector estável para pagamentos Multicaixa Express e Pix.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
