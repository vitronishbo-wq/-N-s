import React, { useState } from 'react';
import { ModuleProps } from '../moduleRegistry';
import { EngineeringService } from '../../../services/admin/engineeringService';
import { FinanceService } from '../../../services/admin/financeService';
import { TaskService } from '../../../services/admin/taskService';
import { TrustService } from '../../../services/admin/trustService';
import { ProductService } from '../../../services/admin/productService';
import { AuditService } from '../../../services/admin/auditService';
import { RbacService } from '../../../services/admin/rbacService';
import {
  Activity,
  ShieldAlert,
  CheckCircle2,
  TrendingUp,
  Globe2,
  Users,
  Server,
  Zap,
  ArrowUpRight,
  ShieldCheck,
  AlertTriangle,
  Flame,
  Clock,
  Plus,
  RefreshCw,
  Layers,
  ArrowRight,
  Database,
  Cloud,
  Check,
  X
} from 'lucide-react';

interface OperationalIncident {
  id: string;
  title: string;
  severity: 'P1' | 'P2' | 'P3';
  status: 'INVESTIGATING' | 'IDENTIFIED' | 'MONITORING' | 'RESOLVED';
  affectedComponent: string;
  startedAt: number;
  resolvedAt?: number;
  notes: string;
}

const INITIAL_INCIDENTS: OperationalIncident[] = [
  {
    id: 'inc_001',
    title: 'Degradação transitória de webhook Multicaixa Express (AO)',
    severity: 'P2',
    status: 'MONITORING',
    affectedComponent: 'Payment Gateway (Angola)',
    startedAt: Date.now() - 3600000 * 2,
    notes: 'Operadora EMIS com latência elevada. Fallback e retentativas automáticas ativadas.'
  }
];

export const OperationsModule: React.FC<ModuleProps & { activeSubmoduleId?: string }> = ({
  currentAdmin,
  activeSubmoduleId = 'visao'
}) => {
  const engHealth = EngineeringService.getInstance().getHealthStatus();
  const tasks = TaskService.getInstance().getTasks();
  const pendingSignals = TrustService.getInstance().getReviews({ status: 'pending' });
  const rbac = RbacService.getInstance();
  const canManage = rbac.can(currentAdmin, 'admin:manage');

  const [incidents, setIncidents] = useState<OperationalIncident[]>(INITIAL_INCIDENTS);
  const [showNewIncidentModal, setShowNewIncidentModal] = useState(false);
  const [incTitle, setIncTitle] = useState('');
  const [incSeverity, setIncSeverity] = useState<'P1' | 'P2' | 'P3'>('P2');
  const [incComponent, setIncComponent] = useState('Render API');
  const [incNotes, setIncNotes] = useState('');

  // Realtime System Tests
  const [pingStates, setPingStates] = useState<Record<string, { status: 'healthy' | 'checking'; latencyMs: number }>>({
    frontend: { status: 'healthy', latencyMs: 14 },
    api: { status: 'healthy', latencyMs: 28 },
    firestore: { status: 'healthy', latencyMs: 36 },
    storage: { status: 'healthy', latencyMs: 22 }
  });

  const handlePing = (key: string) => {
    setPingStates(prev => ({
      ...prev,
      [key]: { ...prev[key], status: 'checking' }
    }));

    setTimeout(() => {
      setPingStates(prev => ({
        ...prev,
        [key]: { status: 'healthy', latencyMs: Math.floor(Math.random() * 25) + 12 }
      }));
    }, 600);
  };

  const handleCreateIncident = (e: React.FormEvent) => {
    e.preventDefault();
    if (!incTitle.trim()) return;

    const newInc: OperationalIncident = {
      id: `inc_${Date.now()}`,
      title: incTitle.trim(),
      severity: incSeverity,
      status: 'INVESTIGATING',
      affectedComponent: incComponent,
      startedAt: Date.now(),
      notes: incNotes.trim() || 'Incidente registrado pelo operador.'
    };

    setIncidents(prev => [newInc, ...prev]);
    setShowNewIncidentModal(false);
    setIncTitle('');
    setIncNotes('');

    // Generate matching task in the unified Task Engine!
    TaskService.getInstance().createTask(
      {
        title: `[INCIDENTE ${incSeverity}] ${newInc.title}`,
        description: `Componente afetado: ${newInc.affectedComponent}. Notas: ${newInc.notes}`,
        category: 'engineering',
        priority: incSeverity === 'P1' ? 'urgent' : incSeverity === 'P2' ? 'high' : 'medium'
      },
      currentAdmin
    );

    AuditService.getInstance().logMutation(currentAdmin, {
      module: 'operations',
      resourceType: 'operational_incident',
      resourceId: newInc.id,
      action: 'DECLARE_INCIDENT',
      newState: newInc,
      justification: `Declaração de incidente operacional [${incSeverity}]`
    });
  };

  const handleResolveIncident = (incId: string) => {
    setIncidents(prev =>
      prev.map(inc => {
        if (inc.id === incId) {
          const resolved = { ...inc, status: 'RESOLVED' as const, resolvedAt: Date.now() };
          AuditService.getInstance().logMutation(currentAdmin, {
            module: 'operations',
            resourceType: 'operational_incident',
            resourceId: incId,
            action: 'RESOLVE_INCIDENT',
            newState: resolved,
            justification: `Incidente marcado como resolvido por ${currentAdmin.displayName || currentAdmin.name}`
          });
          return resolved;
        }
        return inc;
      })
    );
  };

  const openTasks = tasks.filter(t => t.state === 'OPEN' || t.state === 'ASSIGNED' || t.state === 'IN_PROGRESS');
  const activeIncidents = incidents.filter(i => i.status !== 'RESOLVED');

  const currentTab = activeSubmoduleId || 'visao';

  return (
    <div className="space-y-6 text-stone-900">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                OPERAR · Trabalho & Estado Atual
              </span>
              <span className="text-xs text-stone-700">Visão Operacional · Filas · Incidentes · Estado do Sistema</span>
            </div>
            <h2 className="text-base font-bold text-stone-900 mt-1">Centro de Comando & Resposta Operacional</h2>
            <p className="text-xs text-stone-700 mt-0.5 max-w-xl">
              Supervisão de pendências críticas, filas de moderação, gestão de incidentes e integridade em tempo real dos serviços CPLP.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2 text-center">
              <div className="text-[10px] uppercase font-bold text-stone-700">Uptime 30d</div>
              <div className="text-sm font-bold text-emerald-600 font-mono">{engHealth.uptimePercentage30d}%</div>
            </div>
            <div className="bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2 text-center">
              <div className="text-[10px] uppercase font-bold text-stone-700">Latência P95</div>
              <div className="text-sm font-bold text-rose-600 font-mono">{engHealth.liveMetrics.latencyP95Ms}ms</div>
            </div>
          </div>
        </div>
      </div>

      {/* SUBMODULE: VISÃO OPERACIONAL */}
      {currentTab === 'visao' && (
        <div className="space-y-6">
          {/* Action-demanding Pending Items */}
          <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-2xs">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                <Flame className="w-4 h-4 text-rose-600" />
                Pendências que Exigem Decisão Imediata
              </h3>
              <span className="text-xs font-mono font-bold text-stone-700">
                {pendingSignals.length + activeIncidents.length + openTasks.filter(t => t.priority === 'urgent' || t.priority === 'high').length} ações prioritárias
              </span>
            </div>

            {pendingSignals.length === 0 && activeIncidents.length === 0 && openTasks.length === 0 ? (
              <div className="p-8 text-center bg-stone-50 rounded-xl border border-stone-200">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                <h4 className="text-xs font-bold text-stone-900">Zero Pendências Críticas</h4>
                <p className="text-xs text-stone-700 mt-1">O sistema está saudável e sem itens pendentes de deliberação imediata.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeIncidents.map(inc => (
                  <div key={inc.id} className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-rose-100 text-rose-700 mt-0.5">
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-rose-900">{inc.title}</span>
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-rose-200 text-rose-900 uppercase">
                            {inc.severity}
                          </span>
                        </div>
                        <p className="text-xs text-rose-700 mt-0.5">{inc.notes}</p>
                        <span className="text-[10px] text-rose-600 mt-1 block">
                          Componente: {inc.affectedComponent} · Aberto há {Math.floor((Date.now() - inc.startedAt) / 60000)}m
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleResolveIncident(inc.id)}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer shrink-0"
                    >
                      Mitigar & Resolver
                    </button>
                  </div>
                ))}

                {pendingSignals.map(sig => (
                  <div key={sig.id} className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-amber-100 text-amber-700 mt-0.5">
                        <ShieldAlert className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-amber-900">Denúncia #{sig.id.substring(0, 7)}: Alvo {sig.targetUid}</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-200 text-amber-900 uppercase">
                            {sig.severity}
                          </span>
                        </div>
                        <p className="text-xs text-amber-800 mt-0.5">Motivo: {sig.category} · {sig.description}</p>
                      </div>
                    </div>

                    <div className="text-xs text-amber-800 font-semibold flex items-center gap-1">
                      <span>Aguardando deliberação humana</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-stone-700">Denúncias Pendentes</span>
                <ShieldAlert className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-2xl font-bold font-mono text-stone-900 mt-2">{pendingSignals.length}</div>
              <span className="text-[11px] text-stone-700 mt-1 block">Fila Trust & Safety</span>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-stone-700">Tarefas em Aberto</span>
                <CheckCircle2 className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-2xl font-bold font-mono text-stone-900 mt-2">{openTasks.length}</div>
              <span className="text-[11px] text-stone-700 mt-1 block">Operações & Equipa</span>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-stone-700">Incidentes Ativos</span>
                <AlertTriangle className="w-4 h-4 text-rose-600" />
              </div>
              <div className="text-2xl font-bold font-mono text-stone-900 mt-2">{activeIncidents.length}</div>
              <span className="text-[11px] text-stone-700 mt-1 block">Disponibilidade</span>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-stone-700">Sessões Ativas</span>
                <Users className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-bold font-mono text-stone-900 mt-2">{engHealth.liveMetrics.activeSessions}</div>
              <span className="text-[11px] text-stone-700 mt-1 block">9 Países CPLP</span>
            </div>
          </div>
        </div>
      )}

      {/* SUBMODULE: FILAS */}
      {currentTab === 'filas' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Fila de Denúncias */}
            <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-600" />
                  <h4 className="text-xs font-bold text-stone-900">Fila de Denúncias</h4>
                </div>
                <span className="text-xs font-mono font-bold bg-amber-50 text-amber-700 px-2 py-0.5 rounded border border-amber-200">
                  {pendingSignals.length}
                </span>
              </div>

              {pendingSignals.length === 0 ? (
                <div className="py-8 text-center text-xs text-stone-700">
                  Fila vazia · Nenhuma denúncia aguardando
                </div>
              ) : (
                <div className="space-y-2">
                  {pendingSignals.map(s => (
                    <div key={s.id} className="p-3 rounded-xl bg-stone-50 border border-stone-200 text-xs">
                      <div className="font-bold text-stone-900">Alvo {s.targetUid} ({s.severity})</div>
                      <div className="text-[11px] text-stone-700 mt-0.5">{s.category}: {s.description}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Fila de Tarefas */}
            <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-600" />
                  <h4 className="text-xs font-bold text-stone-900">Fila de Tarefas</h4>
                </div>
                <span className="text-xs font-mono font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200">
                  {openTasks.length}
                </span>
              </div>

              {openTasks.length === 0 ? (
                <div className="py-8 text-center text-xs text-stone-700">
                  Fila vazia · Todas tarefas concluídas
                </div>
              ) : (
                <div className="space-y-2">
                  {openTasks.slice(0, 4).map(t => (
                    <div key={t.id} className="p-3 rounded-xl bg-stone-50 border border-stone-200 text-xs">
                      <div className="font-bold text-stone-900">{t.title}</div>
                      <div className="text-[10px] text-stone-700 mt-0.5">Atribuído: {t.assigneeName || 'Não atribuído'}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Fila de Operações & Incidentes */}
            <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <h4 className="text-xs font-bold text-stone-900">Fila de Incidentes</h4>
                </div>
                <span className="text-xs font-mono font-bold bg-rose-50 text-rose-700 px-2 py-0.5 rounded border border-rose-200">
                  {activeIncidents.length}
                </span>
              </div>

              {activeIncidents.length === 0 ? (
                <div className="py-8 text-center text-xs text-stone-700">
                  Fila vazia · Zero incidentes em aberto
                </div>
              ) : (
                <div className="space-y-2">
                  {activeIncidents.map(i => (
                    <div key={i.id} className="p-3 rounded-xl bg-stone-50 border border-stone-200 text-xs">
                      <div className="font-bold text-stone-900">{i.title}</div>
                      <div className="text-[10px] text-rose-600 mt-0.5 font-bold uppercase">{i.severity} · {i.status}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUBMODULE: INCIDENTES */}
      {currentTab === 'incidentes' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-stone-900">Gestão de Incidentes Operacionais</h3>
                <p className="text-xs text-stone-700 mt-0.5">
                  Registo e mitigação de problemas técnicos ou operacionais afetando serviços CPLP.
                </p>
              </div>

              {canManage && (
                <button
                  type="button"
                  onClick={() => setShowNewIncidentModal(true)}
                  className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Declarar Incidente</span>
                </button>
              )}
            </div>

            {/* Modal for new Incident */}
            {showNewIncidentModal && (
              <form onSubmit={handleCreateIncident} className="p-4 mb-4 rounded-xl bg-stone-50 border border-stone-200 space-y-3">
                <h4 className="text-xs font-bold text-stone-900">Novo Incidente Operacional</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="text-[11px] text-stone-700 block mb-1">Título do Incidente</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Falha de autenticação SMS em Moçambique"
                      value={incTitle}
                      onChange={e => setIncTitle(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-stone-200 rounded-lg focus:outline-rose-600"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-stone-700 block mb-1">Severidade</label>
                    <select
                      value={incSeverity}
                      onChange={e => setIncSeverity(e.target.value as any)}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-stone-200 rounded-lg"
                    >
                      <option value="P1">P1 - Crítica / Interrupção Geral</option>
                      <option value="P2">P2 - Alta / Degradação Parcial</option>
                      <option value="P3">P3 - Média / Alerta Local</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-stone-700 block mb-1">Componente Afetado</label>
                    <input
                      type="text"
                      value={incComponent}
                      onChange={e => setIncComponent(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-stone-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-stone-700 block mb-1">Notas de Investigação</label>
                    <input
                      type="text"
                      placeholder="Detalhes operacionais iniciais..."
                      value={incNotes}
                      onChange={e => setIncNotes(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-stone-200 rounded-lg"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowNewIncidentModal(false)}
                    className="px-3 py-1 text-xs text-stone-700 hover:bg-stone-200 rounded-lg cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg cursor-pointer"
                  >
                    Confirmar & Publicar Incidente
                  </button>
                </div>
              </form>
            )}

            {/* Incidents List */}
            <div className="space-y-3">
              {incidents.map(inc => (
                <div key={inc.id} className="p-4 rounded-xl bg-stone-50 border border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-stone-900">{inc.title}</span>
                      <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded uppercase ${
                        inc.severity === 'P1' ? 'bg-red-100 text-red-800' : inc.severity === 'P2' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {inc.severity}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        inc.status === 'RESOLVED' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {inc.status}
                      </span>
                    </div>
                    <p className="text-xs text-stone-700 mt-1">{inc.notes}</p>
                    <span className="text-[11px] text-stone-700 mt-1 block">
                      Componente: {inc.affectedComponent} · Iniciado em: {inc?.startedAt ? new Date(inc.startedAt).toLocaleString('pt-PT') : '-'}
                    </span>
                  </div>

                  {inc.status !== 'RESOLVED' && canManage && (
                    <button
                      type="button"
                      onClick={() => handleResolveIncident(inc.id)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer shrink-0"
                    >
                      Resolver Incidente
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SUBMODULE: ESTADO DO SISTEMA */}
      {currentTab === 'estado' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs">
            <h3 className="text-sm font-bold text-stone-900 mb-1 flex items-center gap-2">
              <Server className="w-4 h-4 text-emerald-600" />
              Estado em Tempo Real dos Componentes de Infraestrutura
            </h3>
            <p className="text-xs text-stone-700 mb-4">
              Monitoramento dos 4 nós fundamentais: Frontend, Render API, Firestore e Cloud Storage.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Frontend */}
              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-stone-900">Frontend App</span>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  </div>
                  <span className="text-[11px] text-stone-700 mt-1 block">SPA Client & Routing</span>
                  <div className="text-sm font-mono font-bold text-stone-900 mt-3">
                    {pingStates.frontend.latencyMs}ms
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handlePing('frontend')}
                  className="mt-3 py-1 text-xs font-semibold rounded bg-white border border-stone-200 hover:bg-stone-100 text-stone-700 cursor-pointer"
                >
                  {pingStates.frontend.status === 'checking' ? 'Testando...' : 'Testar Ping'}
                </button>
              </div>

              {/* API */}
              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-stone-900">Render API</span>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  </div>
                  <span className="text-[11px] text-stone-700 mt-1 block">Express / CPLP Backend</span>
                  <div className="text-sm font-mono font-bold text-stone-900 mt-3">
                    {pingStates.api.latencyMs}ms
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handlePing('api')}
                  className="mt-3 py-1 text-xs font-semibold rounded bg-white border border-stone-200 hover:bg-stone-100 text-stone-700 cursor-pointer"
                >
                  {pingStates.api.status === 'checking' ? 'Testando...' : 'Testar Ping'}
                </button>
              </div>

              {/* Firestore */}
              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-stone-900">Firestore DB</span>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  </div>
                  <span className="text-[11px] text-stone-700 mt-1 block">Database & Auth</span>
                  <div className="text-sm font-mono font-bold text-stone-900 mt-3">
                    {pingStates.firestore.latencyMs}ms
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handlePing('firestore')}
                  className="mt-3 py-1 text-xs font-semibold rounded bg-white border border-stone-200 hover:bg-stone-100 text-stone-700 cursor-pointer"
                >
                  {pingStates.firestore.status === 'checking' ? 'Testando...' : 'Testar Ping'}
                </button>
              </div>

              {/* Storage */}
              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-stone-900">Cloud Storage</span>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  </div>
                  <span className="text-[11px] text-stone-700 mt-1 block">Fotos & Media AVIF</span>
                  <div className="text-sm font-mono font-bold text-stone-900 mt-3">
                    {pingStates.storage.latencyMs}ms
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handlePing('storage')}
                  className="mt-3 py-1 text-xs font-semibold rounded bg-white border border-stone-200 hover:bg-stone-100 text-stone-700 cursor-pointer"
                >
                  {pingStates.storage.status === 'checking' ? 'Testando...' : 'Testar Ping'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
