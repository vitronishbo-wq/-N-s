import React, { useState } from 'react';
import { ModuleProps } from '../moduleRegistry';
import { GovernanceService } from '../../../services/admin/governanceService';
import { AuditService } from '../../../services/admin/auditService';
import { RbacService } from '../../../services/admin/rbacService';
import { AdminAuditEvent } from '../../../types';
import {
  ShieldCheck,
  FileText,
  Lock,
  History,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Search,
  Filter,
  Eye,
  Key,
  Shield,
  Download,
  Terminal,
  Activity,
  FileDiff
} from 'lucide-react';

export const GovernanceModule: React.FC<ModuleProps & { activeSubmoduleId?: string }> = ({
  currentAdmin,
  activeSubmoduleId = 'auditoria'
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [moduleFilter, setModuleFilter] = useState('ALL');
  const [selectedLog, setSelectedLog] = useState<AdminAuditEvent | null>(null);

  const govService = GovernanceService.getInstance();
  const auditService = AuditService.getInstance();
  const rbac = RbacService.getInstance();

  const [policies, setPolicies] = useState(govService.getPolicies());
  const logs = auditService.getLogs();

  const canManageGov = rbac.can(currentAdmin, 'governance:manage');

  const currentTab = activeSubmoduleId || 'auditoria';

  const filteredLogs = logs.filter(l => {
    const matchesSearch =
      l.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.actorDisplayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.resourceId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (l.justification && l.justification.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesModule = moduleFilter === 'ALL' || l.module === moduleFilter;

    if (currentTab === 'acessos') {
      return matchesSearch && matchesModule && (l.action.includes('AUTH') || l.action.includes('PIN') || l.action.includes('LOGIN') || l.action.includes('INITIALIZE'));
    }

    if (currentTab === 'alteracoes') {
      return matchesSearch && matchesModule && (l.previousState !== undefined || l.newState !== undefined);
    }

    return matchesSearch && matchesModule;
  });

  const handleTogglePolicy = (policyId: string) => {
    const res = govService.togglePolicyEnforcement(policyId, currentAdmin);
    if (res.success) {
      setPolicies(govService.getPolicies());
    }
  };

  const exportAuditLog = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(logs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `en_control_audit_trail_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-6 text-stone-900">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                GOVERNAÇÃO · Trilha Imutável & Políticas
              </span>
              <span className="text-xs text-stone-700">Auditoria · Acessos · Alterações · Políticas de Administração</span>
            </div>
            <h2 className="text-base font-bold text-stone-900 mt-1">Governança Institucional & Eventos de Auditoria</h2>
            <p className="text-xs text-stone-700 mt-0.5 max-w-xl">
              Registo estruturado de todas as decisões administrativas, mutações de estado e políticas com identidade do operador e contexto de autorização.
            </p>
          </div>

          <button
            type="button"
            onClick={exportAuditLog}
            className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar JSON</span>
          </button>
        </div>
      </div>

      {/* SUBMODULE: AUDITORIA, ACESSOS, ALTERAÇÕES */}
      {(currentTab === 'auditoria' || currentTab === 'acessos' || currentTab === 'alteracoes') && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs space-y-4">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-stone-700 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Pesquisar ação, operador ou justificativa..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:outline-rose-600"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Filter className="w-3.5 h-3.5 text-stone-700" />
                <select
                  value={moduleFilter}
                  onChange={e => setModuleFilter(e.target.value)}
                  className="text-xs bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 font-medium"
                >
                  <option value="ALL">Todos os Módulos</option>
                  <option value="operations">Operações</option>
                  <option value="people">Pessoas</option>
                  <option value="trust">Confiança</option>
                  <option value="product">Produto</option>
                  <option value="discovery">Discovery</option>
                  <option value="growth">Crescimento</option>
                  <option value="tasks">Tarefas</option>
                  <option value="integrations">Integrações</option>
                  <option value="engineering">Engenharia</option>
                  <option value="governance">Governação</option>
                </select>
              </div>
            </div>

            {/* Logs List */}
            {filteredLogs.length === 0 ? (
              <div className="p-8 text-center text-xs text-stone-700">
                Nenhum evento registrado com os filtros atuais.
              </div>
            ) : (
              <div className="space-y-2">
                {filteredLogs.map(log => (
                  <div
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className="p-3.5 rounded-xl bg-stone-50 hover:bg-stone-100 border border-stone-200 transition cursor-pointer text-xs space-y-1.5"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-stone-900 bg-white px-2 py-0.5 rounded border border-stone-200">
                          {log.action}
                        </span>
                        <span className="text-[10px] font-mono uppercase bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded">
                          {log.module}
                        </span>
                      </div>
                      <span className="text-[11px] text-stone-700 font-mono">
                        {new Date(log.timestamp).toLocaleString('pt-PT')}
                      </span>
                    </div>

                    <div className="text-stone-700 flex items-center justify-between pt-1">
                      <span>Operador: <strong className="text-stone-900">{log.actorDisplayName}</strong> ({log.actorRole})</span>
                      <span className="font-mono text-[11px] text-stone-700">ID: {log.resourceId}</span>
                    </div>

                    {log.justification && (
                      <p className="text-[11px] text-stone-700 italic pt-1 border-t border-stone-200/60">
                        "{log.justification}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Modal Log Detail with Diff */}
          {selectedLog && (
            <div className="p-5 rounded-2xl bg-white border border-stone-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                <h3 className="text-xs font-bold text-stone-900 flex items-center gap-2">
                  <FileDiff className="w-4 h-4 text-rose-600" />
                  Detalhes do Evento de Auditoria #{selectedLog.id}
                </h3>
                <button
                  type="button"
                  onClick={() => setSelectedLog(null)}
                  className="text-stone-700 hover:text-stone-900 text-xs font-semibold cursor-pointer"
                >
                  Fechar
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div><strong>Ação:</strong> <span className="font-mono">{selectedLog.action}</span></div>
                <div><strong>Operador:</strong> {selectedLog.actorDisplayName} ({selectedLog.actorEmail})</div>
                <div><strong>Recurso:</strong> {selectedLog.resourceType} ({selectedLog.resourceId})</div>
                <div><strong>Data:</strong> {new Date(selectedLog.timestamp).toLocaleString('pt-PT')}</div>
              </div>

              {selectedLog.previousState || selectedLog.newState ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
                  <div>
                    <span className="font-bold text-stone-700 block mb-1">Estado Anterior (Before)</span>
                    <pre className="p-3 bg-stone-900 text-stone-200 rounded-xl text-[10px] font-mono overflow-x-auto max-h-48">
                      {JSON.stringify(selectedLog.previousState, null, 2) || 'null'}
                    </pre>
                  </div>
                  <div>
                    <span className="font-bold text-stone-700 block mb-1">Novo Estado (After)</span>
                    <pre className="p-3 bg-stone-900 text-stone-200 rounded-xl text-[10px] font-mono overflow-x-auto max-h-48">
                      {JSON.stringify(selectedLog.newState, null, 2) || 'null'}
                    </pre>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}

      {/* SUBMODULE: POLÍTICAS DE ADMINISTRAÇÃO */}
      {currentTab === 'politicas_admin' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Políticas de Segurança e Acesso Administrativo
            </h3>

            <div className="space-y-3">
              {policies.map(pol => (
                <div key={pol.id} className="p-4 rounded-xl bg-stone-50 border border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-stone-900">{pol.name}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        pol.enforced ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200 text-stone-700'
                      }`}>
                        {pol.enforced ? 'Ativa & Obrigatória' : 'Inativa'}
                      </span>
                    </div>
                    <p className="text-stone-700 mt-1">{pol.description}</p>
                    <span className="text-[10px] text-stone-700 mt-1 block">
                      Aplicável a: {pol.appliedToRoles.join(', ')}
                    </span>
                  </div>

                  {canManageGov && (
                    <button
                      type="button"
                      onClick={() => handleTogglePolicy(pol.id)}
                      className="px-3 py-1.5 bg-white border border-stone-200 hover:bg-stone-100 rounded-lg font-semibold text-stone-700 cursor-pointer self-start sm:self-auto"
                    >
                      {pol.enforced ? 'Desativar Política' : 'Ativar Política'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
