import React, { useState } from 'react';
import { ModuleProps } from '../moduleRegistry';
import { AdminRole, AdminUser } from '../../../types';
import { RbacService, ROLE_PERMISSIONS_MAP } from '../../../services/admin/rbacService';
import { AuditService } from '../../../services/admin/auditService';
import { Shield, UserPlus, CheckCircle2, XCircle, Trash2, Key, Users } from 'lucide-react';

export const TeamModule: React.FC<ModuleProps> = ({
  currentAdmin,
  dynamicAdmins = [],
  onAddAdmin,
  onToggleStatus,
  onDeleteAdmin
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<AdminRole>('moderator');
  const [team, setTeam] = useState<AdminUser['team']>('trust_safety');
  const [pin, setPin] = useState('');

  const rbac = RbacService.getInstance();
  const canManageAdmins = rbac.can(currentAdmin, 'admin:manage');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !pin.trim()) return;

    if (onAddAdmin) {
      onAddAdmin({
        displayName: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        role,
        team,
        pin: pin.trim(),
        status: 'active'
      });

      AuditService.getInstance().logMutation(currentAdmin, {
        module: 'rbac',
        resourceType: 'admin_user',
        resourceId: email.trim().toLowerCase(),
        action: 'CREATE_ADMIN_USER',
        newState: { displayName: name.trim(), role, team, status: 'active' },
        justification: `Adicionado à equipa ${team} com o papel ${role}`
      });
    }

    setName('');
    setEmail('');
    setPhone('');
    setPin('');
    setShowAddModal(false);
  };

  return (
    <div className="space-y-6 text-stone-900">
      {/* Overview Banner */}
      <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
              Governança Formal RBAC
            </span>
            <span className="text-xs text-stone-700">Role → Permissions → Policy</span>
          </div>
          <h2 className="text-base font-bold text-stone-900 mt-1">Gestão de Equipa & Autorização</h2>
          <p className="text-xs text-stone-700 mt-0.5 max-w-xl">
            Founder é um papel formal no grafo de permissões. Todas as mutações e acessos são auditados e validados por políticas.
          </p>
        </div>

        {canManageAdmins && onAddAdmin && (
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold flex items-center gap-2 transition shadow-xs self-start sm:self-auto cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Criar Administrador</span>
          </button>
        )}
      </div>

      {/* Roles & Permissions Breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {(['founder', 'super_admin', 'moderator', 'engineer', 'finance_lead', 'support'] as AdminRole[]).map(r => {
          const perms = ROLE_PERMISSIONS_MAP[r] || [];
          return (
            <div key={r} className="bg-white rounded-xl p-3.5 border border-stone-200 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-900 uppercase">
                  {r.replace('_', ' ')}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-stone-100 text-stone-600">
                  {perms.length} permissões
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {perms.slice(0, 4).map(p => (
                  <span key={p} className="text-[9px] px-1.5 py-0.5 bg-stone-100 text-stone-700 rounded font-mono">
                    {p}
                  </span>
                ))}
                {perms.length > 4 && (
                  <span className="text-[9px] px-1.5 py-0.5 text-stone-700 font-mono">
                    +{perms.length - 4} mais
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Dynamic Admins List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-stone-900">
            Membros da Equipa Administrativa ({dynamicAdmins.length + 1})
          </h3>
          <span className="text-xs text-stone-700">Acesso via PIN dedicado</span>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200 divide-y divide-stone-100 overflow-hidden shadow-2xs">
          {/* Current Admin Row */}
          <div className="p-4 flex items-center justify-between gap-3 text-xs bg-stone-50/60">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-stone-900">{currentAdmin.displayName || currentAdmin.name} (Você)</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold uppercase">
                  {currentAdmin.role.replace('_', ' ')}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-medium">
                  Sessão Ativa
                </span>
              </div>
              <div className="text-stone-700 mt-1 flex flex-wrap items-center gap-3 text-[11px]">
                <span>{currentAdmin.email}</span>
                {currentAdmin.phone && <span>· {currentAdmin.phone}</span>}
                <span>· PIN: <span className="font-mono font-bold text-stone-900">{currentAdmin.pin || '••••••'}</span></span>
              </div>
            </div>
          </div>

          {/* Other Dynamic Admins */}
          {dynamicAdmins.map(admin => {
            const isSelf = admin.id === currentAdmin.id;
            return (
              <div key={admin.id} className="p-4 flex items-center justify-between gap-3 text-xs">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-stone-900">{admin.displayName || admin.name}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 font-medium uppercase">
                      {admin.role.replace('_', ' ')}
                    </span>
                    {admin.team && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium capitalize">
                        {admin.team.replace('_', ' ')}
                      </span>
                    )}
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        admin.status === 'active'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-rose-50 text-rose-700'
                      }`}
                    >
                      {admin.status === 'active' ? 'Ativo' : 'Suspenso'}
                    </span>
                  </div>
                  <div className="text-stone-700 mt-1 flex items-center gap-3 text-[11px]">
                    <span>{admin.email}</span>
                    {admin.phone && <span>· {admin.phone}</span>}
                    <span>· PIN: <span className="font-mono text-stone-900 font-bold">{admin.pin}</span></span>
                  </div>
                </div>

                {canManageAdmins && !isSelf && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    {onToggleStatus && (
                      <button
                        type="button"
                        onClick={() => onToggleStatus(admin.id)}
                        className="p-1.5 rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50 transition cursor-pointer"
                        title={admin.status === 'active' ? 'Suspender' : 'Ativar'}
                      >
                        {admin.status === 'active' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-600" />
                        )}
                      </button>
                    )}
                    {onDeleteAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Remover administrador ${admin.displayName || admin.name}?`)) {
                            onDeleteAdmin(admin.id);
                          }
                        }}
                        className="p-1.5 rounded-lg border border-stone-200 text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Creation Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-stone-200 p-5 max-w-sm w-full shadow-2xl">
            <h3 className="text-sm font-bold text-stone-900 mb-1">Criar Novo Administrador</h3>
            <p className="text-xs text-stone-700 mb-4">
              Defina os dados, papel formal e o PIN de acesso.
            </p>

            <form onSubmit={handleCreate} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-stone-700 mb-1">Nome Completo</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Ex: João Baptista"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block font-medium text-stone-700 mb-1">E-mail</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="admin@exemplo.com"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block font-medium text-stone-700 mb-1">Telefone (Opcional)</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+244..."
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-medium text-stone-700 mb-1">Papel Formal</label>
                  <select
                    value={role}
                    onChange={e => setRole(e.target.value as AdminRole)}
                    className="w-full px-2.5 py-2 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                  >
                    <option value="super_admin">Super Admin</option>
                    <option value="moderator">Moderador</option>
                    <option value="engineer">Engenheiro</option>
                    <option value="finance_lead">Líder Financeiro</option>
                    <option value="support">Suporte</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-stone-700 mb-1">Equipa</label>
                  <select
                    value={team}
                    onChange={e => setTeam(e.target.value as AdminUser['team'])}
                    className="w-full px-2.5 py-2 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                  >
                    <option value="trust_safety">Trust & Safety</option>
                    <option value="engineering">Engenharia</option>
                    <option value="product">Produto</option>
                    <option value="finance">Finanças</option>
                    <option value="governance">Governança</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-stone-700 mb-1">PIN de Teclado (4 a 8 dígitos)</label>
                <input
                  type="text"
                  required
                  maxLength={8}
                  value={pin}
                  onChange={e => setPin(e.target.value)}
                  placeholder="Ex: 889900"
                  className="w-full px-3 py-2 font-mono bg-stone-50 border border-stone-300 rounded-xl text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-2 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-50 font-medium cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold shadow-xs cursor-pointer"
                >
                  Criar Administrador
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
