import React from 'react';
import { AdminPermission, AdminUser } from '../../types';
import {
  Users,
  ShieldCheck,
  Flag,
  Activity,
  Network,
  DollarSign,
  CheckSquare,
  FileText
} from 'lucide-react';

export interface ModuleProps {
  currentAdmin: AdminUser;
  dynamicAdmins?: AdminUser[];
  onAddAdmin?: (newAdmin: Omit<AdminUser, 'id' | 'createdAt' | 'createdBy'>) => void;
  onToggleStatus?: (adminId: string) => void;
  onDeleteAdmin?: (adminId: string) => void;
}

export interface ControlModuleDefinition {
  id: string;
  title: string;
  shortTitle: string;
  description: string;
  category: 'governance' | 'operations' | 'platform';
  icon: React.ComponentType<{ className?: string }>;
  requiredPermission: AdminPermission;
  component: React.ComponentType<ModuleProps>;
}

// Lazy/light modular imports
const TeamModule = React.lazy(() => import('./modules/TeamModule').then(m => ({ default: m.TeamModule })));
const TrustModule = React.lazy(() => import('./modules/TrustModule').then(m => ({ default: m.TrustModule })));
const ProductModule = React.lazy(() => import('./modules/ProductModule').then(m => ({ default: m.ProductModule })));
const EngineeringModule = React.lazy(() => import('./modules/EngineeringModule').then(m => ({ default: m.EngineeringModule })));
const IntegrationsModule = React.lazy(() => import('./modules/IntegrationsModule').then(m => ({ default: m.IntegrationsModule })));
const FinanceModule = React.lazy(() => import('./modules/FinanceModule').then(m => ({ default: m.FinanceModule })));
const TasksModule = React.lazy(() => import('./modules/TasksModule').then(m => ({ default: m.TasksModule })));
const AuditModule = React.lazy(() => import('./modules/AuditModule').then(m => ({ default: m.AuditModule })));

/**
 * 2.15: Pluggable Module Registry.
 * New modules can be added directly to this registry without touching the CONTROL root layout!
 */
export const CONTROL_MODULES: ControlModuleDefinition[] = [
  {
    id: 'team',
    title: 'Equipa & Governança RBAC',
    shortTitle: 'Equipa & RBAC',
    description: 'Gestão de papéis formais, equipas, administradores dinâmicos e políticas de acesso.',
    category: 'governance',
    icon: Users,
    requiredPermission: 'admin:read',
    component: TeamModule
  },
  {
    id: 'trust',
    title: 'Trust & Safety (Ciclo 6 Etapas)',
    shortTitle: 'Trust & Moderação',
    description: 'Fila de moderação auditada: Signal → Detection → Review → Decision → Action → Audit.',
    category: 'operations',
    icon: ShieldCheck,
    requiredPermission: 'trust:signal:read',
    component: TrustModule
  },
  {
    id: 'tasks',
    title: 'Tarefas & Operações',
    shortTitle: 'Tarefas',
    description: 'Ciclo de vida explícito: OPEN → ASSIGNED → IN_PROGRESS → RESOLVED → CLOSED.',
    category: 'operations',
    icon: CheckSquare,
    requiredPermission: 'tasks:create',
    component: TasksModule
  },
  {
    id: 'product',
    title: 'Produto & Rollout de Flags',
    shortTitle: 'Produto & Flags',
    description: 'Controlo de exposição, percentual de rollout e ativação de funcionalidades.',
    category: 'platform',
    icon: Flag,
    requiredPermission: 'product:flags:read',
    component: ProductModule
  },
  {
    id: 'engineering',
    title: 'Engenharia & Observabilidade',
    shortTitle: 'Observabilidade',
    description: 'Camada de observabilidade operacional: latência P95, uptime, throughput e alertas.',
    category: 'platform',
    icon: Activity,
    requiredPermission: 'engineering:metrics:read',
    component: EngineeringModule
  },
  {
    id: 'integrations',
    title: 'Integrações & Fornecedores',
    shortTitle: 'Integrações',
    description: 'Contratos e adaptadores para gateways de pagamento, SMS, CDN e IA.',
    category: 'platform',
    icon: Network,
    requiredPermission: 'integrations:read',
    component: IntegrationsModule
  },
  {
    id: 'finance',
    title: 'Finanças & Receita CPLP',
    shortTitle: 'Finanças',
    description: 'Métricas financeiras, MRR, conciliação e receitas por país membro.',
    category: 'governance',
    icon: DollarSign,
    requiredPermission: 'finance:read',
    component: FinanceModule
  },
  {
    id: 'audit',
    title: 'Trilha de Auditoria Imutável',
    shortTitle: 'Auditoria',
    description: 'Registo de mutações com actor, papéis, estado anterior/novo e justificativa.',
    category: 'governance',
    icon: FileText,
    requiredPermission: 'audit:read',
    component: AuditModule
  }
];
