import React, { useState } from 'react';
import { ModuleProps } from '../moduleRegistry';
import { TaskService } from '../../../services/admin/taskService';
import { RbacService } from '../../../services/admin/rbacService';
import { AdminTask, AdminTaskState } from '../../../types';
import { Plus, CheckSquare, ArrowRight, Clock, AlertCircle } from 'lucide-react';

const STATE_COLUMNS: { state: AdminTaskState; label: string; badgeColor: string }[] = [
  { state: 'OPEN', label: 'Aberto', badgeColor: 'bg-stone-100 text-stone-700' },
  { state: 'ASSIGNED', label: 'Atribuído', badgeColor: 'bg-blue-100 text-blue-800' },
  { state: 'IN_PROGRESS', label: 'Em Execução', badgeColor: 'bg-amber-100 text-amber-800' },
  { state: 'RESOLVED', label: 'Resolvido', badgeColor: 'bg-purple-100 text-purple-800' },
  { state: 'CLOSED', label: 'Concluído / Fechado', badgeColor: 'bg-emerald-100 text-emerald-800' }
];

export const TasksModule: React.FC<ModuleProps> = ({ currentAdmin }) => {
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

  return (
    <div className="space-y-6 text-stone-900">
      {/* Header */}
      <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              Ciclo de Vida de Tarefas
            </span>
            <span className="text-xs text-stone-700 font-mono">
              OPEN → ASSIGNED → IN_PROGRESS → RESOLVED → CLOSED
            </span>
          </div>
          <h2 className="text-base font-bold text-stone-900 mt-1">Gestão Operacional de Tarefas</h2>
          <p className="text-xs text-stone-700 mt-0.5 max-w-xl">
            Fluxo de trabalho com validação de estado e regras formais de transição.
          </p>
        </div>

        {canCreate && (
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="px-3.5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold flex items-center gap-2 transition shadow-xs self-start sm:self-auto cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Tarefa</span>
          </button>
        )}
      </div>

      {/* State Columns / Kanban View */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        {STATE_COLUMNS.map(col => {
          const colTasks = tasks.filter(t => t.state === col.state);
          return (
            <div key={col.state} className="bg-stone-100/70 rounded-2xl p-3 border border-stone-200/80 space-y-3">
              <div className="flex items-center justify-between px-1">
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${col.badgeColor}`}>
                  {col.label}
                </span>
                <span className="text-xs font-bold text-stone-700">{colTasks.length}</span>
              </div>

              <div className="space-y-2">
                {colTasks.length === 0 ? (
                  <p className="text-[11px] text-stone-700 text-center py-4 italic">Vazio</p>
                ) : (
                  colTasks.map(task => (
                    <div
                      key={task.id}
                      className="bg-white rounded-xl p-3 border border-stone-200 shadow-2xs text-xs space-y-2"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                            task.priority === 'urgent'
                              ? 'bg-rose-100 text-rose-800'
                              : task.priority === 'high'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-stone-100 text-stone-700'
                          }`}
                        >
                          {task.priority}
                        </span>
                        <span className="text-[10px] font-mono text-stone-700 capitalize">{task.category}</span>
                      </div>

                      <h4 className="font-bold text-stone-900 leading-snug">{task.title}</h4>
                      {task.description && (
                        <p className="text-[11px] text-stone-700 line-clamp-2">{task.description}</p>
                      )}

                      {task.assigneeName && (
                        <p className="text-[10px] text-stone-700">
                          Resp: <strong className="text-stone-700">{task.assigneeName}</strong>
                        </p>
                      )}

                      {/* State Transition Action Buttons */}
                      {canTransition && (
                        <div className="pt-2 border-t border-stone-100 flex flex-wrap gap-1">
                          {col.state === 'OPEN' && (
                            <button
                              type="button"
                              onClick={() => handleTransition(task.id, 'ASSIGNED')}
                              className="w-full py-1 text-[10px] bg-blue-50 hover:bg-blue-100 text-blue-700 rounded font-medium transition cursor-pointer"
                            >
                              Atribuir →
                            </button>
                          )}
                          {col.state === 'ASSIGNED' && (
                            <button
                              type="button"
                              onClick={() => handleTransition(task.id, 'IN_PROGRESS')}
                              className="w-full py-1 text-[10px] bg-amber-50 hover:bg-amber-100 text-amber-800 rounded font-medium transition cursor-pointer"
                            >
                              Iniciar Execução →
                            </button>
                          )}
                          {col.state === 'IN_PROGRESS' && (
                            <button
                              type="button"
                              onClick={() => handleTransition(task.id, 'RESOLVED')}
                              className="w-full py-1 text-[10px] bg-purple-50 hover:bg-purple-100 text-purple-800 rounded font-medium transition cursor-pointer"
                            >
                              Resolver Tarefa →
                            </button>
                          )}
                          {col.state === 'RESOLVED' && (
                            <button
                              type="button"
                              onClick={() => handleTransition(task.id, 'CLOSED')}
                              className="w-full py-1 text-[10px] bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded font-medium transition cursor-pointer"
                            >
                              Fechar / Concluir ✓
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Creation Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-stone-200 p-5 max-w-sm w-full shadow-2xl">
            <h3 className="text-sm font-bold text-stone-900 mb-1">Nova Tarefa Operacional</h3>
            <p className="text-xs text-stone-700 mb-4">
              Tarefas são iniciadas com estado formal <span className="font-bold font-mono">OPEN</span>.
            </p>

            <form onSubmit={handleCreate} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-stone-700 mb-1">Título da Tarefa</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Ex: Auditar contas com mais de 3 reportes"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block font-medium text-stone-700 mb-1">Descrição</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Detalhes operacionais..."
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Categoria</label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value as AdminTask['category'])}
                    className="w-full px-2.5 py-2 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                  >
                    <option value="trust">Trust & Moderação</option>
                    <option value="engineering">Engenharia</option>
                    <option value="product">Produto</option>
                    <option value="finance">Finanças</option>
                    <option value="governance">Governança</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-stone-700 mb-1">Prioridade</label>
                  <select
                    value={priority}
                    onChange={e => setPriority(e.target.value as AdminTask['priority'])}
                    className="w-full px-2.5 py-2 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                  >
                    <option value="low">Baixa</option>
                    <option value="medium">Média</option>
                    <option value="high">Alta</option>
                    <option value="urgent">Urgente</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3.5 py-2 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-50 font-medium cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-semibold shadow-xs cursor-pointer"
                >
                  Criar Tarefa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
