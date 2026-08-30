import React, { useState } from 'react';
import { ModuleProps } from '../moduleRegistry';
import { AuditService } from '../../../services/admin/auditService';
import { AdminAuditEntry } from '../../../types';
import { FileText, Search, Clock, User, Shield } from 'lucide-react';

export const AuditModule: React.FC<ModuleProps> = () => {
  const auditService = AuditService.getInstance();
  const [search, setSearch] = useState('');
  const [selectedModule, setSelectedModule] = useState<string>('all');

  const logs = auditService.getLogs({
    module: selectedModule === 'all' ? undefined : (selectedModule as AdminAuditEntry['module']),
    searchQuery: search
  });

  return (
    <div className="space-y-6 text-stone-900">
      {/* Header */}
      <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-stone-100 text-stone-700 border border-stone-300">
            Trilha Imutável de Auditoria
          </span>
          <span className="text-xs text-stone-700">Rastreabilidade completa</span>
        </div>
        <h2 className="text-base font-bold text-stone-900 mt-1">Registo de Mutações Administrativas</h2>
        <p className="text-xs text-stone-700 mt-0.5 max-w-xl">
          Todas as alterações de papéis, deliberações de moderação, tarefas e feature flags são persistidas com contexto e justificativa.
        </p>

        {/* Search & Filter Bar */}
        <div className="mt-4 flex flex-col sm:flex-row gap-3 text-xs">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-stone-700" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Pesquisar por ação, responsável ou ID de recurso..."
              className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div className="flex flex-wrap gap-1.5 items-center">
            {['all', 'rbac', 'trust', 'tasks', 'product', 'settings'].map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setSelectedModule(m)}
                className={`px-3 py-1.5 rounded-xl font-medium transition cursor-pointer capitalize ${
                  selectedModule === m
                    ? 'bg-stone-900 text-white'
                    : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                }`}
              >
                {m === 'all' ? 'Todos os Módulos' : m}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Logs Table / List */}
      <div className="bg-white rounded-2xl border border-stone-200 divide-y divide-stone-100 overflow-hidden shadow-2xs text-xs">
        {logs.length === 0 ? (
          <div className="p-8 text-center text-stone-700">
            <FileText className="w-8 h-8 text-stone-300 mx-auto mb-2" />
            <p>Nenhum registo de auditoria encontrado para este filtro.</p>
          </div>
        ) : (
          logs.map(log => (
            <div key={log.id} className="p-4 space-y-2 hover:bg-stone-50/50 transition">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-stone-900 uppercase text-[11px]">
                    {log.action}
                  </span>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 bg-stone-100 text-stone-700 rounded">
                    {log.module}
                  </span>
                  <span className="text-[10px] text-stone-700 font-mono">
                    {log.resourceType}:{log.resourceId}
                  </span>
                </div>

                <div className="flex items-center gap-1 text-[11px] text-stone-700 font-mono">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{log?.timestamp ? new Date(log.timestamp).toLocaleString('pt-PT') : '-'}</span>
                </div>
              </div>

              {log.justification && (
                <p className="text-stone-700 text-[11px]">
                  <strong>Justificativa:</strong> {log.justification}
                </p>
              )}

              <div className="flex items-center justify-between text-[11px] text-stone-700 pt-1">
                <div className="flex items-center gap-1.5">
                  <User className="w-3 h-3 text-stone-700" />
                  <span>{log.actorDisplayName}</span>
                  <span className="text-[10px] px-1.5 py-0.2 bg-rose-50 text-rose-700 rounded font-medium">
                    {log.actorRole}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-stone-700">Ctx: {log.authContext?.clientIp || (log as any).ipOrContext || 'Sessão Segura'}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
