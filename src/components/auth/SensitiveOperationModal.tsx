import React, { useState } from 'react';
import { authService } from '../../services/authService';
import { SensitiveOperationType } from '../../types';
import { ShieldAlert, Lock, X, AlertTriangle, KeyRound, Download, Trash2, Mail } from 'lucide-react';

interface SensitiveOperationModalProps {
  isOpen: boolean;
  onClose: () => void;
  operationType: SensitiveOperationType;
  onConfirm: () => Promise<void>;
  title?: string;
  description?: string;
}

export const SensitiveOperationModal: React.FC<SensitiveOperationModalProps> = ({
  isOpen,
  onClose,
  operationType,
  onConfirm,
  title,
  description
}) => {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const authUser = authService.getCurrentUser();
  const isAnonymous = authUser?.isAnonymous ?? true;

  const getOperationConfig = () => {
    switch (operationType) {
      case 'delete_account':
        return {
          icon: <Trash2 className="w-5 h-5 text-rose-600" />,
          defaultTitle: 'Eliminar Conta e Todos os Dados',
          defaultDesc: 'Esta ação é irreversível. Todas as suas conversas, preferências e pontuação relacional serão permanentemente destruídos.',
          btnText: 'Confirmar Eliminação Definitiva',
          btnClass: 'bg-rose-600 hover:bg-rose-700 text-white'
        };
      case 'change_password':
        return {
          icon: <KeyRound className="w-5 h-5 text-amber-600" />,
          defaultTitle: 'Alterar Senha da Conta',
          defaultDesc: 'Para sua segurança, confirme sua senha atual antes de definir uma nova senha.',
          btnText: 'Verificar Senha',
          btnClass: 'bg-stone-900 hover:bg-stone-800 text-white'
        };
      case 'change_email':
        return {
          icon: <Mail className="w-5 h-5 text-blue-600" />,
          defaultTitle: 'Alterar E-mail Principal',
          defaultDesc: 'Digite sua senha atual para autorizar a modificação do seu e-mail de acesso.',
          btnText: 'Autorizar Alteração',
          btnClass: 'bg-stone-900 hover:bg-stone-800 text-white'
        };
      case 'export_data_archive':
        return {
          icon: <Download className="w-5 h-5 text-emerald-600" />,
          defaultTitle: 'Exportar Arquivo de Dados Pessoais',
          defaultDesc: 'Gera um arquivo JSON completo com seus dados de perfil, histórico e configurações (Portabilidade GDPR/LGPD).',
          btnText: 'Descarregar Arquivo',
          btnClass: 'bg-emerald-600 hover:bg-emerald-700 text-white'
        };
      case 'revoke_all_sessions':
        return {
          icon: <ShieldAlert className="w-5 h-5 text-amber-600" />,
          defaultTitle: 'Encerrar Todas as Outras Sessões',
          defaultDesc: 'Todos os outros telemóveis e computadores conectados serão desautenticados imediatamente.',
          btnText: 'Encerrar Outros Dispositivos',
          btnClass: 'bg-amber-600 hover:bg-amber-700 text-white'
        };
      default:
        return {
          icon: <Lock className="w-5 h-5 text-stone-700" />,
          defaultTitle: 'Confirmação de Segurança',
          defaultDesc: 'Confirme suas credenciais para executar esta operação sensível.',
          btnText: 'Confirmar Operação',
          btnClass: 'bg-stone-900 hover:bg-stone-800 text-white'
        };
    }
  };

  const config = getOperationConfig();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      // If user has a permanent email/password account, demand reauthentication
      if (!isAnonymous && authUser?.email) {
        if (!password) {
          setErrorMessage('Por favor, digite a sua senha atual.');
          setLoading(false);
          return;
        }

        const reauthResult = await authService.reauthenticate(password);
        if (!reauthResult.success) {
          setErrorMessage(reauthResult.error || 'Senha incorreta.');
          setLoading(false);
          return;
        }
      }

      // Execute sensitive operation callback
      await onConfirm();
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Falha ao executar operação.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-stone-200 space-y-4 animate-in fade-in zoom-in duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-stone-100">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-stone-100 rounded-xl">
              {config.icon}
            </div>
            <div>
              <h3 className="font-bold text-sm text-stone-900 leading-tight">
                {title || config.defaultTitle}
              </h3>
              <span className="text-[10px] font-semibold text-rose-700 uppercase tracking-wider">
                Autenticação Forte · Step-Up Auth
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Warning Notice */}
        <p className="text-xs text-stone-600 leading-relaxed">
          {description || config.defaultDesc}
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          {!isAnonymous && authUser?.email && (
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-stone-800 block">
                Digite sua senha atual ({authUser.email}):
              </label>
              <div className="relative">
                <Lock className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  placeholder="Sua senha de acesso"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-rose-500 font-mono"
                  required
                  autoFocus
                />
              </div>
            </div>
          )}

          {isAnonymous && (
            <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 flex items-start gap-2 text-[11px] text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>Você está conectado como convidado anônimo neste dispositivo.</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-2.5 bg-rose-50 text-rose-700 text-xs rounded-xl border border-rose-200 font-medium">
              {errorMessage}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 px-3 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs rounded-xl transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`flex-1 py-2 px-3 font-bold text-xs rounded-xl transition shadow-xs flex items-center justify-center gap-1.5 ${config.btnClass}`}
            >
              {loading ? (
                <span className="animate-spin text-xs">⏳</span>
              ) : (
                <span>{config.btnText}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
