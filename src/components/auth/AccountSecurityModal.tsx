import React, { useState, useEffect } from 'react';
import { authService } from '../../services/authService';
import { SensitiveOperationModal } from './SensitiveOperationModal';
import { AuthUser, UserSession, SensitiveOperationType, UserProfile } from '../../types';
import {
  Shield,
  KeyRound,
  Smartphone,
  Mail,
  Lock,
  LogOut,
  AlertTriangle,
  CheckCircle2,
  X,
  Download,
  Trash2,
  RefreshCw,
  Globe,
  Radio,
  ExternalLink,
  Laptop
} from 'lucide-react';

interface AccountSecurityModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  onAccountLinked?: (email: string) => void;
}

export const AccountSecurityModal: React.FC<AccountSecurityModalProps> = ({
  isOpen,
  onClose,
  profile,
  onAccountLinked
}) => {
  const [activeTab, setActiveTab] = useState<'account' | 'sessions' | 'security'>('account');
  const [authUser, setAuthUser] = useState<AuthUser | null>(() => authService.getCurrentUser());
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  // Forms State
  const [authMode, setAuthMode] = useState<'link' | 'login' | 'register' | 'recover'>('link');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Sensitive Step-up Modal State
  const [sensitiveModalConfig, setSensitiveModalConfig] = useState<{
    isOpen: boolean;
    operationType: SensitiveOperationType;
    action: () => Promise<void>;
  }>({
    isOpen: false,
    operationType: 'export_data_archive',
    action: async () => {}
  });

  useEffect(() => {
    const unsub = authService.subscribe((u) => {
      setAuthUser(u);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (isOpen && profile?.uid) {
      loadSessions();
      setFeedbackMessage(null);
    }
  }, [isOpen, profile?.uid]);

  const loadSessions = async () => {
    if (!profile?.uid) return;
    setLoadingSessions(true);
    try {
      const list = await authService.fetchUserSessions(profile.uid);
      setSessions(list);
    } finally {
      setLoadingSessions(false);
    }
  };

  if (!isOpen) return null;

  const isAnonymous = authUser?.isAnonymous ?? true;

  const handleLinkOrRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackMessage(null);

    if (!email.trim() || !password) {
      setFeedbackMessage({ text: 'Por favor, preencha todos os campos.', type: 'error' });
      return;
    }

    if (password.length < 6) {
      setFeedbackMessage({ text: 'A senha deve conter pelo menos 6 caracteres.', type: 'error' });
      return;
    }

    setIsSubmitting(true);
    try {
      if (authMode === 'link') {
        // Link anonymous to permanent
        const result = await authService.linkAnonymousToPermanentEmail(email, password);
        if (result.success) {
          setFeedbackMessage({
            text: 'Conta vinculada com sucesso! Seu perfil, conversas e pontuação relacional foram preservados.',
            type: 'success'
          });
          if (onAccountLinked) onAccountLinked(email.trim());
          await loadSessions();
        } else {
          setFeedbackMessage({ text: result.error || 'Erro ao vincular conta.', type: 'error' });
        }
      } else if (authMode === 'register') {
        // New Registration
        const result = await authService.registerWithEmailPassword(email, password, profile.displayName);
        if (result.success) {
          setFeedbackMessage({
            text: 'Conta criada com sucesso! Enviámos um link de confirmação para o seu e-mail.',
            type: 'success'
          });
          if (onAccountLinked) onAccountLinked(email.trim());
          await loadSessions();
        } else {
          setFeedbackMessage({ text: result.error || 'Erro ao criar conta.', type: 'error' });
        }
      } else if (authMode === 'login') {
        // Direct Login
        const result = await authService.loginWithEmailPassword(email, password);
        if (result.success) {
          setFeedbackMessage({
            text: 'Sessão iniciada com sucesso!',
            type: 'success'
          });
          await loadSessions();
        } else {
          setFeedbackMessage({ text: result.error || 'Falha ao iniciar sessão.', type: 'error' });
        }
      } else if (authMode === 'recover') {
        // Password Recovery
        const result = await authService.sendPasswordRecovery(email);
        if (result.success) {
          setFeedbackMessage({
            text: result.message || 'Instruções de recuperação enviadas para o seu e-mail.',
            type: 'success'
          });
        } else {
          setFeedbackMessage({ text: result.error || 'Falha ao enviar recuperação.', type: 'error' });
        }
      }
    } catch (err: any) {
      setFeedbackMessage({ text: err?.message || 'Erro inesperado.', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLinkGoogle = async () => {
    setFeedbackMessage(null);
    setIsSubmitting(true);
    try {
      const result = await authService.linkWithGoogle();
      if (result.success) {
        setFeedbackMessage({
          text: 'Conta Google vinculada com sucesso!',
          type: 'success'
        });
        if (onAccountLinked && authUser?.email) onAccountLinked(authUser.email);
        await loadSessions();
      } else {
        setFeedbackMessage({ text: result.error || 'Erro ao vincular conta Google.', type: 'error' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    if (!profile?.uid) return;
    const confirmed = window.confirm('Deseja realmente revogar o acesso deste dispositivo?');
    if (!confirmed) return;

    const ok = await authService.revokeSession(sessionId, profile.uid);
    if (ok) {
      setFeedbackMessage({ text: 'Sessão revogada com sucesso.', type: 'success' });
      await loadSessions();
    }
  };

  const triggerSensitiveOperation = (
    operationType: SensitiveOperationType,
    action: () => Promise<void>
  ) => {
    setSensitiveModalConfig({
      isOpen: true,
      operationType,
      action
    });
  };

  const handleExportData = () => {
    triggerSensitiveOperation('export_data_archive', async () => {
      const archive = await authService.exportUserDataArchive(profile.uid);
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(archive, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `enos_meus_dados_${profile.uid}_${Date.now()}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      setFeedbackMessage({ text: 'Arquivo de dados pessoais transferido com sucesso!', type: 'success' });
    });
  };

  const handleRevokeAllOtherSessions = () => {
    triggerSensitiveOperation('revoke_all_sessions', async () => {
      const ok = await authService.revokeAllOtherSessions(profile.uid);
      if (ok) {
        setFeedbackMessage({ text: 'Todas as outras sessões foram encerradas.', type: 'success' });
        await loadSessions();
      }
    });
  };

  const handleDeleteAccount = () => {
    triggerSensitiveOperation('delete_account', async () => {
      const res = await authService.deleteAccount();
      if (res.success) {
        alert('Sua conta foi permanentemente eliminada. Agradecemos pelo tempo partilhado no ÉNós.');
        window.location.reload();
      } else {
        setFeedbackMessage({ text: res.error || 'Falha ao eliminar conta.', type: 'error' });
      }
    });
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] flex flex-col shadow-2xl border border-stone-200 animate-in fade-in zoom-in duration-150 overflow-hidden">
          {/* Header */}
          <div className="p-4 bg-stone-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-rose-600 rounded-xl text-white">
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm leading-tight">Segurança & Gestão de Identidade</h3>
                <p className="text-[11px] text-stone-300">Autenticação persistente e soberania de dados</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-stone-200 bg-stone-50 px-2 pt-1 gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('account')}
              className={`flex-1 py-2 text-xs font-bold rounded-t-xl transition flex items-center justify-center gap-1.5 ${
                activeTab === 'account'
                  ? 'bg-white text-rose-600 border-t-2 border-rose-600 shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Conta & Acesso</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('sessions')}
              className={`flex-1 py-2 text-xs font-bold rounded-t-xl transition flex items-center justify-center gap-1.5 ${
                activeTab === 'sessions'
                  ? 'bg-white text-rose-600 border-t-2 border-rose-600 shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Sessões ({sessions.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('security')}
              className={`flex-1 py-2 text-xs font-bold rounded-t-xl transition flex items-center justify-center gap-1.5 ${
                activeTab === 'security'
                  ? 'bg-white text-rose-600 border-t-2 border-rose-600 shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Segurança Forte</span>
            </button>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {feedbackMessage && (
              <div
                className={`p-3 rounded-xl text-xs font-medium border flex items-start gap-2 ${
                  feedbackMessage.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}
              >
                {feedbackMessage.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <span>{feedbackMessage.text}</span>
              </div>
            )}

            {/* TAB 1: IDENTIDADE & CONTA */}
            {activeTab === 'account' && (
              <div className="space-y-4">
                {/* Account Status Card */}
                <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-stone-700 uppercase tracking-wide">
                      Estado da Identidade
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isAnonymous
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {isAnonymous ? 'Convidado Temporário' : 'Conta Permanente Vinculada'}
                    </span>
                  </div>

                  <div className="text-xs text-stone-900 space-y-1">
                    <div className="flex items-center justify-between font-mono text-[11px]">
                      <span className="text-stone-500 font-sans">E-mail:</span>
                      <span className="font-bold">{authUser?.email || 'Nenhum e-mail vinculado'}</span>
                    </div>
                    <div className="flex items-center justify-between font-mono text-[11px]">
                      <span className="text-stone-500 font-sans">UID Permanente:</span>
                      <span className="text-stone-600 truncate max-w-[180px]">{profile.uid}</span>
                    </div>
                    {!isAnonymous && (
                      <div className="flex items-center justify-between font-mono text-[11px]">
                        <span className="text-stone-500 font-sans">Verificação de E-mail:</span>
                        <span className={authUser?.emailVerified ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold'}>
                          {authUser?.emailVerified ? '✓ Verificado' : 'Pendente de Confirmação'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Sub-Tabs: Link / Register / Login / Recover */}
                <div className="space-y-3">
                  <div className="grid grid-cols-4 gap-1 p-1 bg-stone-100 rounded-xl text-[11px] font-bold">
                    <button
                      type="button"
                      onClick={() => setAuthMode('link')}
                      className={`py-1.5 rounded-lg transition ${
                        authMode === 'link' ? 'bg-white text-rose-600 shadow-2xs' : 'text-stone-600'
                      }`}
                    >
                      Vincular
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuthMode('login')}
                      className={`py-1.5 rounded-lg transition ${
                        authMode === 'login' ? 'bg-white text-rose-600 shadow-2xs' : 'text-stone-600'
                      }`}
                    >
                      Entrar
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuthMode('register')}
                      className={`py-1.5 rounded-lg transition ${
                        authMode === 'register' ? 'bg-white text-rose-600 shadow-2xs' : 'text-stone-600'
                      }`}
                    >
                      Criar
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuthMode('recover')}
                      className={`py-1.5 rounded-lg transition ${
                        authMode === 'recover' ? 'bg-white text-rose-600 shadow-2xs' : 'text-stone-600'
                      }`}
                    >
                      Recuperar
                    </button>
                  </div>

                  <form onSubmit={handleLinkOrRegister} className="space-y-3 pt-1">
                    <div>
                      <label className="text-[11px] font-bold text-stone-800 block mb-1">
                        Endereço de E-mail
                      </label>
                      <input
                        type="email"
                        placeholder="exemplo@dominio.cplp"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-rose-500 font-mono"
                        required
                      />
                    </div>

                    {authMode !== 'recover' && (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-bold text-stone-800">
                            Senha de Acesso
                          </label>
                          {authMode === 'login' && (
                            <button
                              type="button"
                              onClick={() => setAuthMode('recover')}
                              className="text-[10px] text-rose-600 hover:underline"
                            >
                              Esqueceu a senha?
                            </button>
                          )}
                        </div>
                        <input
                          type="password"
                          placeholder="Mínimo 6 caracteres"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-rose-500 font-mono"
                          required
                        />
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white font-bold text-xs rounded-xl transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {isSubmitting ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : authMode === 'link' ? (
                        <span>Vincular Conta Permanente</span>
                      ) : authMode === 'login' ? (
                        <span>Iniciar Sessão com E-mail</span>
                      ) : authMode === 'register' ? (
                        <span>Criar Nova Conta Permanente</span>
                      ) : (
                        <span>Enviar Link de Recuperação</span>
                      )}
                    </button>
                  </form>

                  {/* Google OAuth Alternative */}
                  <div className="pt-2 border-t border-stone-100">
                    <button
                      type="button"
                      onClick={handleLinkGoogle}
                      disabled={isSubmitting}
                      className="w-full py-2.5 bg-white hover:bg-stone-50 border border-stone-300 text-stone-800 font-bold text-xs rounded-xl transition shadow-2xs flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Globe className="w-4 h-4 text-blue-600" />
                      <span>{isAnonymous ? 'Vincular com Conta Google' : 'Conectar com Google'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: SESSÕES & DISPOSITIVOS */}
            {activeTab === 'sessions' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-stone-900">Dispositivos Conectados</h4>
                    <p className="text-[10px] text-stone-500">Monitorização em tempo real via Firestore</p>
                  </div>
                  <button
                    type="button"
                    onClick={loadSessions}
                    disabled={loadingSessions}
                    className="p-1.5 rounded-lg bg-stone-100 text-stone-600 hover:bg-stone-200 transition"
                    title="Atualizar sessões"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingSessions ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {sessions.map((sess) => (
                    <div
                      key={sess.sessionId}
                      className={`p-3 rounded-xl border transition flex items-start justify-between ${
                        sess.isCurrent
                          ? 'bg-rose-50/70 border-rose-200 shadow-2xs'
                          : sess.status === 'revoked'
                          ? 'bg-stone-50 border-stone-200 opacity-60'
                          : 'bg-white border-stone-200'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="p-2 bg-stone-100 rounded-lg text-stone-700 shrink-0 mt-0.5">
                          {sess.os === 'Android' || sess.os === 'iOS' ? (
                            <Smartphone className="w-4 h-4" />
                          ) : (
                            <Laptop className="w-4 h-4" />
                          )}
                        </div>
                        <div className="text-xs">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-stone-900">{sess.deviceName}</span>
                            {sess.isCurrent && (
                              <span className="text-[9px] font-bold bg-rose-600 text-white px-1.5 py-0.2 rounded-full">
                                Este Dispositivo
                              </span>
                            )}
                            {sess.status === 'revoked' && (
                              <span className="text-[9px] font-bold bg-stone-200 text-stone-700 px-1.5 py-0.2 rounded-full">
                                Revogado
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-stone-500 font-mono mt-0.5">
                            {sess.browser} · {sess?.lastActiveAt ? new Date(sess.lastActiveAt).toLocaleString('pt-PT') : '-'}
                          </p>
                        </div>
                      </div>

                      {!sess.isCurrent && sess.status === 'active' && (
                        <button
                          type="button"
                          onClick={() => handleRevokeSession(sess.sessionId)}
                          className="px-2.5 py-1 text-[10px] font-bold text-rose-700 hover:bg-rose-100 rounded-lg transition border border-rose-200"
                        >
                          Revogar
                        </button>
                      )}
                    </div>
                  ))}

                  {sessions.length === 0 && !loadingSessions && (
                    <div className="p-4 text-center text-xs text-stone-500 bg-stone-50 rounded-xl border border-stone-200">
                      Nenhuma outra sessão ativa encontrada.
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-stone-100">
                  <button
                    type="button"
                    onClick={handleRevokeAllOtherSessions}
                    className="w-full py-2 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5"
                  >
                    <LogOut className="w-3.5 h-3.5 text-amber-600" />
                    <span>Encerrar Todas as Outras Sessões</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB 3: OPERAÇÕES SENSÍVEIS & SEGURANÇA FORTE */}
            {activeTab === 'security' && (
              <div className="space-y-3">
                <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-1.5">
                  <h4 className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-rose-600" />
                    <span>Autenticação Forte para Ações Críticas</span>
                  </h4>
                  <p className="text-[11px] text-stone-600 leading-relaxed">
                    Operações que afetam a sua identidade, privacidade ou integridade de dados exigem re-confirmação criptográfica de credenciais.
                  </p>
                </div>

                {/* Data Export Button */}
                <button
                  type="button"
                  onClick={handleExportData}
                  className="w-full p-3 bg-white hover:bg-stone-50 border border-stone-200 rounded-xl text-left transition flex items-center justify-between group shadow-2xs"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                      <Download className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-stone-900 block">Exportar Portabilidade de Dados</span>
                      <span className="text-[10px] text-stone-500">Descarregar cópia integral JSON (GDPR / LGPD)</span>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-emerald-700 group-hover:translate-x-0.5 transition">
                    Exportar →
                  </span>
                </button>

                {/* Sign Out Button */}
                <button
                  type="button"
                  onClick={async () => {
                    if (window.confirm('Deseja realmente terminar a sua sessão?')) {
                      await authService.signOutUser();
                      window.location.reload();
                    }
                  }}
                  className="w-full p-3 bg-white hover:bg-stone-50 border border-stone-200 rounded-xl text-left transition flex items-center justify-between group shadow-2xs"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-stone-100 rounded-lg text-stone-700">
                      <LogOut className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-stone-900 block">Terminar Sessão Neste Dispositivo</span>
                      <span className="text-[10px] text-stone-500">Revoga o token local e regressa ao início</span>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-stone-700 group-hover:translate-x-0.5 transition">
                    Sair →
                  </span>
                </button>

                {/* Delete Account (Destructive) */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleDeleteAccount}
                    className="w-full p-3 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl text-left transition flex items-center justify-between group shadow-2xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-rose-100 rounded-lg text-rose-700">
                        <Trash2 className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-rose-950 block">Eliminar Conta & Dados (Direito ao Esquecimento)</span>
                        <span className="text-[10px] text-rose-700">Destruição permanente e irrevogável</span>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-rose-700 group-hover:translate-x-0.5 transition">
                      Eliminar →
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sensitive Step-Up Challenge Modal */}
      <SensitiveOperationModal
        isOpen={sensitiveModalConfig.isOpen}
        onClose={() => setSensitiveModalConfig(prev => ({ ...prev, isOpen: false }))}
        operationType={sensitiveModalConfig.operationType}
        onConfirm={sensitiveModalConfig.action}
      />
    </>
  );
};
