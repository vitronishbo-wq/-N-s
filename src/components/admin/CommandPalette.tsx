import React, { useState, useEffect } from 'react';
import { AdminUser, AdminPermission } from '../../types';
import { RbacService } from '../../services/admin/rbacService';
import { Search, Command, ArrowRight, X, Zap, Shield, FileText, CheckSquare, DollarSign, Activity, Compass, Users } from 'lucide-react';

export interface CommandItem {
  id: string;
  title: string;
  category: string;
  requiredPermission: AdminPermission;
  shortcut?: string;
  action: () => void;
}

interface CommandPaletteProps {
  currentAdmin: AdminUser;
  isOpen: boolean;
  onClose: () => void;
  onSelectModule: (moduleId: string, submoduleId?: string) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  currentAdmin,
  isOpen,
  onClose,
  onSelectModule
}) => {
  const [query, setQuery] = useState('');
  const rbac = RbacService.getInstance();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const allCommands: CommandItem[] = [
    // Operar
    { id: 'cmd_op_visao', title: 'Operar: Visão Geral de Pendências', category: 'OPERAR', requiredPermission: 'admin:read', shortcut: 'O V', action: () => onSelectModule('operations', 'visao') },
    { id: 'cmd_op_filas', title: 'Operar: Filas de Moderação e Tarefas', category: 'OPERAR', requiredPermission: 'admin:read', shortcut: 'O F', action: () => onSelectModule('operations', 'filas') },
    { id: 'cmd_op_inc', title: 'Operar: Declarar / Gerir Incidentes', category: 'OPERAR', requiredPermission: 'admin:read', shortcut: 'O I', action: () => onSelectModule('operations', 'incidentes') },
    { id: 'cmd_op_estado', title: 'Operar: Testar Estado do Sistema', category: 'OPERAR', requiredPermission: 'admin:read', shortcut: 'O E', action: () => onSelectModule('operations', 'estado') },

    // Pessoas
    { id: 'cmd_pe_users', title: 'Pessoas: Consultar Utilizadores CPLP', category: 'PESSOAS', requiredPermission: 'admin:read', shortcut: 'P U', action: () => onSelectModule('people', 'utilizadores') },
    { id: 'cmd_pe_admins', title: 'Pessoas: Administradores & Deus Fundador', category: 'PESSOAS', requiredPermission: 'admin:read', shortcut: 'P A', action: () => onSelectModule('people', 'administradores') },
    { id: 'cmd_pe_roles', title: 'Pessoas: Funções & Matriz RBAC', category: 'PESSOAS', requiredPermission: 'admin:read', shortcut: 'P F', action: () => onSelectModule('people', 'funcoes') },
    { id: 'cmd_pe_perms', title: 'Pessoas: Matriz de Permissões', category: 'PESSOAS', requiredPermission: 'admin:read', shortcut: 'P P', action: () => onSelectModule('people', 'permissoes') },
    { id: 'cmd_pe_teams', title: 'Pessoas: Equipas & Filas', category: 'PESSOAS', requiredPermission: 'admin:read', shortcut: 'P T', action: () => onSelectModule('people', 'equipas') },

    // Confiança
    { id: 'cmd_tr_den', title: 'Confiança: Fila de Denúncias', category: 'CONFIANÇA', requiredPermission: 'trust:signal:read', shortcut: 'C D', action: () => onSelectModule('trust', 'denuncias') },
    { id: 'cmd_tr_mod', title: 'Confiança: Moderação & Deliberações', category: 'CONFIANÇA', requiredPermission: 'trust:signal:read', shortcut: 'C M', action: () => onSelectModule('trust', 'moderacao') },
    { id: 'cmd_tr_rest', title: 'Confiança: Restrições & Mutes', category: 'CONFIANÇA', requiredPermission: 'trust:signal:read', shortcut: 'C R', action: () => onSelectModule('trust', 'restricoes') },
    { id: 'cmd_tr_blk', title: 'Confiança: Bloqueios & Banimentos', category: 'CONFIANÇA', requiredPermission: 'trust:signal:read', shortcut: 'C B', action: () => onSelectModule('trust', 'bloqueios') },

    // Produto
    { id: 'cmd_pr_func', title: 'Produto: Funcionalidades Mestres', category: 'PRODUTO', requiredPermission: 'product:flags:read', shortcut: 'R F', action: () => onSelectModule('product', 'funcionalidades') },
    { id: 'cmd_pr_flags', title: 'Produto: Feature Flags & Rollouts', category: 'PRODUTO', requiredPermission: 'product:flags:read', shortcut: 'R L', action: () => onSelectModule('product', 'flags') },
    { id: 'cmd_pr_cfg', title: 'Produto: Configurações de Match', category: 'PRODUTO', requiredPermission: 'product:flags:read', shortcut: 'R C', action: () => onSelectModule('product', 'configuracoes') },

    // Discovery
    { id: 'cmd_dc_engine', title: 'Discovery: Motor de Descoberta', category: 'DISCOVERY', requiredPermission: 'product:flags:read', shortcut: 'D M', action: () => onSelectModule('discovery', 'motor') },
    { id: 'cmd_dc_disp', title: 'Discovery: Disponibilidade de Perfis', category: 'DISCOVERY', requiredPermission: 'product:flags:read', shortcut: 'D D', action: () => onSelectModule('discovery', 'disponibilidade') },
    { id: 'cmd_dc_exp', title: 'Discovery: Expansão Territorial', category: 'DISCOVERY', requiredPermission: 'product:flags:read', shortcut: 'D E', action: () => onSelectModule('discovery', 'expansao') },
    { id: 'cmd_dc_rank', title: 'Discovery: Fatores de Ranking', category: 'DISCOVERY', requiredPermission: 'product:flags:read', shortcut: 'D R', action: () => onSelectModule('discovery', 'ranking') },
    { id: 'cmd_dc_div', title: 'Discovery: Diversidade Cultural', category: 'DISCOVERY', requiredPermission: 'product:flags:read', shortcut: 'D V', action: () => onSelectModule('discovery', 'diversidade') },

    // Crescimento
    { id: 'cmd_gw_ativ', title: 'Crescimento: Funil de Ativação', category: 'CRESCIMENTO', requiredPermission: 'growth:read', shortcut: 'G A', action: () => onSelectModule('growth', 'ativacao') },
    { id: 'cmd_gw_ret', title: 'Crescimento: Cohorts de Retenção', category: 'CRESCIMENTO', requiredPermission: 'growth:read', shortcut: 'G R', action: () => onSelectModule('growth', 'retencao') },
    { id: 'cmd_gw_conv', title: 'Crescimento: Convites & Viralidade', category: 'CRESCIMENTO', requiredPermission: 'growth:read', shortcut: 'G C', action: () => onSelectModule('growth', 'convites') },
    { id: 'cmd_gw_exp', title: 'Crescimento: Expansão Geográfica 9 Países', category: 'CRESCIMENTO', requiredPermission: 'growth:read', shortcut: 'G E', action: () => onSelectModule('growth', 'expansao_geo') },

    // Tarefas
    { id: 'cmd_tk_my', title: 'Tarefas: Minhas Tarefas Atribuídas', category: 'TAREFAS', requiredPermission: 'tasks:create', shortcut: 'T M', action: () => onSelectModule('tasks', 'minhas') },
    { id: 'cmd_tk_team', title: 'Tarefas: Quadro Kanban da Equipa', category: 'TAREFAS', requiredPermission: 'tasks:create', shortcut: 'T E', action: () => onSelectModule('tasks', 'equipa') },
    { id: 'cmd_tk_queues', title: 'Tarefas: Filas por Categoria', category: 'TAREFAS', requiredPermission: 'tasks:create', shortcut: 'T F', action: () => onSelectModule('tasks', 'filas') },

    // Integrações
    { id: 'cmd_int_ai', title: 'Integrações: Contrato de IA Gemini', category: 'INTEGRAÇÕES', requiredPermission: 'integrations:read', shortcut: 'I A', action: () => onSelectModule('integrations', 'ia') },
    { id: 'cmd_int_pay', title: 'Integrações: Gateways de Pagamento CPLP', category: 'INTEGRAÇÕES', requiredPermission: 'integrations:read', shortcut: 'I P', action: () => onSelectModule('integrations', 'pagamentos') },
    { id: 'cmd_int_wh', title: 'Integrações: Webhooks Registados', category: 'INTEGRAÇÕES', requiredPermission: 'integrations:read', shortcut: 'I W', action: () => onSelectModule('integrations', 'webhooks') },

    // Engenharia
    { id: 'cmd_eng_saude', title: 'Engenharia: Saúde & Telemetria', category: 'ENGENHARIA', requiredPermission: 'engineering:metrics:read', shortcut: 'E S', action: () => onSelectModule('engineering', 'saude') },
    { id: 'cmd_eng_dep', title: 'Engenharia: Deployments & Versões', category: 'ENGENHARIA', requiredPermission: 'engineering:metrics:read', shortcut: 'E D', action: () => onSelectModule('engineering', 'deployments') },
    { id: 'cmd_eng_err', title: 'Engenharia: Logs de Exceções', category: 'ENGENHARIA', requiredPermission: 'engineering:metrics:read', shortcut: 'E E', action: () => onSelectModule('engineering', 'erros') },

    // Governação
    { id: 'cmd_gov_aud', title: 'Governação: Auditoria Imutável', category: 'GOVERNAÇÃO', requiredPermission: 'governance:read', shortcut: 'V A', action: () => onSelectModule('governance', 'auditoria') },
    { id: 'cmd_gov_acc', title: 'Governação: Histórico de Acessos', category: 'GOVERNAÇÃO', requiredPermission: 'governance:read', shortcut: 'V L', action: () => onSelectModule('governance', 'acessos') },
    { id: 'cmd_gov_diff', title: 'Governação: Diff de Alterações', category: 'GOVERNAÇÃO', requiredPermission: 'governance:read', shortcut: 'V D', action: () => onSelectModule('governance', 'alteracoes') },
    { id: 'cmd_gov_pol', title: 'Governação: Políticas de Segurança', category: 'GOVERNAÇÃO', requiredPermission: 'governance:read', shortcut: 'V P', action: () => onSelectModule('governance', 'politicas_admin') }
  ];

  const authorizedCommands = allCommands.filter(cmd =>
    rbac.can(currentAdmin, cmd.requiredPermission)
  );

  const filteredCommands = authorizedCommands.filter(cmd =>
    cmd.title.toLowerCase().includes(query.toLowerCase()) ||
    cmd.category.toLowerCase().includes(query.toLowerCase())
  );

  const handleExecute = (cmd: CommandItem) => {
    cmd.action();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-xs flex items-start justify-center pt-20 p-4 animate-in fade-in duration-150">
      <div className="bg-white border border-stone-200 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden text-stone-900">
        {/* Search Header */}
        <div className="flex items-center px-4 py-3 border-b border-stone-200 gap-3">
          <Search className="w-4 h-4 text-stone-700 shrink-0" />
          <input
            autoFocus
            type="text"
            placeholder="Digite um módulo, submódulo ou comando rápido..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full bg-transparent text-sm focus:outline-none placeholder:text-stone-700"
          />
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-stone-700 hover:text-stone-900 rounded-lg hover:bg-stone-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Command List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filteredCommands.length === 0 ? (
            <div className="py-8 text-center text-xs text-stone-700">
              Nenhum comando encontrado para "{query}"
            </div>
          ) : (
            filteredCommands.map(cmd => (
              <button
                key={cmd.id}
                type="button"
                onClick={() => handleExecute(cmd)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-left hover:bg-stone-50 transition cursor-pointer text-xs group"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-stone-100 text-stone-700 group-hover:bg-rose-100 group-hover:text-rose-800">
                    {cmd.category}
                  </span>
                  <span className="font-semibold text-stone-800 group-hover:text-stone-950">
                    {cmd.title}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {cmd.shortcut && (
                    <kbd className="text-[10px] font-mono bg-stone-100 px-1.5 py-0.5 rounded border border-stone-200 text-stone-700">
                      {cmd.shortcut}
                    </kbd>
                  )}
                  <ArrowRight className="w-3.5 h-3.5 text-stone-700 group-hover:text-stone-700 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </button>
            ))
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2 bg-stone-50 border-t border-stone-100 text-[10px] text-stone-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span>Navegue com ↑ ↓</span>
            <span>ESC para fechar</span>
          </div>
          <span className="font-mono">{filteredCommands.length} comandos disponíveis</span>
        </div>
      </div>
    </div>
  );
};
