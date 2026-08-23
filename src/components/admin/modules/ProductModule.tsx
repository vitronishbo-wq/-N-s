import React, { useState } from 'react';
import { ModuleProps } from '../moduleRegistry';
import { ProductService } from '../../../services/admin/productService';
import { RbacService } from '../../../services/admin/rbacService';
import { ProductFeatureFlag } from '../../../types';
import { Flag, Sliders, ToggleLeft, ToggleRight, CheckCircle2, Shield } from 'lucide-react';

export const ProductModule: React.FC<ModuleProps> = ({ currentAdmin }) => {
  const productService = ProductService.getInstance();
  const rbac = RbacService.getInstance();

  const [flags, setFlags] = useState<ProductFeatureFlag[]>(() => productService.getFlags());
  const canWrite = rbac.can(currentAdmin, 'product:flags:write');

  const reload = () => setFlags(productService.getFlags());

  const handleToggle = (flag: ProductFeatureFlag) => {
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

  return (
    <div className="space-y-6 text-stone-900">
      {/* Header */}
      <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200">
            Product Exposure & Progressive Rollout
          </span>
          <span className="text-xs text-stone-700">Controlo desacoplado de funcionalidades</span>
        </div>
        <h2 className="text-base font-bold text-stone-900 mt-1">Feature Flags & Experimentos Culturais</h2>
        <p className="text-xs text-stone-700 mt-0.5 max-w-xl">
          Controle percentuais de exposição e cohorts de forma centralizada sem alterar os componentes da interface pública.
        </p>
      </div>

      {/* Flags List */}
      <div className="space-y-4">
        {flags.map(flag => (
          <div
            key={flag.key}
            className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs space-y-4 text-xs"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-stone-900">{flag.name}</span>
                  <span className="font-mono text-[10px] px-2 py-0.5 bg-stone-100 text-stone-700 rounded">
                    {flag.key}
                  </span>
                  <span
                    className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase ${
                      flag.enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200 text-stone-700'
                    }`}
                  >
                    {flag.enabled ? 'Ativo' : 'Desativado'}
                  </span>
                </div>
                <p className="text-stone-700 mt-1">{flag.description}</p>
              </div>

              {canWrite && (
                <button
                  type="button"
                  onClick={() => handleToggle(flag)}
                  className={`px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 transition cursor-pointer self-start sm:self-auto ${
                    flag.enabled
                      ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                  }`}
                >
                  {flag.enabled ? 'Desativar Flag' : 'Ativar Flag'}
                </button>
              )}
            </div>

            {/* Rollout slider & Cohorts */}
            <div className="pt-3 border-t border-stone-100 grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-medium text-stone-700">Percentual de Rollout:</span>
                  <span className="font-mono font-bold text-stone-900">{flag.rolloutPercentage}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  disabled={!canWrite || !flag.enabled}
                  value={flag.rolloutPercentage}
                  onChange={e => handleRolloutChange(flag.key, Number(e.target.value))}
                  className="w-full accent-rose-600 cursor-pointer disabled:opacity-40"
                />
              </div>

              <div className="flex flex-wrap gap-1 items-center sm:justify-end">
                <span className="text-[11px] text-stone-700 mr-1">Países:</span>
                {flag.allowedCountries.map(c => (
                  <span key={c} className="text-[10px] font-mono px-1.5 py-0.5 bg-stone-100 rounded text-stone-700 font-bold">
                    {c}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
