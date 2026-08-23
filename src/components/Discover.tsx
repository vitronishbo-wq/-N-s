import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  UserProfile,
  UserPreferences,
  PrivacySettings,
  InteractionSignals,
  DiscoveryCandidate,
  ExpansionLevel
} from '../types';
import { DiscoveryAppService } from '../services/discoveryService';
import { ClientAiAdapter } from '../services/aiAdapter';
import { CPLP_COUNTRIES } from '../constants';
import { Heart, X, Sparkles, MapPin, Globe, ShieldAlert, CheckCircle2, SlidersHorizontal, RefreshCw, Layers } from 'lucide-react';
import confetti from 'canvas-confetti';

interface DiscoverProps {
  myProfile: UserProfile;
  myPreferences: UserPreferences;
  privacy: PrivacySettings;
  signals: InteractionSignals;
  candidatePool: UserProfile[];
  onLike: (targetCandidate: DiscoveryCandidate) => void;
  onPass: (targetCandidate: DiscoveryCandidate) => void;
  onReport: (targetCandidate: DiscoveryCandidate) => void;
  onRecordSeen: (targetUid: string) => void;
  onOpenPreferences?: () => void;
}

export const Discover: React.FC<DiscoverProps> = ({
  myProfile,
  myPreferences,
  privacy,
  signals,
  candidatePool,
  onLike,
  onPass,
  onReport,
  onRecordSeen,
  onOpenPreferences
}) => {
  const discoveryService = DiscoveryAppService.getInstance();
  const aiAdapter = ClientAiAdapter.getInstance();

  const [candidates, setCandidates] = useState<DiscoveryCandidate[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [availability, setAvailability] = useState<'AVAILABLE' | 'LOW_AVAILABILITY' | 'NO_CANDIDATES'>('AVAILABLE');
  const [expansionLevel, setExpansionLevel] = useState<ExpansionLevel>('CITY');
  const [scarcityMessage, setScarcityMessage] = useState<string | undefined>(undefined);
  const [selectiveAiExplanation, setSelectiveAiExplanation] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  // 4.1, 4.19, 4.22: Run session-aware discovery feed through DiscoveryAppService
  useEffect(() => {
    const state = discoveryService.evaluateDiscoveryFeed(
      candidatePool,
      myProfile,
      myPreferences,
      privacy,
      signals
    );

    setCandidates(state.candidates);
    setCurrentIndex(state.currentIndex);
    setAvailability(state.availability);
    setExpansionLevel(state.currentExpansionLevel);
    setScarcityMessage(state.scarcityMessage);
  }, [
    candidatePool,
    myProfile,
    myPreferences,
    privacy,
    signals.passedCandidateUids.length,
    signals.likedCandidateUids.length,
    signals.blockedUids.length
  ]);

  const currentCandidate: DiscoveryCandidate | undefined = candidates[currentIndex];
  const targetProfile = currentCandidate?.profile;

  // 2.14: Light-First: Load current candidate media and next thumbnail
  useEffect(() => {
    if (candidates.length > 0 && currentIndex < candidates.length) {
      discoveryService.preloadCandidateMedia(candidates.slice(currentIndex, currentIndex + 2));
    }
  }, [currentIndex, candidates]);

  // Record seen candidate
  useEffect(() => {
    if (targetProfile) {
      onRecordSeen(targetProfile.uid);
      discoveryService.markSeenInSession(targetProfile.uid);
    }
  }, [targetProfile?.uid]);

  // 4.15 & 4.16: AI Explainer Contract via ClientAiAdapter
  const handleRequestAiInsight = async () => {
    if (!targetProfile || loadingAi) return;
    setLoadingAi(true);

    try {
      const explanation = await aiAdapter.explainAffinity({
        userA: {
          displayName: myProfile.displayName,
          countryName: myProfile.countryName,
          cityName: myProfile.cityName,
          intent: myProfile.intent,
          interests: myProfile.interests
        },
        userB: {
          displayName: targetProfile.displayName,
          countryName: targetProfile.countryName,
          cityName: targetProfile.cityName,
          intent: targetProfile.intent,
          interests: targetProfile.interests
        }
      });
      setSelectiveAiExplanation(explanation);
    } catch {
      setSelectiveAiExplanation('Sintonia autêntica entre os objetivos e raízes culturais lusófonas.');
    } finally {
      setLoadingAi(false);
    }
  };

  const handleLike = () => {
    if (!currentCandidate) return;
    confetti({
      particleCount: 35,
      spread: 60,
      origin: { y: 0.8 },
      colors: ['#e11d48', '#fb7185', '#f43f5e']
    });
    onLike(currentCandidate);
    setSelectiveAiExplanation(null);
    setCurrentIndex(prev => prev + 1);
  };

  const handlePass = () => {
    if (!currentCandidate) return;
    onPass(currentCandidate);
    setSelectiveAiExplanation(null);
    setCurrentIndex(prev => prev + 1);
  };

  // 4.23: NO_CANDIDATES state handling
  if (!targetProfile || currentIndex >= candidates.length || availability === 'NO_CANDIDATES') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-sm mx-auto">
        <div className="w-16 h-16 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center mb-4 text-rose-600 shadow-2xs">
          <Globe className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-stone-900 mb-2">Descoberta em dia</h3>
        <p className="text-xs text-stone-600 leading-relaxed mb-6">
          {scarcityMessage || 'Você já visualizou todos os perfis compatíveis neste momento.'}
        </p>

        <div className="flex flex-col gap-2 w-full">
          <button
            type="button"
            onClick={() => {
              discoveryService.resetSession();
              setCurrentIndex(0);
            }}
            className="w-full py-2.5 bg-stone-900 text-white rounded-xl font-medium text-xs hover:bg-stone-800 transition flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Rever Perfis</span>
          </button>

          {onOpenPreferences && (
            <button
              type="button"
              onClick={onOpenPreferences}
              className="w-full py-2.5 bg-white border border-stone-200 text-stone-700 rounded-xl font-medium text-xs hover:bg-stone-50 transition flex items-center justify-center gap-2"
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>Ajustar Preferências</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  const countryInfo = CPLP_COUNTRIES[targetProfile.countryCode] || { flag: '🌍', name: targetProfile.countryName };

  const expansionLabelMap: Record<ExpansionLevel, string> = {
    CITY: 'Foco Local',
    REGION: 'Região',
    COUNTRY: 'Nacional',
    CPLP_SELECTED: 'CPLP Selecionados',
    CPLP_GLOBAL: 'Comunidade Global CPLP'
  };

  return (
    <div className="flex-1 flex flex-col justify-between max-w-md mx-auto w-full p-4 pb-20 sm:pb-6">
      {/* Top micro header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-xs">
          <span className="flex items-center gap-1.5 font-semibold text-stone-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Comunidade Ativa</span>
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full border border-stone-200">
            <Layers className="w-3 h-3 text-stone-500" />
            {expansionLabelMap[expansionLevel] || expansionLevel}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onReport(currentCandidate)}
          title="Denunciar / Segurança"
          className="text-stone-400 hover:text-stone-700 p-1.5 rounded-lg transition"
        >
          <ShieldAlert className="w-4 h-4" />
        </button>
      </div>

      {/* 4.22: Progressive Low Availability Banner */}
      {availability === 'LOW_AVAILABILITY' && (
        <div className="mb-2 px-3 py-1.5 bg-amber-50 border border-amber-200/80 rounded-xl text-[11px] text-amber-800 flex items-center justify-between">
          <span>Poucos perfis restantes no raio principal.</span>
          <span className="font-semibold text-amber-900">Expandido</span>
        </div>
      )}

      {/* Discovery Main Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={targetProfile.uid}
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="relative bg-white rounded-2xl overflow-hidden border border-stone-200 shadow-sm flex flex-col"
        >
          {/* Main Photo with Gradient & Overlay Badges */}
          <div className="relative aspect-4/5 w-full bg-stone-100 overflow-hidden">
            <img
              src={targetProfile.profilePhoto}
              alt={targetProfile.displayName}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />

            {/* Deterministic Compatibility Badge */}
            <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm border border-white/40">
              <span className="text-xs font-bold text-rose-600">{currentCandidate.compatibilityScore}%</span>
              <span className="text-[11px] font-medium text-stone-700">compatível</span>
            </div>

            {/* Country Flag Badge */}
            <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-md px-2.5 py-1 rounded-full text-white text-xs font-medium flex items-center gap-1.5 border border-white/10">
              <span className="text-base leading-none">{countryInfo.flag}</span>
              <span>{targetProfile.countryName}</span>
            </div>

            {/* In-Card Title Info */}
            <div className="absolute bottom-3 left-4 right-4 text-white">
              <div className="flex items-baseline gap-2">
                <h2 className="text-2xl font-bold tracking-tight">{targetProfile.displayName}</h2>
                <span className="text-lg font-light text-white/90">{targetProfile.age}</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-white/80 mt-0.5">
                <MapPin className="w-3.5 h-3.5" />
                <span>{targetProfile.cityName}, {targetProfile.countryName}</span>
              </div>
            </div>
          </div>

          {/* Details Section */}
          <div className="p-4 space-y-3 bg-white">
            {/* Bio text */}
            <p className="text-xs text-stone-700 leading-relaxed font-normal">
              {targetProfile.bio || 'Interessado em conexões autênticas na comunidade lusófona.'}
            </p>

            {/* Interests Chips */}
            <div className="flex flex-wrap gap-1.5">
              {targetProfile.interests.map(item => {
                const isShared = myProfile.interests.includes(item);
                return (
                  <span
                    key={item}
                    className={`text-[11px] px-2.5 py-1 rounded-full font-medium whitespace-nowrap ${
                      isShared
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : 'bg-stone-100 text-stone-600'
                    }`}
                  >
                    {item}
                  </span>
                );
              })}
            </div>

            {/* Explainability & Reasons Box */}
            <div className="bg-stone-50 rounded-xl p-3 border border-stone-200/80 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-800">
                  <Sparkles className="w-3.5 h-3.5 text-rose-500" />
                  <span>Sintonia & Motivos de Compatibilidade</span>
                </div>
                {!selectiveAiExplanation && (
                  <button
                    type="button"
                    onClick={handleRequestAiInsight}
                    disabled={loadingAi}
                    className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer"
                  >
                    {loadingAi ? 'Analisando...' : 'Detalhar IA'}
                  </button>
                )}
              </div>

              {/* Clear reason pills */}
              <div className="flex flex-wrap gap-1 pt-1">
                {currentCandidate.compatibilityReasons.map((reason, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 text-[11px] text-stone-700 bg-white px-2 py-0.5 rounded-md border border-stone-200"
                  >
                    <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                    {reason}
                  </span>
                ))}
              </div>

              {/* Selective AI Expansion if requested */}
              {selectiveAiExplanation && (
                <p className="text-xs text-stone-700 leading-relaxed italic pt-1 border-t border-stone-200/60 mt-1">
                  {selectiveAiExplanation}
                </p>
              )}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Simple Two-Button Action Controls */}
      <div className="flex items-center justify-center gap-6 mt-4">
        <button
          type="button"
          id="btn-discover-pass"
          onClick={handlePass}
          aria-label="Próximo"
          className="w-14 h-14 rounded-full bg-white border border-stone-200 shadow-sm flex items-center justify-center text-stone-500 hover:text-stone-800 hover:bg-stone-50 transition active:scale-95 cursor-pointer"
        >
          <X className="w-6 h-6" />
        </button>

        <button
          type="button"
          id="btn-discover-like"
          onClick={handleLike}
          aria-label="Gostei"
          className="w-16 h-16 rounded-full bg-rose-600 shadow-md flex items-center justify-center text-white hover:bg-rose-700 transition active:scale-95 ring-4 ring-rose-100 cursor-pointer"
        >
          <Heart className="w-7 h-7 fill-white" />
        </button>
      </div>
    </div>
  );
};
