import React, { useState } from 'react';
import { ModuleProps } from '../moduleRegistry';
import { AdminRole, AdminUser, AdminPermission } from '../../../types';
import { RbacService, ROLE_PERMISSIONS_MAP } from '../../../services/admin/rbacService';
import { AuditService } from '../../../services/admin/auditService';
import { TaskService } from '../../../services/admin/taskService';
import {
  Users,
  Shield,
  UserPlus,
  CheckCircle2,
  XCircle,
  Trash2,
  Search,
  Filter,
  UserCheck,
  Building,
  Layers,
  Crown,
  Key,
  Lock,
  Mail,
  Phone,
  ArrowRight,
  Copy,
  Plus,
  Edit2
} from 'lucide-react';

interface MockUser {
  id: string;
  name: string;
  email: string;
  country: string;
  verified: boolean;
  status: 'active' | 'restricted' | 'suspended' | 'banned';
  joinedAt: string;
  matchScore?: number;
  restrictionReason?: string;
}

const INITIAL_MOCK_USERS: MockUser[] = [
  { id: 'usr_ao_01', name: 'Yara Van-Dúnem', email: 'yara.vd@luanda.ao', country: 'AO', verified: true, status: 'active', joinedAt: '2026-01-14' },
  { id: 'usr_br_02', name: 'Lucas Silveira', email: 'lucas.silva@rio.br', country: 'BR', verified: true, status: 'active', joinedAt: '2026-02-01' },
  { id: 'usr_pt_03', name: 'Beatriz Fonseca', email: 'bia.fonseca@porto.pt', country: 'PT', verified: false, status: 'restricted', joinedAt: '2026-02-10', restrictionReason: 'Mensagens temporariamente pausadas' },
  { id: 'usr_mz_04', name: 'Élcio Chissano', email: 'elcio.c@maputo.mz', country: 'MZ', verified: true, status: 'active', joinedAt: '2026-02-18' },
  { id: 'usr_cv_05', name: 'Janira Delgado', email: 'janira.d@praia.cv', country: 'CV', verified: true, status: 'active', joinedAt: '2026-02-22' },
  { id: 'usr_st_06', name: 'Manuel Trindade', email: 'manuel.t@saotome.st', country: 'ST', verified: false, status: 'active', joinedAt: '2026-03-01' }
];

interface CustomRoleDef {
  id: string;
  name: string;
  description: string;
  isSystem: boolean;
  active: boolean;
  permissions: AdminPermission[];
}

const INITIAL_ROLES: CustomRoleDef[] = [
  {
    id: 'founder',
    name: 'Founder (Deus Fundador)',
    description: 'Acesso irrestrito e autoridade máxima de governança.',
    isSystem: true,
    active: true,
    permissions: ROLE_PERMISSIONS_MAP['founder'] || []
  },
  {
    id: 'super_admin',
    name: 'Super Admin',
    description: 'Gestão operacional de módulos e supervisão de equipa.',
    isSystem: true,
    active: true,
    permissions: ROLE_PERMISSIONS_MAP['super_admin'] || []
  },
  {
    id: 'moderator',
    name: 'Moderator',
    description: 'Deliberação e revisão humana de denúncias Trust & Safety.',
    isSystem: true,
    active: true,
    permissions: ROLE_PERMISSIONS_MAP['moderator'] || []
  },
  {
    id: 'support',
    name: 'Support',
    description: 'Atendimento e verificação de utilizadores finais.',
    isSystem: true,
    active: true,
    permissions: ROLE_PERMISSIONS_MAP['support'] || []
  },
  {
    id: 'custom_growth_lead',
    name: 'Growth & Territory Lead',
    description: 'Especialista em expansão territorial CPLP e campanhas.',
    isSystem: false,
    active: true,
    permissions: ['growth:read', 'growth:manage', 'product:flags:read', 'tasks:create']
  }
];

export const PeopleModule: React.FC<ModuleProps & { activeSubmoduleId?: string }> = ({
  currentAdmin,
  dynamicAdmins = [],
  onAddAdmin,
  onToggleStatus,
  onDeleteAdmin,
  activeSubmoduleId = 'utilizadores'
}) => {
  const [userList, setUserList] = useState<MockUser[]>(INITIAL_MOCK_USERS);
  const [selectedUser, setSelectedUser] = useState<MockUser | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [countryFilter, setCountryFilter] = useState('ALL');
  const [adminTab, setAdminTab] = useState<'ativos' | 'suspensos' | 'convites' | 'historico'>('ativos');

  // Roles state
  const [roles, setRoles] = useState<CustomRoleDef[]>(INITIAL_ROLES);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');

  // Add Admin Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<AdminRole>('moderator');
  const [team, setTeam] = useState<AdminUser['team']>('trust_safety');
  const [pin, setPin] = useState('');

  const rbac = RbacService.getInstance();
  const canManageAdmins = rbac.can(currentAdmin, 'admin:manage');

  const filteredUsers = userList.filter(u => {
    const matchQuery = u.name.toLowerCase().includes(searchQuery.toLowerCase()) || u.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCountry = countryFilter === 'ALL' || u.country === countryFilter;
    return matchQuery && matchCountry;
  });

  const handleApplyRestriction = (userId: string, type: 'restricted' | 'suspended') => {
    setUserList(prev =>
      prev.map(u => {
        if (u.id === userId) {
          const updated: MockUser = { ...u, status: type, restrictionReason: `Restrição ${type} aplicada por ${currentAdmin.displayName || currentAdmin.name}` };
          AuditService.getInstance().logEvent(currentAdmin, {
            module: 'people',
            resourceType: 'user_account',
            resourceId: userId,
            action: `APPLY_${type.toUpperCase()}`,
            newState: updated,
            justification: `Restrição aplicada pelo operador`
          });
          return updated;
        }
        return u;
      })
    );
    if (selectedUser?.id === userId) {
      setSelectedUser(prev => prev ? { ...prev, status: type } : null);
    }
  };

  const handleRemoveRestriction = (userId: string) => {
    setUserList(prev =>
      prev.map(u => {
        if (u.id === userId) {
          const updated: MockUser = { ...u, status: 'active', restrictionReason: undefined };
          AuditService.getInstance().logEvent(currentAdmin, {
            module: 'people',
            resourceType: 'user_account',
            resourceId: userId,
            action: 'REMOVE_RESTRICTION',
            newState: updated,
            justification: `Restrição removida pelo operador`
          });
          return updated;
        }
        return u;
      })
    );
    if (selectedUser?.id === userId) {
      setSelectedUser(prev => prev ? { ...prev, status: 'active', restrictionReason: undefined } : null);
    }
  };

  const handleForwardToReview = (user: MockUser) => {
    TaskService.getInstance().createTask(
      {
        title: `[REVISÃO OPERACIONAL] Analisar perfil de ${user.name} (${user.country})`,
        description: `Verificar histórico e denúncias do utilizador ${user.id} (${user.email}).`,
        category: 'trust',
        priority: 'high'
      },
      currentAdmin
    );
    alert(`Utilizador ${user.name} encaminhado para fila de revisão operacional!`);
  };

  const handleCreateAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !pin.trim()) return;

    if (onAddAdmin) {
      onAddAdmin({
        displayName: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        role,
        team,
        status: 'active',
        pin: pin.trim()
      });
      setShowAddModal(false);
      setName('');
      setEmail('');
      setPhone('');
      setPin('');
    }
  };

  const handleDuplicateRole = (roleDef: CustomRoleDef) => {
    const duplicated: CustomRoleDef = {
      id: `role_${Date.now()}`,
      name: `${roleDef.name} (Cópia)`,
      description: `Baseada em ${roleDef.name}`,
      isSystem: false,
      active: true,
      permissions: [...roleDef.permissions]
    };
    setRoles(prev => [...prev, duplicated]);
    AuditService.getInstance().logEvent(currentAdmin, {
      module: 'governance',
      resourceType: 'rbac_role',
      resourceId: duplicated.id,
      action: 'DUPLICATE_ROLE',
      justification: `Duplicação da função ${roleDef.name}`
    });
  };

  const handleToggleRoleActive = (roleId: string) => {
    setRoles(prev =>
      prev.map(r => {
        if (r.id === roleId && !r.isSystem) {
          return { ...r, active: !r.active };
        }
        return r;
      })
    );
  };

  const currentTab = activeSubmoduleId || 'utilizadores';

  return (
    <div className="space-y-6 text-stone-900">
      {/* Header */}
      <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
            PESSOAS · Utilizadores & Equipa
          </span>
          <span className="text-xs text-stone-700">Utilizadores · Administradores · Funções · Permissões · Equipas</span>
        </div>
        <h2 className="text-base font-bold text-stone-900 mt-1">Gestão de Pessoas & Matriz de Autoridade</h2>
        <p className="text-xs text-stone-700 mt-0.5 max-w-xl">
          Supervisão de contas de utilizadores finais, governação da equipa de administradores e definição estrita de papéis e permissões RBAC.
        </p>
      </div>

      {/* SUBMODULE: UTILIZADORES */}
      {currentTab === 'utilizadores' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs">
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between mb-4">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-stone-700 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Pesquisar por nome ou e-mail..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:outline-rose-600"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Filter className="w-3.5 h-3.5 text-stone-700" />
                <select
                  value={countryFilter}
                  onChange={e => setCountryFilter(e.target.value)}
                  className="text-xs bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 font-medium"
                >
                  <option value="ALL">Todos os Países CPLP</option>
                  <option value="AO">Angola (AO)</option>
                  <option value="BR">Brasil (BR)</option>
                  <option value="PT">Portugal (PT)</option>
                  <option value="MZ">Moçambique (MZ)</option>
                  <option value="CV">Cabo Verde (CV)</option>
                  <option value="ST">São Tomé (ST)</option>
                </select>
              </div>
            </div>

            {/* Users Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-stone-200 text-stone-700 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3">Utilizador</th>
                    <th className="py-2.5 px-3">País</th>
                    <th className="py-2.5 px-3">Estado</th>
                    <th className="py-2.5 px-3">Registo</th>
                    <th className="py-2.5 px-3 text-right">Ações Operacionais</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredUsers.map(user => (
                    <tr key={user.id} className="hover:bg-stone-50/80 transition">
                      <td className="py-3 px-3">
                        <div className="font-bold text-stone-900">{user.name}</div>
                        <div className="text-[11px] text-stone-700">{user.email}</div>
                      </td>
                      <td className="py-3 px-3 font-mono font-bold">{user.country}</td>
                      <td className="py-3 px-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          user.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : user.status === 'restricted'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {user.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-stone-700">{user.joinedAt}</td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedUser(user)}
                            className="px-2 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded font-semibold cursor-pointer"
                          >
                            Ver Perfil
                          </button>
                          {user.status === 'active' ? (
                            <button
                              type="button"
                              onClick={() => handleApplyRestriction(user.id, 'restricted')}
                              className="px-2 py-1 bg-amber-50 text-amber-800 hover:bg-amber-100 rounded font-semibold cursor-pointer"
                            >
                              Restringir
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleRemoveRestriction(user.id)}
                              className="px-2 py-1 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 rounded font-semibold cursor-pointer"
                            >
                              Restaurar
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleForwardToReview(user)}
                            className="px-2 py-1 bg-rose-50 text-rose-800 hover:bg-rose-100 rounded font-semibold cursor-pointer"
                          >
                            Revisão
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Profile Modal */}
          {selectedUser && (
            <div className="p-5 rounded-2xl bg-white border border-stone-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                <h3 className="text-xs font-bold text-stone-900">Perfil & Histórico Operacional Permitido</h3>
                <button
                  type="button"
                  onClick={() => setSelectedUser(null)}
                  className="text-stone-700 hover:text-stone-900 text-xs font-semibold cursor-pointer"
                >
                  Fechar
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div><strong>ID:</strong> <span className="font-mono text-stone-700">{selectedUser.id}</span></div>
                <div><strong>Nome:</strong> {selectedUser.name}</div>
                <div><strong>País:</strong> {selectedUser.country}</div>
                <div><strong>Verificado:</strong> {selectedUser.verified ? 'Sim (Biometria OK)' : 'Não'}</div>
                <div><strong>Status Atual:</strong> {selectedUser.status}</div>
                <div><strong>Data de Registo:</strong> {selectedUser.joinedAt}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUBMODULE: ADMINISTRADORES */}
      {currentTab === 'administradores' && (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2 border-b border-stone-200 pb-3">
            {(['ativos', 'suspensos', 'convites', 'historico'] as const).map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => setAdminTab(tab)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold uppercase tracking-wider cursor-pointer transition ${
                  adminTab === tab
                    ? 'bg-rose-50 text-rose-800 border border-rose-200 font-bold'
                    : 'text-stone-700 hover:bg-stone-100'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Founder Hero Card */}
          <div className="p-5 rounded-2xl bg-stone-900 text-white shadow-md border border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <Crown className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm">Marcelo Truman</span>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-400 text-stone-950 uppercase">
                    Deus Fundador
                  </span>
                </div>
                <span className="text-xs text-stone-400 mt-0.5 block">
                  silamarco217@gmail.com · Autoridade Máxima & Governança CPLP
                </span>
              </div>
            </div>

            <div className="text-right text-xs text-stone-400">
              <span className="text-emerald-400 font-bold">● Sessão Master Autenticada</span>
            </div>
          </div>

          {/* Team Admins Header */}
          <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-stone-900">Equipa Administrativa</h3>
                <p className="text-xs text-stone-700 mt-0.5">
                  {dynamicAdmins.length} administradores adicionais cadastrados na rede.
                </p>
              </div>

              {canManageAdmins && (
                <button
                  type="button"
                  onClick={() => setShowAddModal(true)}
                  className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer flex items-center gap-1.5"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>+ Novo Administrador</span>
                </button>
              )}
            </div>

            {/* Modal Add Admin */}
            {showAddModal && (
              <form onSubmit={handleCreateAdmin} className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-3">
                <h4 className="text-xs font-bold text-stone-900">Registar Novo Operador Administrativo</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-stone-700 block mb-1">Nome Completo</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="Ex: João Baptista"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-stone-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-stone-700 block mb-1">E-mail Operacional</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="joao@encontrol.cplp"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-stone-200 rounded-lg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] text-stone-700 block mb-1">Função / Papel</label>
                    <select
                      value={role}
                      onChange={e => setRole(e.target.value as AdminRole)}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-stone-200 rounded-lg"
                    >
                      <option value="super_admin">Super Admin</option>
                      <option value="moderator">Moderator</option>
                      <option value="support">Support</option>
                      <option value="engineer">Engineer</option>
                      <option value="finance_lead">Finance Lead</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-stone-700 block mb-1">Equipa</label>
                    <select
                      value={team}
                      onChange={e => setTeam(e.target.value as any)}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-stone-200 rounded-lg"
                    >
                      <option value="trust_safety">Trust & Safety</option>
                      <option value="support">Support</option>
                      <option value="operations">Operations</option>
                      <option value="engineering">Engineering</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-stone-700 block mb-1">PIN Numérico (6 Dígitos)</label>
                    <input
                      type="password"
                      required
                      maxLength={6}
                      value={pin}
                      onChange={e => setPin(e.target.value)}
                      placeholder="123456"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-stone-200 rounded-lg font-mono"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-3 py-1 text-xs text-stone-700 hover:bg-stone-200 rounded-lg cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg cursor-pointer"
                  >
                    Cadastrar Administrador
                  </button>
                </div>
              </form>
            )}

            {/* List Admins */}
            {dynamicAdmins.length === 0 ? (
              <div className="py-8 text-center text-xs text-stone-700">
                Nenhum administrador adicional cadastrado. Clique no botão acima para adicionar operadores.
              </div>
            ) : (
              <div className="space-y-3">
                {dynamicAdmins.map(admin => (
                  <div key={admin.id} className="p-4 rounded-xl bg-stone-50 border border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-stone-900">{admin.displayName || admin.name}</span>
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800 uppercase">
                          {admin.role}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          admin.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200 text-stone-700'
                        }`}>
                          {admin.status}
                        </span>
                      </div>
                      <span className="text-xs text-stone-700 mt-0.5 block">{admin.email} · Equipa: {admin.team || 'Geral'}</span>
                    </div>

                    {canManageAdmins && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onToggleStatus && onToggleStatus(admin.id)}
                          className="px-2.5 py-1 text-xs font-semibold rounded bg-white border border-stone-200 hover:bg-stone-100 text-stone-700 cursor-pointer"
                        >
                          {admin.status === 'active' ? 'Suspender' : 'Ativar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteAdmin && onDeleteAdmin(admin.id)}
                          className="p-1 text-stone-700 hover:text-rose-600 cursor-pointer"
                          title="Excluir Administrador"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBMODULE: FUNÇÕES */}
      {currentTab === 'funcoes' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-stone-900">Catálogo de Funções & Papéis (Roles)</h3>
                <p className="text-xs text-stone-700 mt-0.5">
                  Governança das roles com ações de Criar, Editar, Duplicar e Desativar.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {roles.map(roleDef => (
                <div key={roleDef.id} className="p-4 rounded-xl bg-stone-50 border border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-stone-900">{roleDef.name}</span>
                      {roleDef.isSystem && (
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-stone-200 text-stone-700 uppercase">
                          Sistema
                        </span>
                      )}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        roleDef.active ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200 text-stone-700'
                      }`}>
                        {roleDef.active ? 'Ativa' : 'Inativa'}
                      </span>
                    </div>
                    <p className="text-xs text-stone-700 mt-1">{roleDef.description}</p>
                    <span className="text-[10px] text-stone-700 mt-1 block">
                      {roleDef.permissions.length} permissões atribuídas
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleDuplicateRole(roleDef)}
                      className="px-2.5 py-1 text-xs font-semibold rounded bg-white border border-stone-200 hover:bg-stone-100 text-stone-700 cursor-pointer flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Duplicar</span>
                    </button>
                    {!roleDef.isSystem && (
                      <button
                        type="button"
                        onClick={() => handleToggleRoleActive(roleDef.id)}
                        className="px-2.5 py-1 text-xs font-semibold rounded bg-white border border-stone-200 hover:bg-stone-100 text-stone-700 cursor-pointer"
                      >
                        {roleDef.active ? 'Desativar' : 'Ativar'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SUBMODULE: PERMISSÕES */}
      {currentTab === 'permissoes' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-stone-900">Matriz Operacional de Permissões</h3>
            <p className="text-xs text-stone-700">
              Mapeamento de autoridade operacional entre recursos fundamentais e verbos de ação: READ, WRITE, REVIEW, MANAGE.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-stone-200 text-stone-700 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3">Recurso</th>
                    <th className="py-2.5 px-3 text-center">READ</th>
                    <th className="py-2.5 px-3 text-center">WRITE</th>
                    <th className="py-2.5 px-3 text-center">REVIEW</th>
                    <th className="py-2.5 px-3 text-center">MANAGE</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 font-mono">
                  {[
                    { res: 'Users', r: true, w: false, rev: true, m: false },
                    { res: 'Reports (Trust & Safety)', r: true, w: false, rev: true, m: true },
                    { res: 'Admins & Equipa', r: true, w: false, rev: false, m: false },
                    { res: 'Integrations & Adaptadores', r: true, w: false, rev: false, m: true },
                    { res: 'Growth & Campanhas', r: true, w: true, rev: false, m: true },
                    { res: 'Finance & Gateways', r: true, w: false, rev: true, m: true },
                    { res: 'Engineering & Jobs', r: true, w: false, rev: false, m: true }
                  ].map(row => (
                    <tr key={row.res} className="hover:bg-stone-50">
                      <td className="py-2.5 px-3 font-sans font-bold text-stone-900">{row.res}</td>
                      <td className="py-2.5 px-3 text-center text-emerald-600 font-bold">{row.r ? '✓' : '—'}</td>
                      <td className="py-2.5 px-3 text-center text-emerald-600 font-bold">{row.w ? '✓' : '—'}</td>
                      <td className="py-2.5 px-3 text-center text-emerald-600 font-bold">{row.rev ? '✓' : '—'}</td>
                      <td className="py-2.5 px-3 text-center text-emerald-600 font-bold">{row.m ? '✓' : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBMODULE: EQUIPAS */}
      {currentTab === 'equipas' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
              <Building className="w-4 h-4 text-rose-600" />
              Equipas & Filas Associadas
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { name: 'Trust & Safety', members: 4, queues: ['Denúncias Novas', 'Em Análise', 'Biometria'], tasks: 2 },
                { name: 'Support', members: 6, queues: ['Dúvidas CPLP', 'Recuperação de Contas'], tasks: 1 },
                { name: 'Operations', members: 3, queues: ['Incidentes Ativos', 'Aprovações'], tasks: 3 },
                { name: 'Engineering', members: 5, queues: ['Jobs de Cache', 'Alertas de Latência'], tasks: 1 }
              ].map(team => (
                <div key={team.name} className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-stone-900">{team.name}</span>
                    <span className="text-[10px] font-mono bg-white px-2 py-0.5 rounded border border-stone-200">
                      {team.members} membros
                    </span>
                  </div>
                  <div className="text-xs text-stone-700">
                    <strong>Filas:</strong> {team.queues.join(', ')}
                  </div>
                  <div className="text-xs text-stone-700">
                    <strong>Tarefas ativas:</strong> <span className="font-mono font-bold text-rose-600">{team.tasks}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
