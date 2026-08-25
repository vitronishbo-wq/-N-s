import React, { useState } from 'react';
import { ModuleProps } from '../moduleRegistry';
import { DiscoveryService, ExpansionPolicy } from '../../../services/admin/discoveryService';
import { RbacService } from '../../../services/admin/rbacService';
import { CPLPCountryCode } from '../../../types';
import {
  Compass,
  Cpu,
  Globe2,
  Sliders,
  Layers,
  MapPin,
  TrendingUp
} from 'lucide-react';

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

interface DiscoveryModuleProps extends ModuleProps {
  activeSubmoduleId?: string;
  onSelectSubmodule?: (subId: string) => void;
}

export const DiscoveryModule: React.FC<DiscoveryModuleProps> = ({
  currentAdmin,
  activeSubmoduleId = 'motor'
}) => {
  const discoveryService = DiscoveryService.getInstance();
  const rbac = RbacService.getInstance();
  const canManage = rbac.can(currentAdmin, 'product:flags:write');

  const [engine, setEngine] = useState(discoveryService.getEngineConfig());
  const [availability, setAvailability] = useState(discoveryService.getAvailability());
  const [expansionPolicies, setExpansionPolicies] = useState(discoveryService.getExpansionPolicies());
  const [rankingFactors, setRankingFactors] = useState(discoveryService.getRankingFactors());
  const [diversity] = useState(discoveryService.getDiversityConfig());

  const handleToggleEngineStatus = () => {
    if (!canManage) return;
    const nextStatus = engine.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    const res = discoveryService.updateEngineConfig({ status: nextStatus }, currentAdmin);
    if (res.success) {
      setEngine(discoveryService.getEngineConfig());
    }
  };

  const handleUpdateAlgorithm = (alg: any) => {
    if (!canManage) return;
    const res = discoveryService.updateEngineConfig({ algorithm: alg }, currentAdmin);
    if (res.success) {
      setEngine(discoveryService.getEngineConfig());
    }
  };

  const handleUpdateAiInfluence = (ai: any) => {
    if (!canManage) return;
    const res = discoveryService.updateEngineConfig({ aiInfluence: ai }, currentAdmin);
    if (res.success) {
      setEngine(discoveryService.getEngineConfig());
    }
  };

  const handleToggleIncentive = (id: string) => {
    if (!canManage) return;
    const res = discoveryService.toggleExpansionIncentive(id, currentAdmin);
    if (res.success) {
      setAvailability(discoveryService.getAvailability());
    }
  };

  const handleToggleExpansionPolicy = (scope: ExpansionPolicy['scope']) => {
    if (!canManage) return;
    const res = discoveryService.toggleExpansionPolicy(scope, currentAdmin);
    if (res.success) {
      setExpansionPolicies(discoveryService.getExpansionPolicies());
    }
  };

  const handleWeightChange = (id: string, newWeight: number) => {
    if (!canManage) return;
    const res = discoveryService.updateRankingFactorWeight(id, newWeight, currentAdmin);
    if (res.success) {
      setRankingFactors(discoveryService.getRankingFactors());
    }
  };

  const currentTab = activeSubmoduleId || 'motor';

  return (
    <div className="space-y-6 text-stone-900">
      {/* Module Header Bar */}
      <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                DISCOVERY · Motor Principal
              </span>
              <span className="text-xs text-stone-700">Matching · Availability · Expansion · Ranking · Diversity</span>
            </div>
            <h2 className="text-base font-bold text-stone-900 mt-1">Motor de Descoberta & Afinidade Lusófona</h2>
            <p className="text-xs text-stone-700 mt-0.5 max-w-xl">
              Supervisão e configuração do algoritmo de recomendação, políticas de expansão geográfica e densidade de perfis em cada praça CPLP.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold px-3 py-1.5 rounded-xl border flex items-center gap-1.5 ${
              engine.status === 'ACTIVE'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}>
              <span className={`w-2 h-2 rounded-full ${engine.status === 'ACTIVE' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              <span>Motor {engine.status}</span>
            </span>
          </div>
        </div>
      </div>

      {/* SUBMODULE: MOTOR */}
      {currentTab === 'motor' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-2xs">
            <h3 className="text-sm font-bold text-stone-900 mb-4 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-rose-600" />
              Configuração Ativa do MATCHING V1
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200">
                <span className="text-xs text-stone-700 block">Status do Motor</span>
                <div className="text-base font-bold text-stone-900 mt-1 flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${engine.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  {engine.status}
                </div>
                {canManage && (
                  <button
                    type="button"
                    onClick={handleToggleEngineStatus}
                    className="mt-3 w-full py-1.5 text-xs font-semibold rounded-lg bg-white border border-stone-200 hover:bg-stone-100 text-stone-700 cursor-pointer"
                  >
                    {engine.status === 'ACTIVE' ? 'Pausar Motor' : 'Ativar Motor'}
                  </button>
                )}
              </div>

              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200">
                <span className="text-xs text-stone-700 block">Tipo de Algoritmo</span>
                <div className="text-base font-bold text-stone-900 mt-1">
                  {engine.algorithm}
                </div>
                {canManage && (
                  <div className="mt-3 flex gap-1">
                    {(['DETERMINISTIC', 'HYBRID', 'VECTOR_SIMILARITY'] as const).map(alg => (
                      <button
                        key={alg}
                        type="button"
                        onClick={() => handleUpdateAlgorithm(alg)}
                        className={`text-[10px] font-semibold px-2 py-1 rounded cursor-pointer ${
                          engine.algorithm === alg
                            ? 'bg-rose-600 text-white'
                            : 'bg-white border border-stone-200 text-stone-700 hover:bg-stone-100'
                        }`}
                      >
                        {alg.substring(0, 4)}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200">
                <span className="text-xs text-stone-700 block">Influência da IA</span>
                <div className="text-base font-bold text-stone-900 mt-1">
                  {engine.aiInfluence}
                </div>
                {canManage && (
                  <div className="mt-3 flex gap-1">
                    {(['NONE', 'EXPLANATION_ONLY', 'RERANKING'] as const).map(inf => (
                      <button
                        key={inf}
                        type="button"
                        onClick={() => handleUpdateAiInfluence(inf)}
                        className={`text-[10px] font-semibold px-2 py-1 rounded cursor-pointer ${
                          engine.aiInfluence === inf
                            ? 'bg-rose-600 text-white'
                            : 'bg-white border border-stone-200 text-stone-700 hover:bg-stone-100'
                        }`}
                      >
                        {inf === 'EXPLANATION_ONLY' ? 'EXPLANATION' : inf}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Weights Sliders */}
            <div className="mt-6 pt-6 border-t border-stone-100 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700">
                Pesos de Afinidade no Cálculo do Score
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-stone-700">Afinidade Cultural Lusófona</span>
                    <strong className="font-mono text-stone-900">{engine.culturalWeight}%</strong>
                  </div>
                  <div className="w-full bg-stone-100 rounded-full h-2">
                    <div className="bg-rose-600 h-2 rounded-full" style={{ width: `${engine.culturalWeight}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-stone-700">Proximidade Geográfica</span>
                    <strong className="font-mono text-stone-900">{engine.proximityWeight}%</strong>
                  </div>
                  <div className="w-full bg-stone-100 rounded-full h-2">
                    <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${engine.proximityWeight}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-stone-700">Score de Reciprocidade</span>
                    <strong className="font-mono text-stone-900">{engine.reciprocityWeight}%</strong>
                  </div>
                  <div className="w-full bg-stone-100 rounded-full h-2">
                    <div className="bg-emerald-600 h-2 rounded-full" style={{ width: `${engine.reciprocityWeight}%` }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBMODULE: DISPONIBILIDADE */}
      {currentTab === 'disponibilidade' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs">
            <h3 className="text-sm font-bold text-stone-900 mb-1 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-rose-600" />
              Disponibilidade & Densidade por Localidade
            </h3>
            <p className="text-xs text-stone-700 mb-4">
              Estado de densidade de perfis em cada praça lusófona. Ative o modo expansão para cidades com densidade inicial (LOW).
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {availability.map(loc => {
                const countryMeta = COUNTRY_NAMES[loc.country] || { name: loc.country, flag: '🌍' };

                return (
                  <div key={loc.id} className="p-4 rounded-xl bg-stone-50 border border-stone-200 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{countryMeta.flag}</span>
                          <div>
                            <div className="text-xs font-bold text-stone-900">{loc.city}</div>
                            <div className="text-[10px] text-stone-700">{countryMeta.name} ({loc.country})</div>
                          </div>
                        </div>

                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          loc.density === 'AVAILABLE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {loc.density}
                        </span>
                      </div>

                      <div className="mt-3 text-xs text-stone-700 flex justify-between">
                        <span>Perfis Ativos:</span>
                        <strong className="font-mono text-stone-900">{loc.activeProfiles.toLocaleString()}</strong>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-stone-200/80 flex items-center justify-between">
                      <span className="text-[10px] text-stone-700">
                        Incentivo Expansão: <strong className={loc.expansionIncentiveActive ? 'text-emerald-600' : 'text-stone-700'}>{loc.expansionIncentiveActive ? 'ON' : 'OFF'}</strong>
                      </span>

                      {canManage && (
                        <button
                          type="button"
                          onClick={() => handleToggleIncentive(loc.id)}
                          className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition cursor-pointer ${
                            loc.expansionIncentiveActive
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              : 'bg-stone-200 hover:bg-stone-300 text-stone-700'
                          }`}
                        >
                          {loc.expansionIncentiveActive ? 'Desativar' : 'Ativar Modo Expansão'}
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

      {/* SUBMODULE: EXPANSÃO */}
      {currentTab === 'expansao' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs">
            <h3 className="text-sm font-bold text-stone-900 mb-1 flex items-center gap-2">
              <Globe2 className="w-4 h-4 text-emerald-600" />
              Políticas de Expansão Territorial (EXPANSION POLICY)
            </h3>
            <p className="text-xs text-stone-700 mb-4">
              Defina os níveis de permissividade e alcance do motor de busca entre municípios, regiões e além-fronteiras CPLP.
            </p>

            <div className="space-y-3">
              {expansionPolicies.map(pol => (
                <div key={pol.scope} className="p-4 rounded-xl bg-stone-50 border border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-stone-900">{pol.scope}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        pol.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-stone-200 text-stone-700'
                      }`}>
                        {pol.status}
                      </span>
                    </div>
                    <p className="text-xs text-stone-700 mt-1">{pol.description}</p>
                    <div className="text-[11px] text-stone-700 mt-1">
                      Países autorizados: <strong className="text-stone-700">{pol.allowedCountries.join(', ')}</strong>
                    </div>
                  </div>

                  {canManage && (
                    <button
                      type="button"
                      onClick={() => handleToggleExpansionPolicy(pol.scope)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer self-start sm:self-auto ${
                        pol.status === 'ACTIVE'
                          ? 'bg-stone-200 hover:bg-stone-300 text-stone-800'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      }`}
                    >
                      {pol.status === 'ACTIVE' ? 'Desativar Política' : 'Ativar Política'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SUBMODULE: RANKING */}
      {currentTab === 'ranking' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs">
            <h3 className="text-sm font-bold text-stone-900 mb-1 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-purple-600" />
              Fatores de Ranking & Ordenação de Perfis
            </h3>
            <p className="text-xs text-stone-700 mb-4">
              Ajuste o peso relativo de cada atributo na pontuação de prioridade do feed de descobertas.
            </p>

            <div className="space-y-3">
              {rankingFactors.map(factor => (
                <div key={factor.id} className="p-4 rounded-xl bg-stone-50 border border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1 max-w-md">
                    <span className="font-bold text-xs text-stone-900">{factor.name}</span>
                    <p className="text-xs text-stone-700">{factor.description}</p>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono font-bold text-stone-900 bg-white px-2 py-1 rounded border border-stone-200">
                      Peso: {factor.weight} / 10
                    </span>
                    {canManage && (
                      <input
                        type="range"
                        min={1}
                        max={10}
                        value={factor.weight}
                        onChange={e => handleWeightChange(factor.id, Number(e.target.value))}
                        className="accent-rose-600 cursor-pointer"
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SUBMODULE: DIVERSIDADE */}
      {currentTab === 'diversidade' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" />
              Regras de Diversidade Cultural no Feed
            </h3>
            <p className="text-xs text-stone-700">
              Garante balanceamento dinâmico para evitar monopólio de perfis da mesma cidade ou bolhas fechadas.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200">
                <span className="text-xs text-stone-700 block">Proporção Máxima Mesma Cidade</span>
                <strong className="text-lg font-bold text-stone-900 font-mono mt-1 block">
                  {(diversity.maxSameCityRatio * 100).toFixed(0)}%
                </strong>
                <p className="text-[11px] text-stone-700 mt-1">
                  Máximo de perfis locais consecutivos antes de injetar candidatos regionais.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200">
                <span className="text-xs text-stone-700 block">Cota Transfronteiriça CPLP</span>
                <strong className="text-lg font-bold text-emerald-600 font-mono mt-1 block">
                  {(diversity.cplpCrossBorderRatio * 100).toFixed(0)}%
                </strong>
                <p className="text-[11px] text-stone-700 mt-1">
                  Percentual de perfis internacionais lusófonos exibidos a cada ciclo de 10 perfis.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
