import React, { useState, Suspense } from 'react';
import { AdminUser } from '../types';
import { RbacService } from '../services/admin/rbacService';
import { CONTROL_MODULES, ControlModuleDefinition } from './admin/moduleRegistry';
import { CommandPalette } from './admin/CommandPalette';
import {
  ArrowLeft,
  Search,
  Key,
  Mail,
  Phone,
  Shield,
  Loader2
} from 'lucide-react';

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
  const [activeModuleId, setActiveModuleId] = useState<string>('team');
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  // 2.12: Filter modules authorized for current administrator role & permissions
  const authorizedModules = CONTROL_MODULES.filter(mod =>
    rbac.can(currentAdmin, mod.requiredPermission)
  );

  // Select current active module or fallback to first authorized
  const currentModule =
    authorizedModules.find(m => m.id === activeModuleId) || authorizedModules[0] || CONTROL_MODULES[0];

  const ActiveComponent = currentModule.component;
  const normalizedRole = rbac.normalizeRole(currentAdmin.role);

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 flex flex-col max-w-5xl mx-auto p-4 sm:p-6 pb-20">
      {/* 2.16: Command Palette Modal */}
      <CommandPalette
        currentAdmin={currentAdmin}
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onSelectModule={id => setActiveModuleId(id)}
      />

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200 mb-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="p-2.5 rounded-xl bg-white border border-stone-200 text-stone-700 hover:bg-stone-100 transition shadow-2xs cursor-pointer"
            title="Voltar ao Portal Público"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                {normalizedRole === 'founder' ? 'Role: Founder' : `Role: ${normalizedRole.replace('_', ' ')}`}
              </span>
              <span className="text-xs text-stone-700 font-mono">Controlo Administrativo</span>
            </div>
            <h1 className="text-lg font-bold text-stone-900 leading-tight mt-0.5">
              {currentAdmin.displayName || currentAdmin.name || 'Administrador'}
            </h1>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsCommandPaletteOpen(true)}
            className="flex items-center gap-2 px-3 py-2 bg-white hover:bg-stone-100 text-stone-700 rounded-xl border border-stone-200 text-xs font-medium transition shadow-2xs cursor-pointer"
          >
            <Search className="w-3.5 h-3.5 text-stone-700" />
            <span>Comandos (Ctrl+K)</span>
          </button>
        </div>
      </div>

      {/* Admin Quick Meta Strip */}
      <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-2xs mb-6 text-xs flex flex-wrap gap-4 items-center justify-between">
        <div className="flex items-center gap-2 text-stone-700">
          <Mail className="w-4 h-4 text-stone-700" />
          <span>{currentAdmin.email}</span>
        </div>
        {currentAdmin.phone && (
          <div className="flex items-center gap-2 text-stone-700">
            <Phone className="w-4 h-4 text-stone-700" />
            <span>{currentAdmin.phone}</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-stone-700">
          <Key className="w-4 h-4 text-rose-500" />
          <span>PIN: {currentAdmin.pin || '••••••'}</span>
        </div>
        <div className="flex items-center gap-2 text-stone-700 font-mono text-[11px]">
          <Shield className="w-3.5 h-3.5 text-emerald-600" />
          <span>{rbac.getEffectivePermissions(currentAdmin).length} Permissões Ativas</span>
        </div>
      </div>

      {/* 2.12 & 2.15: Modular Navigation Bar */}
      <div className="mb-6 overflow-x-auto pb-1">
        <div className="flex items-center gap-1.5 p-1 bg-stone-200/60 rounded-2xl w-max">
          {authorizedModules.map(mod => {
            const Icon = mod.icon;
            const isActive = currentModule.id === mod.id;
            return (
              <button
                key={mod.id}
                type="button"
                onClick={() => setActiveModuleId(mod.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  isActive
                    ? 'bg-white text-stone-900 shadow-xs border border-stone-200/60'
                    : 'text-stone-700 hover:text-stone-900 hover:bg-stone-200/50'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-rose-600' : 'text-stone-700'}`} />
                <span>{mod.shortTitle}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2.13: Progressive Light-First Module Container */}
      <div className="flex-1">
        <Suspense
          fallback={
            <div className="bg-white rounded-2xl p-12 border border-stone-200 shadow-2xs flex flex-col items-center justify-center text-stone-700 text-xs">
              <Loader2 className="w-6 h-6 animate-spin text-rose-600 mb-2" />
              <p>Carregando módulo {currentModule.title}...</p>
            </div>
          }
        >
          <ActiveComponent
            currentAdmin={currentAdmin}
            dynamicAdmins={dynamicAdmins}
            onAddAdmin={onAddAdmin}
            onToggleStatus={onToggleStatus}
            onDeleteAdmin={onDeleteAdmin}
          />
        </Suspense>
      </div>
    </div>
  );
};
