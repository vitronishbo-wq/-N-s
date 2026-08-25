import React, { useState } from 'react';
import { ModuleProps } from '../moduleRegistry';
import { GrowthService } from '../../../services/admin/growthService';
import { RbacService } from '../../../services/admin/rbacService';
import {
  TrendingUp,
  Globe2,
  Share2,
  Users,
  Target,
  Sparkles,
  Play,
  Pause,
  ArrowUpRight,
  Zap,
  ArrowRight,
  Gift,
  MapPin
} from 'lucide-react';
import { CPLPCountryCode } from '../../../types';

const COUNTRY_NAMES: Record<CPLPCountryCode, { name: string; flag: string }> = {
  AO: { name: 'Angola', flag: '🇦🇴' },
  BR: { name: 'Brasil', flag: '🇧🇷' },
  PT: { name: 'Portugal', flag: '🇵🇹' },
  MZ: { name: 'Moçambique', flag: '🇲🇿' },
  CV: { name: 'Cabo Verde', flag: '🇨🇻' },
  ST: { name: 'São Tomé e Príncipe', flag: '🇸🇹' },
  GW: { name: 'Guiné-Bissau', flag: '🇬🇼' },
  TL: { name: 'Timor-Leste', flag: '🇹🇱' },
  GQ: { name: 'Guiné Equatorial', flag: '🇬🇶' }
};

export const GrowthModule: React.FC<ModuleProps & { activeSubmoduleId?: string }> = ({
  currentAdmin,
  activeSubmoduleId = 'ativacao'
}) => {
  const growthService = GrowthService.getInstance();
  const [metrics, setMetrics] = useState(growthService.getMetrics());

  const rbac = RbacService.getInstance();
  const canManageGrowth = rbac.can(currentAdmin, 'growth:manage');

  const handleToggleCampaign = (campaignId: string) => {
    const res = growthService.toggleCampaignStatus(campaignId, currentAdmin);
    if (res.success) {
      setMetrics({ ...growthService.getMetrics() });
    }
  };

  const currentTab = activeSubmoduleId || 'ativacao';

  // Funnel steps data
  const funnelSteps = [
    { name: '1. Entrou no App', count: 12450, percent: 100, dropoff: '0%' },
    { name: '2. Viu Candidato', count: 10920, percent: 87.7, dropoff: '-12.3%' },
    { name: '3. Gostou / Curtiu', count: 6840, percent: 54.9, dropoff: '-32.8%' },
    { name: '4. Deu Match', count: 3280, percent: 26.3, dropoff: '-28.6%' },
    { name: '5. Iniciou Conversa', count: 2260, percent: 18.1, dropoff: '-8.2%' }
  ];

  return (
    <div className="space-y-6 text-stone-900">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            CRESCIMENTO · Aquisição & Retenção
          </span>
          <span className="text-xs text-stone-700">Ativação · Retenção · Convites · Expansão Geográfica</span>
        </div>
        <h2 className="text-base font-bold text-stone-900 mt-1">Métricas de Tração & Expansão Territorial Lusófona</h2>
        <p className="text-xs text-stone-700 mt-0.5 max-w-xl">
          Acompanhamento do funil de conversão, saúde dos cohorts de retenção e penetração nos 9 países CPLP.
        </p>
      </div>

      {/* SUBMODULE: ATIVAÇÃO */}
      {currentTab === 'ativacao' && (
        <div className="space-y-6">
          {/* Funnel Box */}
          <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-2xs space-y-4">
            <div>
              <h3 className="text-sm font-bold text-stone-900">Funil de Ativação do Utilizador</h3>
              <p className="text-xs text-stone-700 mt-0.5">
                Mapeamento do percurso: Entrou → Viu candidato → Gostou → Match → Conversa
              </p>
            </div>

            <div className="space-y-3 pt-2">
              {funnelSteps.map((step, idx) => (
                <div key={step.name} className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-stone-900">{step.name}</span>
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-stone-700">{step.count.toLocaleString()} utilizadores</span>
                      <span className="font-mono font-bold text-emerald-600">({step.percent}%)</span>
                      {idx > 0 && <span className="font-mono text-[10px] text-rose-600">{step.dropoff}</span>}
                    </div>
                  </div>
                  <div className="w-full bg-stone-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${step.percent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SUBMODULE: RETENÇÃO */}
      {currentTab === 'retencao' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-stone-900">Cohorts de Retenção CPLP</h3>
            <p className="text-xs text-stone-700">Percentual de retorno dos utilizadores ao longo do tempo.</p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 text-center">
                <span className="text-[11px] text-stone-700 uppercase font-bold block">Retenção D1</span>
                <span className="text-2xl font-bold font-mono text-stone-900 mt-2 block">{metrics.retentionD1Percent}%</span>
                <span className="text-[10px] text-emerald-600 mt-1 block">Retorno no dia seguinte</span>
              </div>
              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 text-center">
                <span className="text-[11px] text-stone-700 uppercase font-bold block">Retenção D7</span>
                <span className="text-2xl font-bold font-mono text-stone-900 mt-2 block">{metrics.retentionD7Percent}%</span>
                <span className="text-[10px] text-emerald-600 mt-1 block">Ativos após 1 semana</span>
              </div>
              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 text-center">
                <span className="text-[11px] text-stone-700 uppercase font-bold block">Retenção D14</span>
                <span className="text-2xl font-bold font-mono text-stone-900 mt-2 block">38.4%</span>
                <span className="text-[10px] text-emerald-600 mt-1 block">Ativos após 2 semanas</span>
              </div>
              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 text-center">
                <span className="text-[11px] text-stone-700 uppercase font-bold block">Retenção D30</span>
                <span className="text-2xl font-bold font-mono text-stone-900 mt-2 block">{metrics.retentionD30Percent}%</span>
                <span className="text-[10px] text-emerald-600 mt-1 block">Retenção mensal consolidada</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBMODULE: CONVITES */}
      {currentTab === 'convites' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                <Gift className="w-4 h-4 text-rose-600" />
                Campanhas & Códigos de Indicação
              </h3>
              <div className="text-xs text-stone-700">
                K-Factor Viral: <strong className="font-mono text-emerald-600">{metrics.viralCoefficientK}</strong>
              </div>
            </div>

            <div className="space-y-3">
              {metrics.referralCampaigns.map(camp => (
                <div key={camp.id} className="p-4 rounded-xl bg-stone-50 border border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-stone-900">{camp.name}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        camp.active ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200 text-stone-700'
                      }`}>
                        {camp.active ? 'Ativa' : 'Pausada'}
                      </span>
                    </div>
                    <span className="text-stone-700 mt-1 block">Recompensa: {camp.reward}</span>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="font-mono font-bold text-stone-900">{camp.conversionsCount.toLocaleString()}</div>
                      <div className="text-[10px] text-stone-700">conversões</div>
                    </div>

                    {canManageGrowth && (
                      <button
                        type="button"
                        onClick={() => handleToggleCampaign(camp.id)}
                        className="px-3 py-1 bg-white border border-stone-200 hover:bg-stone-100 rounded-lg font-semibold text-stone-700 cursor-pointer"
                      >
                        {camp.active ? 'Pausar' : 'Ativar'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SUBMODULE: EXPANSÃO GEOGRÁFICA */}
      {currentTab === 'expansao_geo' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-600" />
              Penetração Territorial nos 9 Países CPLP
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {metrics.territoryExpansion.map(terr => {
                const country = COUNTRY_NAMES[terr.country];
                return (
                  <div key={terr.country} className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-bold text-stone-900">
                        <span className="text-lg">{country.flag}</span>
                        <span>{country.name}</span>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        terr.stage === 'scaled'
                          ? 'bg-emerald-100 text-emerald-800'
                          : terr.stage === 'launching'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {terr.stage}
                      </span>
                    </div>

                    <div className="space-y-1 pt-1 text-[11px] text-stone-700">
                      <div className="flex justify-between">
                        <span>Penetração:</span>
                        <strong className="font-mono text-stone-900">{terr.marketPenetrationPercent}%</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Crescimento semanal:</span>
                        <strong className="font-mono text-emerald-600">+{terr.weeklyGrowthPercent}%</strong>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
