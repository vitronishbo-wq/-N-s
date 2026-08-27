import React from 'react';
import { AdminPermission, AdminUser } from '../../types';
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  Flag,
  Compass,
  TrendingUp,
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
  activeSubmoduleId?: string;
}

export interface ControlSubmoduleDefinition {
  id: string;
  title: string;
  shortTitle: string;
  description?: string;
}

export interface ControlModuleDefinition {
  id: string;
  title: string;
  shortTitle: string;
  description: string;
  category: 'operations' | 'people' | 'trust' | 'product' | 'discovery' | 'growth' | 'engineering' | 'integrations' | 'finance' | 'tasks' | 'governance';
  icon: React.ComponentType<{ className?: string }>;
  requiredPermission: AdminPermission;
  submodules: ControlSubmoduleDefinition[];
  component: React.ComponentType<ModuleProps>;
}

// Lazy loaded modules for on-demand bundle splitting
const OperationsModule = React.lazy(() => import('./modules/OperationsModule').then(m => ({ default: m.OperationsModule })));
const PeopleModule = React.lazy(() => import('./modules/PeopleModule').then(m => ({ default: m.PeopleModule })));
const TrustModule = React.lazy(() => import('./modules/TrustModule').then(m => ({ default: m.TrustModule })));
const ProductModule = React.lazy(() => import('./modules/ProductModule').then(m => ({ default: m.ProductModule })));
const DiscoveryModule = React.lazy(() => import('./modules/DiscoveryModule').then(m => ({ default: m.DiscoveryModule })));
const GrowthModule = React.lazy(() => import('./modules/GrowthModule').then(m => ({ default: m.GrowthModule })));
const TasksModule = React.lazy(() => import('./modules/TasksModule').then(m => ({ default: m.TasksModule })));
const IntegrationsModule = React.lazy(() => import('./modules/IntegrationsModule').then(m => ({ default: m.IntegrationsModule })));
const EngineeringModule = React.lazy(() => import('./modules/EngineeringModule').then(m => ({ default: m.EngineeringModule })));
const GovernanceModule = React.lazy(() => import('./modules/GovernanceModule').then(m => ({ default: m.GovernanceModule })));
const FinanceModule = React.lazy(() => import('./modules/FinanceModule').then(m => ({ default: m.FinanceModule })));

/**
 * 10 Root Modules of ÉN CONTROL (Inspired by VS Code Hierarchy)
 */
export const CONTROL_MODULES: ControlModuleDefinition[] = [
  {
    id: 'operations',
    title: 'OPERAR · Visão Operacional & Estado',
    shortTitle: 'OPERAR',
    description: 'Overview em tempo real de infraestrutura, pendências críticas, filas e incidentes.',
    category: 'operations',
    icon: LayoutDashboard,
    requiredPermission: 'admin:read',
    submodules: [
      { id: 'visao', title: 'Visão Operacional', shortTitle: 'Visão Operacional' },
      { id: 'filas', title: 'Filas', shortTitle: 'Filas' },
      { id: 'incidentes', title: 'Incidentes', shortTitle: 'Incidentes' },
      { id: 'estado', title: 'Estado do Sistema', shortTitle: 'Estado do Sistema' }
    ],
    component: OperationsModule
  },
  {
    id: 'people',
    title: 'PESSOAS · Utilizadores & Equipa',
    shortTitle: 'PESSOAS',
    description: 'Gestão de utilizadores finais CPLP, administradores, matriz RBAC e equipas.',
    category: 'people',
    icon: Users,
    requiredPermission: 'admin:read',
    submodules: [
      { id: 'utilizadores', title: 'Utilizadores', shortTitle: 'Utilizadores' },
      { id: 'administradores', title: 'Administradores', shortTitle: 'Administradores' },
      { id: 'funcoes', title: 'Funções', shortTitle: 'Funções' },
      { id: 'permissoes', title: 'Permissões', shortTitle: 'Permissões' },
      { id: 'equipas', title: 'Equipas', shortTitle: 'Equipas' }
    ],
    component: PeopleModule
  },
  {
    id: 'trust',
    title: 'CONFIANÇA · Moderação & Segurança',
    shortTitle: 'CONFIANÇA',
    description: 'Fila de moderação auditada & Trust Graph: Evidência → Validação → Sinais Privados → Política → Badges Públicos.',
    category: 'trust',
    icon: ShieldCheck,
    requiredPermission: 'trust:signal:read',
    submodules: [
      { id: 'denuncias', title: 'Denúncias', shortTitle: 'Denúncias' },
      { id: 'verificacoes', title: 'Verificações (Evidências)', shortTitle: 'Verificações' },
      { id: 'trust_graph', title: 'Trust Graph & Badges', shortTitle: 'Trust Graph' },
      { id: 'moderacao', title: 'Moderação', shortTitle: 'Moderação' },
      { id: 'restricoes', title: 'Restrições', shortTitle: 'Restrições' },
      { id: 'bloqueios', title: 'Bloqueios', shortTitle: 'Bloqueios' },
      { id: 'politicas', title: 'Políticas', shortTitle: 'Políticas' }
    ],
    component: TrustModule
  },
  {
    id: 'product',
    title: 'PRODUTO · Funcionalidades & Flags',
    shortTitle: 'PRODUTO',
    description: 'Controlo de funcionalidades mestre, rollout progressivo e parametrização do produto.',
    category: 'product',
    icon: Flag,
    requiredPermission: 'product:flags:read',
    submodules: [
      { id: 'funcionalidades', title: 'Funcionalidades', shortTitle: 'Funcionalidades' },
      { id: 'flags', title: 'Feature Flags', shortTitle: 'Feature Flags' },
      { id: 'configuracoes', title: 'Configurações', shortTitle: 'Configurações' },
      { id: 'lancamentos', title: 'Lançamentos', shortTitle: 'Lançamentos' }
    ],
    component: ProductModule
  },
  {
    id: 'discovery',
    title: 'DISCOVERY · Motor & Expansão',
    shortTitle: 'DISCOVERY',
    description: 'Motor de descoberta, disponibilidade de perfis, expansão de raio, ranking e diversidade.',
    category: 'discovery',
    icon: Compass,
    requiredPermission: 'product:flags:read',
    submodules: [
      { id: 'motor', title: 'Motor', shortTitle: 'Motor' },
      { id: 'mcr', title: 'MCR (North Star)', shortTitle: 'MCR' },
      { id: 'disponibilidade', title: 'Disponibilidade', shortTitle: 'Disponibilidade' },
      { id: 'expansao', title: 'Expansão', shortTitle: 'Expansão' },
      { id: 'ranking', title: 'Ranking', shortTitle: 'Ranking' },
      { id: 'diversidade', title: 'Diversidade', shortTitle: 'Diversidade' }
    ],
    component: DiscoveryModule
  },
  {
    id: 'growth',
    title: 'CRESCIMENTO · Ativação & Retenção',
    shortTitle: 'CRESCIMENTO',
    description: 'Funil de ativação, cohorts de retenção D1-D30, convites e expansão geográfica CPLP.',
    category: 'growth',
    icon: TrendingUp,
    requiredPermission: 'growth:read',
    submodules: [
      { id: 'ativacao', title: 'Ativação', shortTitle: 'Ativação' },
      { id: 'retencao', title: 'Retenção', shortTitle: 'Retenção' },
      { id: 'convites', title: 'Convites', shortTitle: 'Convites' },
      { id: 'expansao_geo', title: 'Expansão Geográfica', shortTitle: 'Expansão Geográfica' }
    ],
    component: GrowthModule
  },
  {
    id: 'tasks',
    title: 'TAREFAS · Gestão da Equipa',
    shortTitle: 'TAREFAS',
    description: 'Ciclo de vida operacional: OPEN → ASSIGNED → IN_PROGRESS → RESOLVED → CLOSED.',
    category: 'tasks',
    icon: CheckSquare,
    requiredPermission: 'tasks:create',
    submodules: [
      { id: 'minhas', title: 'Minhas Tarefas', shortTitle: 'Minhas' },
      { id: 'equipa', title: 'Tarefas da Equipa', shortTitle: 'Equipa' },
      { id: 'filas', title: 'Filas Operacionais', shortTitle: 'Filas' },
      { id: 'historico', title: 'Histórico', shortTitle: 'Histórico' }
    ],
    component: TasksModule
  },
  {
    id: 'integrations',
    title: 'INTEGRAÇÕES · Contratos de Fornecedores',
    shortTitle: 'INTEGRAÇÕES',
    description: 'Contratos e adaptadores desacoplados para IA, Pagamentos, APIs, Webhooks e Parceiros.',
    category: 'integrations',
    icon: Network,
    requiredPermission: 'integrations:read',
    submodules: [
      { id: 'ia', title: 'IA', shortTitle: 'IA' },
      { id: 'pagamentos', title: 'Pagamentos', shortTitle: 'Pagamentos' },
      { id: 'apis', title: 'APIs', shortTitle: 'APIs' },
      { id: 'webhooks', title: 'Webhooks', shortTitle: 'Webhooks' },
      { id: 'parceiros', title: 'Parceiros', shortTitle: 'Parceiros' }
    ],
    component: IntegrationsModule
  },
  {
    id: 'engineering',
    title: 'ENGENHARIA · Saúde & Telemetria',
    shortTitle: 'ENGENHARIA',
    description: 'Saúde do sistema, versões ativas, histórico de deployments, erros e métricas P95.',
    category: 'engineering',
    icon: Activity,
    requiredPermission: 'engineering:metrics:read',
    submodules: [
      { id: 'saude', title: 'Saúde do Sistema', shortTitle: 'Saúde' },
      { id: 'data_saver', title: 'Data Saver & Resiliência CPLP', shortTitle: 'Data Saver' },
      { id: 'versoes', title: 'Versões', shortTitle: 'Versões' },
      { id: 'deployments', title: 'Deployments', shortTitle: 'Deployments' },
      { id: 'erros', title: 'Erros & Exceções', shortTitle: 'Erros' },
      { id: 'performance', title: 'Performance', shortTitle: 'Performance' }
    ],
    component: EngineeringModule
  },
  {
    id: 'governance',
    title: 'GOVERNAÇÃO · Auditoria & Trilha Imutável',
    shortTitle: 'GOVERNAÇÃO',
    description: 'AuditEvent imutável, histórico de acessos, diff de alterações e políticas de segurança.',
    category: 'governance',
    icon: FileText,
    requiredPermission: 'governance:read',
    submodules: [
      { id: 'auditoria', title: 'Auditoria', shortTitle: 'Auditoria' },
      { id: 'acessos', title: 'Acessos', shortTitle: 'Acessos' },
      { id: 'alteracoes', title: 'Alterações (Diff)', shortTitle: 'Alterações' },
      { id: 'politicas_admin', title: 'Políticas de Administração', shortTitle: 'Políticas de Administração' }
    ],
    component: GovernanceModule
  }
];
