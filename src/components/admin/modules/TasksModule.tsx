import React, { useState } from 'react';
import { ModuleProps } from '../moduleRegistry';
import { TaskService } from '../../../services/admin/taskService';
import { RbacService } from '../../../services/admin/rbacService';
import { AdminTask, AdminTaskState } from '../../../types';
import {
  Plus,
  CheckSquare,
  ArrowRight,
  Clock,
  AlertCircle,
  CheckCircle2,
  Users,
  Layers,
  Archive,
  UserCheck
} from 'lucide-react';

const STATE_COLUMNS: { state: AdminTaskState; label: string; badgeColor: string }[] = [
  { state: 'OPEN', label: 'Aberto', badgeColor: 'bg-stone-100 text-stone-700' },
  { state: 'ASSIGNED', label: 'Atribuído', badgeColor: 'bg-blue-100 text-blue-800' },
  { state: 'IN_PROGRESS', label: 'Em Execução', badgeColor: 'bg-amber-100 text-amber-800' },
  { state: 'RESOLVED', label: 'Resolvido', badgeColor: 'bg-purple-100 text-purple-800' },
  { state: 'CLOSED', label: 'Concluído / Fechado', badgeColor: 'bg-emerald-100 text-emerald-800' }
];

export const TasksModule: React.FC<ModuleProps & { activeSubmoduleId?: string }> = ({
  currentAdmin,
  activeSubmoduleId = 'minhas'
}) => {
  const taskService = TaskService.getInstance();
  const rbac = RbacService.getInstance();

  const [tasks, setTasks] = useState<AdminTask[]>(() => taskService.getTasks());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<AdminTask['category']>('trust');
  const [priority, setPriority] = useState<AdminTask['priority']>('medium');

  const canCreate = rbac.can(currentAdmin, 'tasks:create');
  const canTransition = rbac.can(currentAdmin, 'tasks:transition');

  const reload = () => setTasks(taskService.getTasks());

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const res = taskService.createTask(
      {
        title,
        description,
        category,
        priority
      },
      currentAdmin
    );

    if (res.success) {
      setTitle('');
      setDescription('');
      setShowCreateModal(false);
      reload();
    } else {
      alert(res.error || 'Erro ao criar tarefa');
    }
  };

  const handleTransition = (taskId: string, targetState: AdminTaskState) => {
    const res = taskService.transitionState(taskId, targetState, currentAdmin);
    if (res.success) {
      reload();
    } else {
      alert(res.error);
    }
  };

  const handleAssignToSelf = (taskId: string) => {
    const res = taskService.transitionState(taskId, 'ASSIGNED', currentAdmin, {
      assigneeId: currentAdmin.id,
      assigneeName: currentAdmin.displayName || currentAdmin.name || currentAdmin.email
    });
    if (res.success) {
      reload();
    } else {
      alert(res.error);
    }
  };

  const currentTab = activeSubmoduleId || 'minhas';

  // Submodule filtering
  const myTasks = tasks.filter(
    t => (t.assigneeId === currentAdmin.id || (!t.assigneeId && currentAdmin.role === 'founder')) && t.state !== 'CLOSED'
  );
  const teamTasks = tasks.filter(t => t.state !== 'CLOSED');
  const resolvedTasks = tasks.filter(t => t.state === 'RESOLVED' || t.state === 'CLOSED');

  return (
    <div className="space-y-6 text-stone-900">
      {/* Header */}
      <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              TAREFAS · Execução Operacional
            </span>
            <span className="text-xs text-stone-700 font-mono">
              Minhas · Equipa · Filas · Histórico
            </span>
          </div>
          <h2 className="text-base font-bold text-stone-900 mt-1">Gestão de Tarefas & Ciclo Operacional</h2>
          <p className="text-xs text-stone-700 mt-0.5 max-w-xl">
            Rastreamento de pendências com validação de estados (OPEN → ASSIGNED → IN_PROGRESS → RESOLVED → CLOSED).
          </p>
        </div>

        {canCreate && (
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold flex items-center gap-2 transition shadow-xs self-start sm:self-auto cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Tarefa</span>
          </button>
        )}
      </div>

      {/* Modal Nova Tarefa */}
      {showCreateModal && (
        <form onSubmit={handleCreate} className="p-5 rounded-2xl bg-white border border-stone-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <h3 className="text-xs font-bold text-stone-900">Criar Nova Tarefa Operacional</h3>
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="text-stone-700 hover:text-stone-900 text-xs font-semibold cursor-pointer"
            >
              Cancelar
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-stone-700 block mb-1">Título da Tarefa</label>
              <input
                type="text"
                required
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Ex: Auditar novo gateway EMIS Luanda"
                className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-stone-700 block mb-1">Categoria</label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl"
                >
                  <option value="trust">Trust & Safety</option>
                  <option value="engineering">Engineering</option>
                  <option value="growth">Growth</option>
                  <option value="finance">Finance</option>
                  <option value="operations">Operations</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] text-stone-700 block mb-1">Prioridade</label>
                <select
                  value={priority}
                  onChange={e => setPriority(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl"
                >
                  <option value="low">Baixa</option>
                  <option value="medium">Média</option>
                  <option value="high">Alta</option>
                  <option value="urgent">Urgente</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="text-[11px] text-stone-700 block mb-1">Descrição</label>
            <textarea
              rows={2}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Instruções operacionais..."
              className="w-full p-3 text-xs bg-stone-50 border border-stone-200 rounded-xl"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="submit"
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl cursor-pointer"
            >
              Criar Tarefa
            </button>
          </div>
        </form>
      )}

      {/* SUBMODULE: MINHAS */}
      {currentTab === 'minhas' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-stone-900">Minhas Tarefas Atribuídas</h3>

            {myTasks.length === 0 ? (
              <div className="p-8 text-center text-xs text-stone-700">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                <p className="font-bold text-stone-900">Sem tarefas atribuídas diretamente a si</p>
                <p className="mt-0.5">Assuma tarefas abertas na aba "Equipa" ou aguarde novas delegações.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {myTasks.map(t => (
                  <div key={t.id} className="p-4 rounded-xl bg-stone-50 border border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-stone-900">{t.title}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          t.priority === 'urgent' ? 'bg-red-100 text-red-800' : 'bg-stone-200 text-stone-700'
                        }`}>
                          {t.priority}
                        </span>
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 uppercase">
                          {t.state}
                        </span>
                      </div>
                      <p className="text-stone-700 mt-1">{t.description}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      {t.state === 'ASSIGNED' && (
                        <button
                          type="button"
                          onClick={() => handleTransition(t.id, 'IN_PROGRESS')}
                          className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-semibold cursor-pointer"
                        >
                          Iniciar Execução
                        </button>
                      )}
                      {t.state === 'IN_PROGRESS' && (
                        <button
                          type="button"
                          onClick={() => handleTransition(t.id, 'RESOLVED')}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold cursor-pointer"
                        >
                          Marcar Resolvido
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBMODULE: EQUIPA */}
      {currentTab === 'equipa' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {STATE_COLUMNS.map(col => {
              const colTasks = tasks.filter(t => t.state === col.state);
              return (
                <div key={col.state} className="bg-white rounded-2xl p-4 border border-stone-200 shadow-2xs flex flex-col min-h-[350px]">
                  <div className="flex items-center justify-between border-b border-stone-100 pb-2 mb-3">
                    <span className="text-xs font-bold text-stone-800">{col.label}</span>
                    <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-full ${col.badgeColor}`}>
                      {colTasks.length}
                    </span>
                  </div>

                  <div className="space-y-2.5 flex-1">
                    {colTasks.map(t => (
                      <div key={t.id} className="p-3 rounded-xl bg-stone-50 border border-stone-200 text-xs space-y-2">
                        <div className="font-bold text-stone-900 leading-tight">{t.title}</div>
                        <div className="text-[11px] text-stone-700 line-clamp-2">{t.description}</div>
                        <div className="pt-2 border-t border-stone-200/80 flex items-center justify-between text-[10px] text-stone-700">
                          <span>{t.assigneeName || 'Não atribuído'}</span>
                          {!t.assigneeId && (
                            <button
                              type="button"
                              onClick={() => handleAssignToSelf(t.id)}
                              className="font-bold text-rose-600 hover:underline cursor-pointer"
                            >
                              Assumir
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUBMODULE: FILAS */}
      {currentTab === 'filas' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-rose-600" />
              Filas de Tarefas por Categoria Funcional
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {(['trust', 'engineering', 'growth', 'finance', 'operations'] as const).map(cat => {
                const catTasks = tasks.filter(t => t.category === cat && t.state !== 'CLOSED');
                return (
                  <div key={cat} className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-stone-900 uppercase font-mono">{cat}</span>
                      <span className="text-[10px] font-mono bg-white px-2 py-0.5 rounded border border-stone-200">
                        {catTasks.length} abertas
                      </span>
                    </div>
                    <div className="space-y-1 pt-1">
                      {catTasks.slice(0, 3).map(t => (
                        <div key={t.id} className="text-[11px] text-stone-700 truncate">
                          • {t.title}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SUBMODULE: HISTÓRICO */}
      {currentTab === 'historico' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
              <Archive className="w-4 h-4 text-stone-700" />
              Histórico de Tarefas Concluídas / Resolvidas
            </h3>

            {resolvedTasks.length === 0 ? (
              <div className="p-8 text-center text-xs text-stone-700">Nenhuma tarefa resolvida no histórico.</div>
            ) : (
              <div className="space-y-2">
                {resolvedTasks.map(t => (
                  <div key={t.id} className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-stone-900">{t.title}</span>
                      <span className="text-[11px] text-stone-700 block mt-0.5">
                        Resolvido por: {t.assigneeName || 'Equipa'} · Categoria: {t.category}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 uppercase">
                      {t.state}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
