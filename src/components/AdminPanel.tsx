import React, { useState, useEffect, Suspense } from 'react';
import { AdminUser } from '../types';
import { RbacService } from '../services/admin/rbacService';
import { CONTROL_MODULES, ControlModuleDefinition, ControlSubmoduleDefinition } from './admin/moduleRegistry';
import { CommandPalette } from './admin/CommandPalette';
import {
  ArrowLeft,
  Search,
  Key,
  Mail,
  Phone,
  Shield,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  Layers,
  ChevronRight,
  ChevronDown,
  Activity,
  Zap,
  Globe2,
  Lock,
  RefreshCw,
  FolderTree,
  FileCode,
  Sliders,
  ExternalLink
} from 'lucide-react';

const LAST_MODULE_STORAGE_KEY = 'en_control_active_module_v3';
const LAST_SUBMODULE_STORAGE_KEY = 'en_control_active_submodule_v3';
const SIDEBAR_COLLAPSED_STORAGE_KEY = 'en_control_sidebar_collapsed_v3';

interface AdminPanelProps {
  currentAdmin: AdminUser;
  dynamicAdmins: AdminUser[];
  onAddAdmin: (newAdmin: Omit<AdminUser, 'id' | 'createdAt' | 'createdBy'>) => void;
  onToggleStatus: (adminId: string) => void;
  onDeleteAdmin: (adminId: string) => void;
  onClose: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  currentAdmin,
  dynamicAdmins,
  onAddAdmin,
  onToggleStatus,
  onDeleteAdmin,
  onClose
}) => {
  const rbac = RbacService.getInstance();

  // Load initial state safely from localStorage
  const [activeModuleId, setActiveModuleId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(LAST_MODULE_STORAGE_KEY);
        if (saved && CONTROL_MODULES.some(m => m.id === saved)) {
          return saved;
        }
      } catch {}
    }
    return 'operations';
  });

  const [activeSubmoduleId, setActiveSubmoduleId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedSub = localStorage.getItem(LAST_SUBMODULE_STORAGE_KEY);
        if (savedSub) return savedSub;
      } catch {}
    }
    return 'visao';
  });

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY);
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return false;
  });

  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({
    operations: true,
    people: true,
    trust: true,
    product: true,
    discovery: true,
    growth: true,
    tasks: true,
    integrations: true,
    engineering: true,
    governance: true
  });

  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  // Filter authorized modules based on RBAC
  const authorizedModules = CONTROL_MODULES.filter(mod =>
    rbac.can(currentAdmin, mod.requiredPermission)
  );

  // Fallback if current active module is unauthorized
  const currentModule =
    authorizedModules.find(m => m.id === activeModuleId) || authorizedModules[0] || CONTROL_MODULES[0];

  // Validate active submodule belongs to current module
  const currentSubmodules = currentModule.submodules || [];
  const currentSubmodule =
    currentSubmodules.find(s => s.id === activeSubmoduleId) || currentSubmodules[0];

  const handleSelectModule = (modId: string, subId?: string) => {
    setActiveModuleId(modId);
    const targetModule = authorizedModules.find(m => m.id === modId) || CONTROL_MODULES.find(m => m.id === modId);
    const defaultSub = subId || (targetModule?.submodules?.[0]?.id ?? '');
    setActiveSubmoduleId(defaultSub);

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(LAST_MODULE_STORAGE_KEY, modId);
        localStorage.setItem(LAST_SUBMODULE_STORAGE_KEY, defaultSub);
      } catch {}
    }
  };

  const handleSelectSubmodule = (modId: string, subId: string) => {
    setActiveModuleId(modId);
    setActiveSubmoduleId(subId);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(LAST_MODULE_STORAGE_KEY, modId);
        localStorage.setItem(LAST_SUBMODULE_STORAGE_KEY, subId);
      } catch {}
    }
  };

  const toggleModuleExpanded = (modId: string) => {
    setExpandedModules(prev => ({
      ...prev,
      [modId]: !prev[modId]
    }));
  };

  const toggleSidebar = () => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, JSON.stringify(next));
        } catch {}
      }
      return next;
    });
  };

  // Keyboard shortcut listener for Command Palette (Ctrl+K or Cmd+K)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const ActiveComponent = currentModule.component;
  const normalizedRole = rbac.normalizeRole(currentAdmin.role);

  return (
    <div className="min-h-screen bg-stone-100/70 text-stone-900 flex flex-col antialiased">
      {/* Command Palette Modal */}
      <CommandPalette
        currentAdmin={currentAdmin}
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onSelectModule={handleSelectModule}
      />

      {/* Top Global Administrative Control Bar */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-30 px-4 py-2 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleSidebar}
            className="p-1.5 rounded-xl bg-stone-50 hover:bg-stone-100 border border-stone-200 text-stone-700 transition cursor-pointer"
            title={isSidebarCollapsed ? 'Expandir Navegação' : 'Recolher Navegação'}
          >
            {isSidebarCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>

          <div className="flex items-center gap-2">
            <span className="font-extrabold text-sm tracking-tight text-stone-900 flex items-center gap-1.5">
              <span>ÉN</span>
              <span className="text-rose-600 font-mono text-[11px] px-1.5 py-0.5 bg-rose-50 border border-rose-200 rounded font-bold">
                CONTROL
              </span>
            </span>
            <span className="text-stone-300 hidden sm:inline">/</span>
            <span className="text-xs font-bold text-stone-900 hidden sm:inline">
              {currentModule.shortTitle}
            </span>
            {currentSubmodule && (
              <>
                <span className="text-stone-300 hidden sm:inline">/</span>
                <span className="text-xs font-medium text-stone-700 hidden sm:inline">
                  {currentSubmodule.shortTitle}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Right Operator Meta & Quick Commands */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsCommandPaletteOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-stone-50 hover:bg-stone-100 text-stone-700 rounded-xl border border-stone-200 text-xs font-medium transition cursor-pointer shadow-2xs"
          >
            <Search className="w-3.5 h-3.5 text-stone-700" />
            <span className="hidden sm:inline">Comandos</span>
            <kbd className="hidden sm:inline text-[10px] font-mono bg-white px-1.5 py-0.5 rounded border border-stone-200 text-stone-700">
              ⌘K
            </kbd>
          </button>

          <div className="hidden md:flex items-center gap-2 px-2.5 py-1 bg-stone-50 rounded-xl border border-stone-200 text-[11px] text-stone-700 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{currentAdmin.displayName || currentAdmin.name}</span>
            <span className="text-stone-700">·</span>
            <span className="font-mono uppercase font-bold text-rose-700">{normalizedRole}</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl bg-white border border-stone-200 text-stone-700 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Voltar ao Portal</span>
          </button>
        </div>
      </header>

      {/* Main Shell Layout with Collapsible Operational Tree Sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Collapsible VS Code Inspired Tree Sidebar */}
        <aside
          className={`bg-white border-r border-stone-200 transition-all duration-200 flex flex-col shrink-0 overflow-y-auto ${
            isSidebarCollapsed ? 'w-16 p-2' : 'w-64 p-3'
          }`}
        >
          {/* Operator Identification (Expanded) */}
          {!isSidebarCollapsed && (
            <div className="p-3 mb-3 rounded-xl bg-stone-50 border border-stone-200/80 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-stone-900 truncate">
                  {currentAdmin.displayName || currentAdmin.name}
                </span>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-mono">
                  {normalizedRole}
                </span>
              </div>
              <div className="text-[11px] text-stone-700 mt-1 truncate">
                {currentAdmin.email}
              </div>
              <div className="mt-2 pt-2 border-t border-stone-200 flex items-center justify-between text-[10px] text-stone-700">
                <span>PIN: <strong className="font-mono text-stone-900">{currentAdmin.pin || '••••••'}</strong></span>
                <span className="text-emerald-700 font-medium">Sessão Ativa</span>
              </div>
            </div>
          )}

          {/* Root Tree Title */}
          {!isSidebarCollapsed && (
            <div className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-mono font-bold uppercase tracking-wider text-stone-700 border-b border-stone-100 mb-2">
              <FolderTree className="w-3.5 h-3.5 text-stone-700" />
              <span>ÉN CONTROL</span>
            </div>
          )}

          {/* Navigation Tree with 10 Modules & Submodules */}
          <div className="space-y-1 flex-1">
            {authorizedModules.map(mod => {
              const Icon = mod.icon;
              const isModuleActive = currentModule.id === mod.id;
              const isExpanded = expandedModules[mod.id] ?? true;

              return (
                <div key={mod.id} className="space-y-0.5">
                  <div
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                      isModuleActive
                        ? 'bg-rose-50 text-rose-900 font-bold border border-rose-200'
                        : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900'
                    }`}
                    onClick={() => handleSelectModule(mod.id)}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <Icon className={`w-4 h-4 shrink-0 ${isModuleActive ? 'text-rose-600' : 'text-stone-700'}`} />
                      {!isSidebarCollapsed && (
                        <span className="truncate tracking-tight">{mod.shortTitle}</span>
                      )}
                    </div>

                    {!isSidebarCollapsed && mod.submodules && mod.submodules.length > 0 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleModuleExpanded(mod.id);
                        }}
                        className="p-1 hover:bg-stone-200/60 rounded text-stone-700 cursor-pointer"
                      >
                        {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>

                  {/* Submodules rendering */}
                  {!isSidebarCollapsed && isExpanded && mod.submodules && (
                    <div className="pl-6 pr-1 py-0.5 space-y-0.5 border-l border-stone-200 ml-4">
                      {mod.submodules.map(sub => {
                        const isSubActive = isModuleActive && currentSubmodule?.id === sub.id;

                        return (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() => handleSelectSubmodule(mod.id, sub.id)}
                            className={`w-full text-left px-2 py-1 rounded-lg text-[11px] font-medium transition cursor-pointer truncate ${
                              isSubActive
                                ? 'bg-stone-900 text-white font-bold shadow-2xs'
                                : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900'
                            }`}
                          >
                            {sub.title}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Quick System Status in Sidebar Footer */}
          {!isSidebarCollapsed && (
            <div className="mt-4 pt-3 border-t border-stone-100 text-[10px] text-stone-700 flex items-center justify-between">
              <span>9 Países CPLP</span>
              <span className="font-mono text-emerald-600 font-bold">100% OK</span>
            </div>
          )}
        </aside>

        {/* Main Operational Workspace */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {/* Contextual Submodule Tab Bar */}
            {currentSubmodules.length > 1 && (
              <div className="mb-6 flex flex-wrap items-center gap-1.5 p-1.5 bg-white rounded-2xl border border-stone-200 shadow-2xs">
                {currentSubmodules.map(sub => {
                  const isSelected = (currentSubmodule?.id || currentSubmodules[0].id) === sub.id;
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => handleSelectSubmodule(currentModule.id, sub.id)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                        isSelected
                          ? 'bg-rose-600 text-white shadow-2xs font-bold'
                          : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900'
                      }`}
                    >
                      {sub.title}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Dynamic Module Component Body */}
            <Suspense
              fallback={
                <div className="flex flex-col items-center justify-center p-16 space-y-3">
                  <Loader2 className="w-8 h-8 text-rose-600 animate-spin" />
                  <span className="text-xs font-medium text-stone-700">Carregando módulo {currentModule.title}...</span>
                </div>
              }
            >
              <ActiveComponent
                currentAdmin={currentAdmin}
                dynamicAdmins={dynamicAdmins}
                onAddAdmin={onAddAdmin}
                onToggleStatus={onToggleStatus}
                onDeleteAdmin={onDeleteAdmin}
                activeSubmoduleId={currentSubmodule?.id || currentSubmodules[0]?.id}
              />
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
};
