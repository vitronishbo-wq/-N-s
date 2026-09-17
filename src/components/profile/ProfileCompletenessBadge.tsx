import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { calculateProfileCompleteness, ProfileImprovementItem } from '../../services/profileCompleteness';
import { UserProfile } from '../../types';
import { Sparkles, ChevronRight, CheckCircle2, Circle, ArrowUpRight, ShieldCheck, X } from 'lucide-react';

interface ProfileCompletenessBadgeProps {
  profile: Partial<UserProfile> | null | undefined;
  onOpenImprovementModal?: () => void;
  className?: string;
  compact?: boolean;
}

export const ProfileCompletenessBadge: React.FC<ProfileCompletenessBadgeProps> = ({
  profile,
  onOpenImprovementModal,
  className = '',
  compact = false
}) => {
  const result = calculateProfileCompleteness(profile);

  const getScoreColor = () => {
    if (result.score >= 90) return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    if (result.score >= 70) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    if (result.score >= 40) return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
    return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
  };

  const getBarColor = () => {
    if (result.score >= 90) return 'bg-amber-500';
    if (result.score >= 70) return 'bg-emerald-500';
    if (result.score >= 40) return 'bg-blue-500';
    return 'bg-rose-500';
  };

  if (compact) {
    return (
      <button
        type="button"
        onClick={onOpenImprovementModal}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold transition active:scale-95 cursor-pointer ${getScoreColor()} ${className}`}
        title="Ver percentual de aperfeiçoamento do perfil"
      >
        <Sparkles className="w-3.5 h-3.5 shrink-0" />
        <span>{result.score}%</span>
      </button>
    );
  }

  return (
    <div
      onClick={onOpenImprovementModal}
      className={`bg-stone-900/90 border border-stone-800 hover:border-stone-700/80 rounded-2xl p-3.5 transition cursor-pointer group shadow-sm ${className}`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-xl border ${getScoreColor()}`}>
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-white">Perfil {result.levelLabel}</span>
              <span className="text-xs font-mono font-bold text-stone-300">({result.score}%)</span>
            </div>
            <p className="text-[11px] text-stone-400 leading-tight mt-0.5">{result.multiplierText}</p>
          </div>
        </div>
        <div className="flex items-center text-stone-400 group-hover:text-white transition">
          <ChevronRight className="w-4 h-4" />
        </div>
      </div>

      {/* Barra de Progresso com Transição Macia */}
      <div className="w-full bg-stone-800 h-2 rounded-full overflow-hidden">
        <motion.div
          className={`h-full ${getBarColor()}`}
          initial={{ width: 0 }}
          animate={{ width: `${result.score}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
};

interface ProfileImprovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  onNavigateToSection?: (sectionId: string) => void;
}

export const ProfileImprovementModal: React.FC<ProfileImprovementModalProps> = ({
  isOpen,
  onClose,
  profile,
  onNavigateToSection
}) => {
  if (!isOpen) return null;

  const result = calculateProfileCompleteness(profile);

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-stone-900 border border-stone-800 rounded-3xl max-w-md w-full p-5 shadow-2xl text-white space-y-4 max-h-[90vh] flex flex-col"
      >
        {/* Cabeçalho */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Aperfeiçoamento do Perfil</h3>
              <p className="text-xs text-stone-400">Quanto mais completo, mais ligações recíprocas</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-stone-800 text-stone-400 hover:text-white hover:bg-stone-700 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Estatística Principal */}
        <div className="bg-stone-950/70 border border-stone-800 rounded-2xl p-4 flex items-center justify-between gap-4">
          <div>
            <div className="text-2xl font-black text-white flex items-baseline gap-1">
              <span>{result.score}%</span>
              <span className="text-xs font-normal text-stone-400">concluído</span>
            </div>
            <p className="text-xs text-stone-300 font-semibold mt-0.5">{result.levelLabel}</p>
            <p className="text-[11px] text-stone-400 mt-1">{result.multiplierText}</p>
          </div>
          <div className="text-right">
            <span className="text-xs font-bold text-stone-400">
              {result.completedCount} de {result.totalCount} passos
            </span>
          </div>
        </div>

        {/* Checklist com passos de melhoria suave */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
          {result.items.map((item) => (
            <div
              key={item.id}
              className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition ${
                item.completed
                  ? 'bg-stone-950/40 border-stone-800/80 text-stone-400'
                  : 'bg-stone-850/80 border-stone-700 hover:border-stone-600 text-stone-200'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {item.completed ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                ) : (
                  <Circle className="w-5 h-5 text-stone-500 shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-bold truncate ${item.completed ? 'line-through text-stone-500' : 'text-white'}`}>
                      {item.title}
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-stone-800 text-stone-300">
                      +{item.points}%
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-400 truncate">{item.description}</p>
                </div>
              </div>

              {!item.completed && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onNavigateToSection?.(item.category);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shrink-0 flex items-center gap-1 transition shadow-xs"
                >
                  <span>{item.actionText}</span>
                  <ArrowUpRight className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="pt-2 border-t border-stone-800 text-center">
          <p className="text-[11px] text-stone-400">
            Perfis autênticos fortalecem o laço de confiança na comunidade ÉNós CPLP.
          </p>
        </div>
      </motion.div>
    </div>
  );
};
