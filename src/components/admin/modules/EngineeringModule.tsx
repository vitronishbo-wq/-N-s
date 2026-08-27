import React, { useState, useEffect } from 'react';
import { ModuleProps } from '../moduleRegistry';
import { EngineeringService } from '../../../services/admin/engineeringService';
import { dataSaver, SimulatedNetworkMode, BandwidthTelemetry } from '../../../services/dataSaverService';
import {
  Activity,
  Server,
  Zap,
  Cpu,
  AlertCircle,
  CheckCircle2,
  Shield,
  GitBranch,
  Rocket,
  Bug,
  Gauge,
  RotateCcw,
  Wifi,
  WifiOff,
  Database,
  Sparkles,
  Download,
  RefreshCw,
  Radio,
  Layers,
  ArrowRight
} from 'lucide-react';

export const EngineeringModule: React.FC<ModuleProps & { activeSubmoduleId?: string }> = ({
  currentAdmin,
  activeSubmoduleId = 'saude'
}) => {
  const engService = EngineeringService.getInstance();
  const health = engService.getHealthStatus();

  const [deployments, setDeployments] = useState([
    { id: 'dep_01', version: 'v2.1.0-control-cplp', commit: '8f92a1c', branch: 'main', deployedAt: 'Há 18 min', author: 'Marcelo Truman', status: 'SUCCESS' },
    { id: 'dep_02', version: 'v2.0.4-cplp-multicaixa', commit: '3b41e9d', branch: 'main', deployedAt: 'Há 7 dias', author: 'Engenharia CPLP', status: 'SUCCESS' }
  ]);

  const [errors, setErrors] = useState([
    { id: 'err_01', message: 'Timeout na resolução DNS secundária EMIS Luanda (recuperado com retry)', component: 'Payment-Worker', count: 3, lastOccurred: 'Há 42 min', severity: 'WARNING' },
    { id: 'err_02', message: 'WebSocket handshake cancelado pelo cliente (rede móvel 3G instável)', component: 'Chat-Gateway', count: 12, lastOccurred: 'Há 15 min', severity: 'INFO' }
  ]);

  const [telemetry, setTelemetry] = useState<BandwidthTelemetry>(() => dataSaver.getTelemetry());
  const [offlineQueue, setOfflineQueue] = useState(() => dataSaver.getQueue());
  const [networkMode, setNetworkMode] = useState<SimulatedNetworkMode>(() => dataSaver.getSimulatedMode());
  const [isFlushing, setIsFlushing] = useState(false);

  useEffect(() => {
    const unsubscribe = dataSaver.subscribe((event) => {
      if (event === 'telemetry_change') setTelemetry(dataSaver.getTelemetry());
      if (event === 'queue_change') setOfflineQueue(dataSaver.getQueue());
      if (event === 'network_change') setNetworkMode(dataSaver.getSimulatedMode());
    });
    return () => unsubscribe();
  }, []);

  const handleManualFlush = async () => {
    setIsFlushing(true);
    try {
      await dataSaver.flushQueue();
      setOfflineQueue(dataSaver.getQueue());
    } finally {
      setIsFlushing(false);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const totalCalculated = telemetry.totalBytesDownloaded + telemetry.totalBytesSaved;
  const savedPercent = totalCalculated > 0 ? Math.round((telemetry.totalBytesSaved / totalCalculated) * 100) : 0;

  const currentTab = activeSubmoduleId || 'saude';

  return (
    <div className="space-y-6 text-stone-900">
      {/* Header */}
      <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            ENGENHARIA · Infraestrutura & Telemetria
          </span>
          <span className="text-xs text-stone-700">Saúde · Versões · Deployments · Erros · Performance</span>
        </div>
        <h2 className="text-base font-bold text-stone-900 mt-1">Observabilidade & Gestão de Engenharia</h2>
        <p className="text-xs text-stone-700 mt-0.5 max-w-xl">
          Telemetria em tempo real, controle de releases, rastreamento de exceções e métricas de desempenho dos nós CPLP.
        </p>
      </div>

      {/* SUBMODULE: SAÚDE */}
      {currentTab === 'saude' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-2xs">
              <div className="flex items-center justify-between text-stone-700 text-xs">
                <span>Latência P95</span>
                <Zap className="w-4 h-4 text-amber-500" />
              </div>
              <p className="text-2xl font-bold text-stone-900 mt-2 font-mono">
                {health.liveMetrics.latencyP95Ms}ms
              </p>
              <span className="text-[10px] text-emerald-600 font-medium">Dentro do SLA (&lt;100ms)</span>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-2xs">
              <div className="flex items-center justify-between text-stone-700 text-xs">
                <span>Taxa de Erro</span>
                <Activity className="w-4 h-4 text-emerald-500" />
              </div>
              <p className="text-2xl font-bold text-stone-900 mt-2 font-mono">
                {health.liveMetrics.errorRatePercent}%
              </p>
              <span className="text-[10px] text-emerald-600 font-medium">Estável</span>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-2xs">
              <div className="flex items-center justify-between text-stone-700 text-xs">
                <span>Sessões Ativas</span>
                <Server className="w-4 h-4 text-blue-500" />
              </div>
              <p className="text-2xl font-bold text-stone-900 mt-2 font-mono">
                {health.liveMetrics.activeSessions}
              </p>
              <span className="text-[10px] text-stone-700 font-medium">CPLP Conectados</span>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-2xs">
              <div className="flex items-center justify-between text-stone-700 text-xs">
                <span>Uptime (30d)</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
              <p className="text-2xl font-bold text-stone-900 mt-2 font-mono">
                {health.uptimePercentage30d}%
              </p>
              <span className="text-[10px] text-emerald-600 font-medium">99.98% SLA</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs space-y-3 text-xs">
            <h3 className="font-bold text-stone-900 text-sm">Alertas e Otimizações de Telemetria</h3>
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
      )}

      {/* SUBMODULE: VERSÕES */}
      {currentTab === 'versoes' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-rose-600" />
              Versões & Artefatos de Build
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200">
                <span className="text-stone-700 block">Versão Ativa</span>
                <strong className="text-sm font-mono text-stone-900 mt-1 block">{health.activeAppVersion}</strong>
              </div>
              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200">
                <span className="text-stone-700 block">Commit Hash</span>
                <strong className="text-sm font-mono text-stone-900 mt-1 block">8f92a1c8901b</strong>
              </div>
              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200">
                <span className="text-stone-700 block">Ambiente</span>
                <strong className="text-sm text-emerald-600 font-bold mt-1 block">Produção (Cloud Run CPLP)</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBMODULE: DEPLOYMENTS */}
      {currentTab === 'deployments' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
              <Rocket className="w-4 h-4 text-emerald-600" />
              Histórico de Deployments & Rollbacks
            </h3>

            <div className="space-y-3">
              {deployments.map(dep => (
                <div key={dep.id} className="p-4 rounded-xl bg-stone-50 border border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-stone-900">{dep.version}</span>
                      <span className="font-mono text-[10px] bg-white px-2 py-0.5 rounded border border-stone-200">
                        {dep.commit} ({dep.branch})
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 uppercase">
                        {dep.status}
                      </span>
                    </div>
                    <span className="text-stone-700 mt-1 block">Implantado {dep.deployedAt} por {dep.author}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => alert(`Rollback para versão ${dep.version} solicitado!`)}
                    className="px-3 py-1 bg-white border border-stone-200 hover:bg-stone-100 text-stone-700 rounded-lg font-semibold cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
                  >
                    <RotateCcw className="w-3 h-3 text-rose-600" />
                    <span>Rollback</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SUBMODULE: ERROS */}
      {currentTab === 'erros' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
              <Bug className="w-4 h-4 text-rose-600" />
              Rastreamento de Exceções & Logs de Erro
            </h3>

            <div className="space-y-3">
              {errors.map(err => (
                <div key={err.id} className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-stone-900">{err.component}</span>
                    <span className="font-mono text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-bold">
                      {err.count} ocorrências ({err.lastOccurred})
                    </span>
                  </div>
                  <p className="font-mono text-stone-700 text-[11px] bg-white p-2 rounded border border-stone-200 mt-1">
                    {err.message}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SUBMODULE: DATA SAVER & RESILIÊNCIA CPLP (PONTO 4) */}
      {currentTab === 'data_saver' && (
        <div className="space-y-6">
          {/* Top Telemetry KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-2xs">
              <div className="flex items-center justify-between text-stone-700 text-xs">
                <span>Dados Poupados</span>
                <Sparkles className="w-4 h-4 text-emerald-500" />
              </div>
              <p className="text-2xl font-bold text-emerald-700 mt-2 font-mono">
                {formatBytes(telemetry.totalBytesSaved)}
              </p>
              <span className="text-[10px] text-emerald-600 font-bold">{savedPercent}% de economia real</span>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-2xs">
              <div className="flex items-center justify-between text-stone-700 text-xs">
                <span>Tráfego Efetivo</span>
                <Download className="w-4 h-4 text-blue-500" />
              </div>
              <p className="text-2xl font-bold text-stone-900 mt-2 font-mono">
                {formatBytes(telemetry.totalBytesDownloaded)}
              </p>
              <span className="text-[10px] text-stone-600 font-medium">Consumo de pacotes</span>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-2xs">
              <div className="flex items-center justify-between text-stone-700 text-xs">
                <span>Taxa de Cache (Hits)</span>
                <Database className="w-4 h-4 text-amber-500" />
              </div>
              <p className="text-2xl font-bold text-stone-900 mt-2 font-mono">
                {telemetry.cacheHitsCount} hits
              </p>
              <span className="text-[10px] text-amber-700 font-medium">Evitou requisições redundantes</span>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-2xs">
              <div className="flex items-center justify-between text-stone-700 text-xs">
                <span>Fila Offline</span>
                <Wifi className="w-4 h-4 text-rose-500" />
              </div>
              <p className="text-2xl font-bold text-rose-700 mt-2 font-mono">
                {offlineQueue.length}
              </p>
              <span className="text-[10px] text-stone-600 font-medium">Eventos aguardando sync</span>
            </div>
          </div>

          {/* Technical Architecture Specs */}
          <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-rose-600" />
                Matriz Técnica de Resolução & Degradação por Tier
              </h3>
              <span className="text-[10px] font-mono bg-stone-100 text-stone-700 px-2 py-0.5 rounded border border-stone-200">
                DataSaverService v2.2
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-stone-200 text-stone-700 text-[10px] uppercase font-bold">
                    <th className="py-2.5 px-3">Modo / Nível</th>
                    <th className="py-2.5 px-3">Largura Max (Cards)</th>
                    <th className="py-2.5 px-3">Largura Max (Avatars)</th>
                    <th className="py-2.5 px-3">Qualidade</th>
                    <th className="py-2.5 px-3">Formato</th>
                    <th className="py-2.5 px-3 text-right">Payload Médio</th>
                    <th className="py-2.5 px-3 text-right">Economia vs RAW</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  <tr className="bg-rose-50/50">
                    <td className="py-2.5 px-3 font-sans font-bold text-rose-900">Ultra Econômico</td>
                    <td className="py-2.5 px-3">240px</td>
                    <td className="py-2.5 px-3">120px</td>
                    <td className="py-2.5 px-3">q=45</td>
                    <td className="py-2.5 px-3 font-bold text-emerald-700">WebP</td>
                    <td className="py-2.5 px-3 text-right font-bold text-rose-800">~15-28 KB</td>
                    <td className="py-2.5 px-3 text-right font-bold text-emerald-700">~93%</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-sans font-bold text-stone-900">Equilibrado (Default)</td>
                    <td className="py-2.5 px-3">480px</td>
                    <td className="py-2.5 px-3">200px</td>
                    <td className="py-2.5 px-3">q=65</td>
                    <td className="py-2.5 px-3 text-emerald-700">WebP</td>
                    <td className="py-2.5 px-3 text-right font-bold text-stone-800">~45-68 KB</td>
                    <td className="py-2.5 px-3 text-right font-bold text-emerald-700">~75%</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-sans font-bold text-stone-900">Qualidade Alta</td>
                    <td className="py-2.5 px-3">800px</td>
                    <td className="py-2.5 px-3">300px</td>
                    <td className="py-2.5 px-3">q=80</td>
                    <td className="py-2.5 px-3">Auto</td>
                    <td className="py-2.5 px-3 text-right font-bold text-stone-800">~180-350 KB</td>
                    <td className="py-2.5 px-3 text-right font-bold text-stone-600">~40%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Offline Queue Inspector & Manual Dispatch */}
          <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                <Database className="w-4 h-4 text-amber-600" />
                Inspetor de Fila Offline Local & Reenvio
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleManualFlush}
                  disabled={isFlushing || offlineQueue.length === 0}
                  className="px-3 py-1.5 bg-stone-900 hover:bg-stone-800 disabled:bg-stone-200 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                >
                  <RefreshCw className={`w-3 h-3 ${isFlushing ? 'animate-spin' : ''}`} />
                  <span>{isFlushing ? 'Despejando...' : 'Forçar Sync Imediato'}</span>
                </button>
              </div>
            </div>

            {offlineQueue.length === 0 ? (
              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 text-stone-600 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>A fila de eventos offline está vazia. Todas as ações foram sincronizadas com o backend.</span>
              </div>
            ) : (
              <div className="space-y-2">
                {offlineQueue.map(item => (
                  <div key={item.id} className="p-3 bg-stone-50 rounded-xl border border-stone-200 flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded">[{item.type}]</span>
                      <span className="text-stone-700 font-sans">ID: {item.id}</span>
                    </div>
                    <div className="flex items-center gap-4 text-stone-600">
                      <span>Enfileirado: {new Date(item.enqueuedAt).toLocaleTimeString()}</span>
                      <span className="text-amber-700">Tentativas: {item.retryCount}/5</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBMODULE: PERFORMANCE */}
      {currentTab === 'performance' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
              <Gauge className="w-4 h-4 text-blue-600" />
              Métricas de Desempenho por Rota / Endpoint
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-stone-200 text-stone-700 text-[10px] uppercase font-bold">
                    <th className="py-2.5 px-3">Endpoint API</th>
                    <th className="py-2.5 px-3">Método</th>
                    <th className="py-2.5 px-3 text-right">P50</th>
                    <th className="py-2.5 px-3 text-right">P95</th>
                    <th className="py-2.5 px-3 text-right">Throughput</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {[
                    { ep: '/api/discovery/feed', method: 'GET', p50: '18ms', p95: '42ms', rps: '48 req/s' },
                    { ep: '/api/matching/like', method: 'POST', p50: '24ms', p95: '58ms', rps: '112 req/s' },
                    { ep: '/api/trust/report', method: 'POST', p50: '14ms', p95: '29ms', rps: '4 req/s' },
                    { ep: '/api/payments/webhook', method: 'POST', p50: '32ms', p95: '78ms', rps: '15 req/s' }
                  ].map(row => (
                    <tr key={row.ep} className="hover:bg-stone-50">
                      <td className="py-2.5 px-3 font-sans font-bold text-stone-900">{row.ep}</td>
                      <td className="py-2.5 px-3 text-stone-700">{row.method}</td>
                      <td className="py-2.5 px-3 text-right text-emerald-600 font-bold">{row.p50}</td>
                      <td className="py-2.5 px-3 text-right text-stone-800">{row.p95}</td>
                      <td className="py-2.5 px-3 text-right text-stone-700">{row.rps}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
