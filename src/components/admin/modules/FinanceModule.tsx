import React from 'react';
import { ModuleProps } from '../moduleRegistry';
import { FinanceService } from '../../../services/admin/financeService';
import { DollarSign, TrendingUp, Users, ArrowUpRight, CreditCard } from 'lucide-react';
import { CPLPCountryCode } from '../../../types';

export const FinanceModule: React.FC<ModuleProps> = () => {
  const financeService = FinanceService.getInstance();
  const ledger = financeService.getLedger();

  return (
    <div className="space-y-6 text-stone-900">
      {/* Header */}
      <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
            Métricas Financeiras & Livro Razão
          </span>
          <span className="text-xs text-stone-700">Desacoplado de fornecedores</span>
        </div>
        <h2 className="text-base font-bold text-stone-900 mt-1">Finanças & Receita Transfronteiriça CPLP</h2>
        <p className="text-xs text-stone-700 mt-0.5 max-w-xl">
          Métricas consolidadas de assinaturas, ARPU e volumes por país lusófono.
        </p>
      </div>

      {/* High-level KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl p-4 border border-stone-200 shadow-2xs">
          <span className="text-xs text-stone-700">MRR Recorrente</span>
          <p className="text-xl font-bold text-stone-900 mt-1 font-mono">
            €{ledger.mrrEur.toLocaleString()}
          </p>
          <span className="text-[10px] text-emerald-600 font-medium">+14.2% este mês</span>
        </div>

        <div className="bg-white rounded-xl p-4 border border-stone-200 shadow-2xs">
          <span className="text-xs text-stone-700">Receita Total (30d)</span>
          <p className="text-xl font-bold text-stone-900 mt-1 font-mono">
            €{ledger.totalRevenueEur30d.toLocaleString()}
          </p>
          <span className="text-[10px] text-stone-700 font-medium">9 países</span>
        </div>

        <div className="bg-white rounded-xl p-4 border border-stone-200 shadow-2xs">
          <span className="text-xs text-stone-700">Assinaturas Ativas</span>
          <p className="text-xl font-bold text-stone-900 mt-1 font-mono">
            {ledger.activeSubscriptionsCount}
          </p>
          <span className="text-[10px] text-emerald-600 font-medium">Churn &lt; 1.2%</span>
        </div>

        <div className="bg-white rounded-xl p-4 border border-stone-200 shadow-2xs">
          <span className="text-xs text-stone-700">ARPU Médio</span>
          <p className="text-xl font-bold text-stone-900 mt-1 font-mono">
            €{ledger.arpuEur.toFixed(2)}
          </p>
          <span className="text-[10px] text-stone-700 font-medium">Por utilizador pagante</span>
        </div>
      </div>

      {/* Country Breakdown */}
      <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs space-y-3 text-xs">
        <h3 className="font-bold text-stone-900 text-sm">Distribuição de Receita por País Lusófono</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pt-1">
          {Object.entries(ledger.countryRevenuesEur).map(([code, val]) => (
            <div key={code} className="p-3 bg-stone-50 rounded-xl border border-stone-200/80">
              <span className="text-xs font-bold text-stone-800 uppercase font-mono">{code}</span>
              <p className="text-sm font-bold text-stone-900 mt-0.5 font-mono">€{val.toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
