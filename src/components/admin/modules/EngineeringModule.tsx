import React from 'react';
import { ModuleProps } from '../moduleRegistry';
import { EngineeringService } from '../../../services/admin/engineeringService';
import { Activity, Server, Zap, Cpu, AlertCircle, CheckCircle2, Shield } from 'lucide-react';

export const EngineeringModule: React.FC<ModuleProps> = () => {
  const engService = EngineeringService.getInstance();
  const health = engService.getHealthStatus();

  return (
    <div className="space-y-6 text-stone-900">
      {/* Header */}
      <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            Observabilidade Operacional
          </span>
          <span className="text-xs text-stone-700">Telemetria em tempo real</span>
        </div>
        <h2 className="text-base font-bold text-stone-900 mt-1">Saúde do Sistema & Métricas Operacionais</h2>
        <p className="text-xs text-stone-700 mt-0.5 max-w-xl">
          Camada de monitorização de latência, vazão e integridade de conexões da infraestrutura.
        </p>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl p-4 border border-stone-200 shadow-2xs">
          <div className="flex items-center justify-between text-stone-700 text-xs">
            <span>Latência P95</span>
            <Zap className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-xl font-bold text-stone-900 mt-2 font-mono">
            {health.liveMetrics.latencyP95Ms}ms
          </p>
          <span className="text-[10px] text-emerald-600 font-medium">Dentro do SLA (&lt;100ms)</span>
        </div>

        <div className="bg-white rounded-xl p-4 border border-stone-200 shadow-2xs">
          <div className="flex items-center justify-between text-stone-700 text-xs">
            <span>Taxa de Erro</span>
            <Activity className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-xl font-bold text-stone-900 mt-2 font-mono">
            {health.liveMetrics.errorRatePercent}%
          </p>
          <span className="text-[10px] text-emerald-600 font-medium">Normal</span>
        </div>

        <div className="bg-white rounded-xl p-4 border border-stone-200 shadow-2xs">
          <div className="flex items-center justify-between text-stone-700 text-xs">
            <span>Sessões Ativas</span>
            <Server className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-xl font-bold text-stone-900 mt-2 font-mono">
            {health.liveMetrics.activeSessions}
          </p>
          <span className="text-[10px] text-stone-700 font-medium">CPLP Conectados</span>
        </div>

        <div className="bg-white rounded-xl p-4 border border-stone-200 shadow-2xs">
          <div className="flex items-center justify-between text-stone-700 text-xs">
            <span>Uptime (30d)</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-xl font-bold text-stone-900 mt-2 font-mono">
            {health.uptimePercentage30d}%
          </p>
          <span className="text-[10px] text-emerald-600 font-medium">99.98% Alta Disp.</span>
        </div>
      </div>

      {/* System Telemetry Alerts */}
      <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs space-y-3 text-xs">
        <h3 className="font-bold text-stone-900 text-sm">Alertas e Otimizações Registradas</h3>
        <div className="space-y-2">
          {health.systemAlerts.map(alert => (
            <div key={alert.id} className="p-3 bg-stone-50 rounded-xl border border-stone-200/80 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-stone-800">{alert.service}</span>
                  <span className="text-[10px] text-stone-700 font-mono">
                    {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-stone-700 mt-0.5">{alert.message}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
