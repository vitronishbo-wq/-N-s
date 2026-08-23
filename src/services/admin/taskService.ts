import { AdminTask, AdminTaskState, AdminUser } from '../../types';
import { AuditService } from './auditService';
import { RbacService } from './rbacService';

const TASKS_STORAGE_KEY = 'en_admin_tasks_v1';

// Valid transitions state graph
const VALID_TRANSITIONS: Record<AdminTaskState, AdminTaskState[]> = {
  OPEN: ['ASSIGNED', 'CLOSED'],
  ASSIGNED: ['IN_PROGRESS', 'OPEN'],
  IN_PROGRESS: ['RESOLVED', 'ASSIGNED'],
  RESOLVED: ['CLOSED', 'IN_PROGRESS'],
  CLOSED: ['OPEN'] // Re-opening closed task (requires special privilege)
};

export class TaskService {
  private static instance: TaskService;
  private tasks: AdminTask[] = [];

  private constructor() {
    this.bootstrapTasks();
  }

  public static getInstance(): TaskService {
    if (!TaskService.instance) {
      TaskService.instance = new TaskService();
    }
    return TaskService.instance;
  }

  private bootstrapTasks(): void {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(TASKS_STORAGE_KEY);
        if (stored) {
          this.tasks = JSON.parse(stored);
          return;
        }
      } catch {}
    }

    this.tasks = [
      {
        id: 'task_001',
        title: 'Revisar moderação em lote para denúncias de Luanda e Lisboa',
        description: 'Auditar fila de 12 contas reportadas na última janela de 24h.',
        category: 'trust',
        priority: 'high',
        state: 'IN_PROGRESS',
        assigneeId: 'admin_mod_1',
        assigneeName: 'Moderador CPLP',
        createdBy: 'admin_founder',
        createdByName: 'Sila Marco',
        createdAt: Date.now() - 86400000,
        updatedAt: Date.now() - 3600000
      },
      {
        id: 'task_002',
        title: 'Validação de contrato de SMS OTP para São Tomé e Timor-Leste',
        description: 'Testar latência de entrega de mensagens para códigos de país +239 e +670.',
        category: 'engineering',
        priority: 'medium',
        state: 'ASSIGNED',
        assigneeId: 'admin_eng_1',
        assigneeName: 'Engenharia CPLP',
        createdBy: 'admin_founder',
        createdByName: 'Sila Marco',
        createdAt: Date.now() - 43200000,
        updatedAt: Date.now() - 14400000
      },
      {
        id: 'task_003',
        title: 'Verificar conciliação de pagamentos Pix Brasil do fim de semana',
        description: 'Checar taxa de liquidação de assinaturas mensais.',
        category: 'finance',
        priority: 'low',
        state: 'OPEN',
        createdBy: 'admin_founder',
        createdByName: 'Sila Marco',
        createdAt: Date.now() - 21600000,
        updatedAt: Date.now() - 21600000
      }
    ];
  }

  private saveState(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(this.tasks));
    } catch {}
  }

  public getTasks(): AdminTask[] {
    return [...this.tasks];
  }

  public createTask(
    data: {
      title: string;
      description: string;
      category: AdminTask['category'];
      priority: AdminTask['priority'];
      assigneeId?: string;
      assigneeName?: string;
    },
    actor: AdminUser
  ): { success: boolean; task?: AdminTask; error?: string } {
    const rbac = RbacService.getInstance();
    if (!rbac.can(actor, 'tasks:create')) {
      return { success: false, error: 'Sem permissão para criar tarefas.' };
    }

    const newTask: AdminTask = {
      id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title: data.title.trim(),
      description: data.description.trim(),
      category: data.category,
      priority: data.priority,
      state: data.assigneeId ? 'ASSIGNED' : 'OPEN',
      assigneeId: data.assigneeId,
      assigneeName: data.assigneeName,
      createdBy: actor.id,
      createdByName: actor.displayName || actor.name || actor.email,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this.tasks.unshift(newTask);
    this.saveState();

    AuditService.getInstance().logMutation(actor, {
      module: 'tasks',
      resourceType: 'admin_task',
      resourceId: newTask.id,
      action: 'CREATE_TASK',
      newState: newTask,
      justification: `Criação da tarefa: ${newTask.title}`
    });

    return { success: true, task: newTask };
  }

  /**
   * 2.10 & 2.11: Explicit Lifecycle State Transitions
   * OPEN -> ASSIGNED -> IN_PROGRESS -> RESOLVED -> CLOSED
   */
  public transitionState(
    taskId: string,
    targetState: AdminTaskState,
    actor: AdminUser,
    options?: {
      assigneeId?: string;
      assigneeName?: string;
      comment?: string;
    }
  ): { success: boolean; error?: string } {
    const rbac = RbacService.getInstance();
    const task = this.tasks.find(t => t.id === taskId);
    if (!task) {
      return { success: false, error: 'Tarefa não encontrada.' };
    }

    // Check RBAC & Resource policy condition
    if (!rbac.can(actor, 'tasks:transition', { type: 'admin_task', id: taskId, state: task.state })) {
      return { success: false, error: 'Ação não autorizada pelas políticas de acesso ou estado da tarefa.' };
    }

    // Check state machine valid transition
    const allowed = VALID_TRANSITIONS[task.state];
    if (!allowed.includes(targetState)) {
      return {
        success: false,
        error: `Transição inválida: Não é permitido mover de ${task.state} para ${targetState}. Transições válidas: ${allowed.join(', ')}.`
      };
    }

    const prevState = task.state;
    task.state = targetState;
    task.updatedAt = Date.now();

    if (targetState === 'ASSIGNED' && options?.assigneeId) {
      task.assigneeId = options.assigneeId;
      task.assigneeName = options.assigneeName;
    }
    if (targetState === 'RESOLVED') {
      task.resolvedAt = Date.now();
    }
    if (targetState === 'CLOSED') {
      task.closedAt = Date.now();
    }

    this.saveState();

    AuditService.getInstance().logMutation(actor, {
      module: 'tasks',
      resourceType: 'admin_task',
      resourceId: task.id,
      action: `TRANSITION_TASK_${prevState}_TO_${targetState}`,
      previousState: { state: prevState },
      newState: { state: targetState },
      justification: options?.comment || `Transição de estado para ${targetState}`
    });

    return { success: true };
  }
}
