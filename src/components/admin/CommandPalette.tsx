import React, { useState, useEffect } from 'react';
import { AdminUser, AdminPermission } from '../../types';
import { RbacService } from '../../services/admin/rbacService';
import { Search, Command, ArrowRight, X } from 'lucide-react';

export interface CommandItem {
  id: string;
  title: string;
  category: string;
  requiredPermission: AdminPermission;
  action: () => void;
}

interface CommandPaletteProps {
  currentAdmin: AdminUser;
  isOpen: boolean;
  onClose: () => void;
  onSelectModule: (moduleId: string) => void;
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

  // Base list of commands
  const allCommands: CommandItem[] = [
    {
      id: 'cmd_nav_team',
      title: 'Navegar para Gestão de Equipa & RBAC',
      category: 'Navegação',
      requiredPermission: 'admin:read',
      action: () => onSelectModule('team')
    },
    {
      id: 'cmd_nav_trust',
      title: 'Abrir Fila de Trust & Moderação',
      category: 'Navegação',
      requiredPermission: 'trust:signal:read',
      action: () => onSelectModule('trust')
    },
    {
      id: 'cmd_nav_tasks',
      title: 'Ver Quadro de Tarefas & Operações',
      category: 'Navegação',
      requiredPermission: 'tasks:create',
      action: () => onSelectModule('tasks')
    },
    {
      id: 'cmd_nav_product',
      title: 'Acessar Feature Flags & Rollout de Produto',
      category: 'Navegação',
      requiredPermission: 'product:flags:read',
      action: () => onSelectModule('product')
    },
    {
      id: 'cmd_nav_eng',
      title: 'Ver Métricas de Observabilidade & Latência P95',
      category: 'Navegação',
      requiredPermission: 'engineering:metrics:read',
      action: () => onSelectModule('engineering')
    },
    {
      id: 'cmd_nav_integrations',
      title: 'Ver Contratos e Status de Adaptadores de Integração',
      category: 'Navegação',
      requiredPermission: 'integrations:read',
      action: () => onSelectModule('integrations')
    },
    {
      id: 'cmd_nav_finance',
      title: 'Visualizar Métricas de MRR & Livro Razão Financeiro',
      category: 'Navegação',
      requiredPermission: 'finance:read',
      action: () => onSelectModule('finance')
    },
    {
      id: 'cmd_nav_audit',
      title: 'Consultar Trilha Imutável de Auditoria',
      category: 'Navegação',
      requiredPermission: 'audit:read',
      action: () => onSelectModule('audit')
    }
  ];

  // 2.16: Filter strictly by RBAC permissions and user query
  const authorizedCommands = allCommands.filter(cmd => {
    const isAllowed = rbac.can(currentAdmin, cmd.requiredPermission);
    if (!isAllowed) return false;
    if (!query.trim()) return true;
    return (
      cmd.title.toLowerCase().includes(query.toLowerCase()) ||
      cmd.category.toLowerCase().includes(query.toLowerCase())
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl max-w-lg w-full overflow-hidden text-xs">
        <div className="p-3 border-b border-stone-200 flex items-center gap-2">
          <Search className="w-4 h-4 text-stone-700 ml-1" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Pesquise por comandos ou módulos autorizados..."
            className="flex-1 bg-transparent border-none text-stone-900 focus:outline-none text-xs"
          />
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-stone-700 hover:text-stone-700 rounded-lg hover:bg-stone-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-72 overflow-y-auto p-2 divide-y divide-stone-100">
          {authorizedCommands.length === 0 ? (
            <div className="p-4 text-center text-stone-700">
              Nenhum comando autorizado encontrado para sua pesquisa e permissões.
            </div>
          ) : (
            authorizedCommands.map(cmd => (
              <button
                key={cmd.id}
                type="button"
                onClick={() => {
                  cmd.action();
                  onClose();
                }}
                className="w-full text-left p-2.5 rounded-xl hover:bg-stone-50 transition flex items-center justify-between group cursor-pointer"
              >
                <div>
                  <span className="font-semibold text-stone-900 block">{cmd.title}</span>
                  <span className="text-[10px] text-stone-700 uppercase font-mono">{cmd.category}</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-stone-300 group-hover:text-stone-700 transition" />
              </button>
            ))
          )}
        </div>

        <div className="p-2.5 bg-stone-50 border-t border-stone-100 text-[10px] text-stone-700 flex items-center justify-between">
          <span>Comandos filtrados dinamicamente via RBAC/ABAC</span>
          <kbd className="px-1.5 py-0.5 bg-white border border-stone-200 rounded font-mono">ESC para fechar</kbd>
        </div>
      </div>
    </div>
  );
};
