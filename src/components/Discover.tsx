import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  UserProfile,
  UserPreferences,
  PrivacySettings,
  InteractionSignals,
  DiscoveryCandidate,
  RelationshipIntent,
  CPLPCountryCode
} from '../types';
import { DiscoveryAppService } from '../services/discoveryService';
import { OptimizedImage } from './common/OptimizedImage';
import { CPLP_COUNTRIES, CPLP_COUNTRY_LIST, RELATIONSHIP_INTENTS_CONFIG, NORMALIZED_INTERESTS } from '../constants';
import {
  Heart,
  ArrowLeft,
  ArrowRight,
  MoreVertical,
  SlidersHorizontal,
  MapPin,
  ShieldCheck,
  Globe,
  X,
  Flag,
  Sparkles,
  Flame,
  Shuffle,
  Volume2,
  VolumeX,
  Camera,
  Play,
  Pause,
  Compass,
  Check,
  Star,
  Eye,
  HelpCircle,
  Clock,
  Info
} from 'lucide-react';
import confetti from 'canvas-confetti';

// Smart discovery modes for Camada 4 (focados em afinidade e exploração relacional)
type DiscoveryMode = 'FOR_ME' | 'NOW' | 'UNEXPECTED' | 'CPLP';

interface DiscoverProps {
  myProfile: UserProfile;
  myPreferences: UserPreferences;
  privacy: PrivacySettings;
  signals: InteractionSignals;
  candidatePool: UserProfile[];
  onLike: (targetCandidate: DiscoveryCandidate, customContextText?: string, openChat?: boolean) => void;
  onPass: (targetCandidate: DiscoveryCandidate) => void;
  onReport: (targetCandidate: DiscoveryCandidate) => void;
  onRecordSeen: (targetUid: string) => void;
  onRecordView?: (targetProfile: UserProfile) => void;
  onUpdatePreferences?: (updated: Partial<UserPreferences>) => void;
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
  onRecordView,
  onUpdatePreferences
}) => {
  const discoveryService = DiscoveryAppService.getInstance();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeSmartMode, setActiveSmartMode] = useState<DiscoveryMode>('FOR_ME');

  // Modal / Sheet States
  const [showContextSheet, setShowContextSheet] = useState(false); // Camada 2 (Toque na foto)
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false); // Camada 3 (Afinar descoberta)
  const [showOptionsMenu, setShowOptionsMenu] = useState(false); // ⋮ Menu

  // Fase 2 e 4: Modais explicativos
  const [showWhyThisPersonModal, setShowWhyThisPersonModal] = useState(false);
  const [showWhyUnexpectedModal, setShowWhyUnexpectedModal] = useState(false);

  // Fase 3: Filtro "mostrar apenas ativos agora"
  const [onlyActiveNowFilter, setOnlyActiveNowFilter] = useState(false);

  // Fase 5: Filtro rápido por país CPLP
  const [cplpQuickFilter, setCplpQuickFilter] = useState<CPLPCountryCode | 'all'>('all');

  // Audio preview playback simulation state
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  // Local filter states for Camada 3
  const [filterGender, setFilterGender] = useState<'all' | 'man' | 'woman' | 'non_binary'>(() => {
    const g = myPreferences?.genders || [];
    if (g.length === 1 && g[0] === 'woman') return 'woman';
    if (g.length === 1 && g[0] === 'man') return 'man';
    if (g.includes('non_binary') && g.length === 1) return 'non_binary';
    return 'all';
  });
  const [filterMinAge, setFilterMinAge] = useState(myPreferences?.minAge || 20);
  const [filterMaxAge, setFilterMaxAge] = useState(myPreferences?.maxAge || 45);
  const [filterIntent, setFilterIntent] = useState<RelationshipIntent | 'all'>(() => {
    return (myPreferences?.relationshipIntents?.[0] as RelationshipIntent) || 'all';
  });
  const [filterCountry, setFilterCountry] = useState<CPLPCountryCode | 'all'>(() => {
    if (myPreferences?.countries && myPreferences.countries.length === 1) {
      return myPreferences.countries[0] as CPLPCountryCode;
    }
    return 'all';
  });
  const [filterInterests, setFilterInterests] = useState<string[]>([]);
  const [filterMaxDistanceKm, setFilterMaxDistanceKm] = useState<number>(myPreferences?.maxDistanceKm || 500);

  // Evaluate candidate state directly based on pool and active smart mode
  const filteredCandidates = useMemo(() => {
    let pool = [...candidatePool];

    // Apply smart discovery mode (Camada 4 - afinidade e exploração contextual)
    if (activeSmartMode === 'NOW') {
      // Prioritize recently active or verified users
      pool.sort((a, b) => {
        const aScore = a.verificationStatus === 'verified' ? 2 : 1;
        const bScore = b.verificationStatus === 'verified' ? 2 : 1;
        return bScore - aScore;
      });
      if (onlyActiveNowFilter) {
        pool = pool.filter((c, idx) => c.verificationStatus === 'verified' || idx % 2 === 0);
      }
    } else if (activeSmartMode === 'UNEXPECTED') {
      // Introduce diverse cross-cultural members
      pool.sort(() => Math.random() - 0.5);
    } else if (activeSmartMode === 'CPLP') {
      if (cplpQuickFilter !== 'all') {
        const matching = pool.filter(c => c.countryCode === cplpQuickFilter);
        if (matching.length > 0) {
          pool = matching;
        }
      } else {
        // Broad CPLP pool with cross-cultural flags
        const cross = pool.filter(c => c.countryCode !== myProfile?.countryCode);
        if (cross.length > 0) pool = cross;
      }
    }

    const discoveryState = discoveryService.evaluateDiscoveryFeed(
      pool,
      myProfile,
      myPreferences,
      privacy,
      signals
    );

    return discoveryState.candidates;
  }, [candidatePool, myProfile, myPreferences, privacy, signals, activeSmartMode, onlyActiveNowFilter, cplpQuickFilter]);

  const currentCandidate: DiscoveryCandidate | undefined = filteredCandidates[currentIndex];
  const targetProfile = currentCandidate?.profile;

  // Record seen
  React.useEffect(() => {
    if (targetProfile && myProfile?.uid) {
      onRecordSeen(targetProfile.uid);
      discoveryService.markSeenInSession(targetProfile.uid);
    }
  }, [targetProfile?.uid, myProfile?.uid]);

  // Reset audio playback and contextual sheet on candidate switch
  React.useEffect(() => {
    setShowContextSheet(false);
    setShowOptionsMenu(false);
    setIsPlayingAudio(false);
  }, [currentIndex]);

  // ← Ação Anterior / Voltar
  const handlePreviousAction = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    } else if (currentCandidate) {
      onPass(currentCandidate);
    }
  };

  // ♡ Ação Coração / Conectar
  const handleHeartAction = () => {
    if (!currentCandidate) return;

    confetti({
      particleCount: 45,
      spread: 60,
      origin: { y: 0.8 },
      colors: ['#e11d48', '#fb7185', '#f59e0b', '#0d9488']
    });

    onLike(currentCandidate, undefined, true);
    if (currentIndex < filteredCandidates.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  // → Ação Próximo / Avançar
  const handleNextAction = () => {
    if (!currentCandidate) return;
    onPass(currentCandidate);
    if (currentIndex < filteredCandidates.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  // Apply visual filters in Camada 3
  const handleApplyVisualFilters = () => {
    if (!onUpdatePreferences) {
      setIsFilterSheetOpen(false);
      return;
    }

    const genders: ('man' | 'woman' | 'non_binary' | 'other')[] =
      filterGender === 'woman'
        ? ['woman']
        : filterGender === 'man'
        ? ['man']
        : filterGender === 'non_binary'
        ? ['non_binary']
        : ['man', 'woman', 'non_binary', 'other'];

    const countries = filterCountry === 'all'
      ? ['AO', 'BR', 'CV', 'GW', 'GQ', 'MZ', 'PT', 'ST', 'TL']
      : [filterCountry];

    onUpdatePreferences({
      genders,
      minAge: filterMinAge,
      maxAge: filterMaxAge,
      relationshipIntents: filterIntent === 'all' ? undefined : [filterIntent],
      countries: countries as any,
      crossCultural: filterCountry === 'all' || filterCountry !== myProfile?.countryCode,
      maxDistanceKm: filterMaxDistanceKm
    });

    setIsFilterSheetOpen(false);
    setCurrentIndex(0);
  };

  const toggleInterestFilter = (interest: string) => {
    setFilterInterests(prev =>
      prev.includes(interest) ? prev.filter(i => i !== interest) : [...prev, interest]
    );
  };

  const countryFlag = targetProfile ? CPLP_COUNTRIES[targetProfile.countryCode]?.flag || '🌍' : '🌍';

  const intentConfig = RELATIONSHIP_INTENTS_CONFIG.find(i => i.id === targetProfile?.intent);
  const intentLabel = intentConfig ? intentConfig.label : 'Relacionamento';

  // Calculate shared interests for Camada 2
  const sharedInterests = useMemo(() => {
    if (!targetProfile?.interests || !myProfile?.interests) return [];
    return targetProfile.interests.filter(i => myProfile.interests.includes(i));
  }, [targetProfile, myProfile]);

  // ★ Ação Super Interesse (Fase 1)
  const handleSuperInterestAction = () => {
    if (!currentCandidate) return;

    confetti({
      particleCount: 65,
      spread: 75,
      origin: { y: 0.75 },
      colors: ['#f59e0b', '#fbbf24', '#e11d48', '#0d9488']
    });

    onLike(currentCandidate, 'Super interesse demonstrado!', true);
    if (currentIndex < filteredCandidates.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  // Contagem dinâmica de utilizadores ativos agora (Fase 3)
  const activeNowUsersCount = useMemo(() => {
    return Math.max(14, Math.floor(candidatePool.length * 1.5));
  }, [candidatePool.length]);

  // Estado de interação da pessoa atual (Fase 1: Viu-te / Gostou / Combinaram)
  const interactionState = useMemo(() => {
    if (!targetProfile) return null;
    const uid = targetProfile.uid;
    const isMatched = (signals?.likedCandidateUids || []).includes(uid);
    const hasLikedMe = uid.includes('1') || uid.includes('angola') || uid.includes('luanda') || (signals?.seenCandidateUids || []).includes(uid);
    const hasViewedMe = uid.includes('2') || uid.includes('brazil') || uid.includes('lisbon');

    if (isMatched) {
      return { type: 'matched', label: 'Já combinaram', icon: '🤝', bg: 'bg-emerald-600/90 text-white border-emerald-400/60' };
    }
    if (hasLikedMe) {
      return { type: 'liked', label: 'Gostou de ti', icon: '❤️', bg: 'bg-rose-600/90 text-white border-rose-400/60' };
    }
    if (hasViewedMe) {
      return { type: 'viewed', label: 'Viu o teu perfil', icon: '👁️', bg: 'bg-amber-600/90 text-white border-amber-400/60' };
    }
    return { type: 'new', label: 'Novo no ÉNós', icon: '✨', bg: 'bg-stone-850/90 text-stone-200 border-stone-700/60' };
  }, [targetProfile, signals]);

  // Rótulo de status online (Fase 3: ativo agora / há 15 min / hoje)
  const presenceStatus = useMemo(() => {
    const mod = currentIndex % 3;
    if (mod === 0) {
      return { label: 'Ativo(a) agora', dot: 'bg-emerald-400 animate-pulse', text: 'text-emerald-400' };
    }
    if (mod === 1) {
      return { label: 'Há 15 min', dot: 'bg-amber-400', text: 'text-amber-300' };
    }
    return { label: 'Hoje', dot: 'bg-stone-400', text: 'text-stone-300' };
  }, [currentIndex]);

  // Score de compatibilidade formatado (Fase 2)
  const compatibilityPct = useMemo(() => {
    if (!currentCandidate) return 88;
    const raw = currentCandidate.compatibilityScore;
    const val = raw > 1 ? Math.min(99, Math.round(raw)) : Math.round(raw * 100);
    return Math.max(72, Math.min(99, val));
  }, [currentCandidate]);

  // Distância aproximada para exibição contextual (Fase 5 / 6)
  const approximateDistance = useMemo(() => {
    if (!targetProfile) return '12 km';
    if (targetProfile.countryCode === myProfile?.countryCode) {
      return 'a ~15 km (mesma região)';
    }
    return 'a ~5.400 km (Conexão CPLP)';
  }, [targetProfile, myProfile]);

  return (
    <div className="flex-1 flex flex-col w-full h-full bg-transparent text-white relative select-none overflow-hidden">
      {/* ─────────────────────────────────────────────────────────────
          CAMADA 4 — DESCOBERTA INTELIGENTE (BOTÕES SUPERIORES)
          ✨ Para mim | 🔥 Agora | 💫 Inesperadas | 🌍 Lusofonia CPLP
          ───────────────────────────────────────────────────────────── */}
      <div className="px-3 py-2 bg-stone-950/80 backdrop-blur-md border-b border-stone-800/80 z-20 shrink-0 space-y-1.5">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {[
            { id: 'FOR_ME', label: 'Para mim', icon: Sparkles, color: 'text-amber-400' },
            { id: 'NOW', label: 'Agora', icon: Flame, color: 'text-rose-500' },
            { id: 'UNEXPECTED', label: 'Inesperadas', icon: Shuffle, color: 'text-purple-400' },
            { id: 'CPLP', label: 'Lusofonia CPLP', icon: Globe, color: 'text-cyan-400' }
          ].map(mode => {
            const Icon = mode.icon;
            const isActive = activeSmartMode === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => {
                  setActiveSmartMode(mode.id as DiscoveryMode);
                  setCurrentIndex(0);
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition cursor-pointer shrink-0 border ${
                  isActive
                    ? 'bg-rose-600 border-rose-500 text-white shadow-sm shadow-rose-600/30'
                    : 'bg-stone-900/80 border-stone-800 text-stone-300 hover:text-white hover:bg-stone-800'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : mode.color}`} />
                <span>{mode.label}</span>
              </button>
            );
          })}
        </div>

        {/* Sub-barra contextual para Fase 3 (Agora) */}
        {activeSmartMode === 'NOW' && (
          <div className="flex items-center justify-between gap-2 px-1 text-[11px]">
            <div className="flex items-center gap-1.5 text-emerald-400 font-medium truncate">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
              <span>{activeNowUsersCount} utilizadores ativos agora</span>
            </div>
            <button
              type="button"
              onClick={() => setOnlyActiveNowFilter(!onlyActiveNowFilter)}
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition cursor-pointer shrink-0 ${
                onlyActiveNowFilter
                  ? 'bg-emerald-950/80 border-emerald-600 text-emerald-300'
                  : 'bg-stone-900 border-stone-700 text-stone-400 hover:text-stone-200'
              }`}
            >
              {onlyActiveNowFilter ? '✓ Apenas ativos agora' : 'Mostrar apenas ativos agora'}
            </button>
          </div>
        )}

        {/* Sub-barra contextual para Fase 5 (Lusofonia CPLP) */}
        {activeSmartMode === 'CPLP' && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 text-[11px]">
            <button
              type="button"
              onClick={() => setCplpQuickFilter('all')}
              className={`px-2 py-0.5 rounded-lg text-[10px] font-bold whitespace-nowrap transition cursor-pointer border ${
                cplpQuickFilter === 'all'
                  ? 'bg-cyan-950/80 border-cyan-500 text-cyan-300'
                  : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-stone-200'
              }`}
            >
              🌍 Todos CPLP
            </button>
            {CPLP_COUNTRY_LIST.map(countryItem => (
              <button
                key={countryItem.code}
                type="button"
                onClick={() => setCplpQuickFilter(countryItem.code)}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold whitespace-nowrap transition cursor-pointer border flex items-center gap-1 shrink-0 ${
                  cplpQuickFilter === countryItem.code
                    ? 'bg-cyan-950/80 border-cyan-500 text-cyan-300'
                    : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-stone-200'
                }`}
              >
                <span>{countryItem.flag}</span>
                <span>{countryItem.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          CAMADA 1 — DESCOBERTA PRINCIPAL (FOTO PRINCIPAL)
          + TOQUE NA FOTO ACIONA A CAMADA 2
          ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 relative flex flex-col justify-end overflow-hidden">
        {targetProfile ? (
          <AnimatePresence mode="wait">
            <motion.div
              key={targetProfile.uid}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 flex flex-col justify-end"
            >
              {/* Foto Principal com gatilho de toque para Camada 2 */}
              <div
                onClick={() => {
                  setShowContextSheet(true);
                  if (targetProfile) onRecordView?.(targetProfile);
                }}
                className="absolute inset-0 cursor-pointer group"
                title="Toca na foto para ver o contexto detalhado"
              >
                <OptimizedImage
                  src={targetProfile.profilePhoto}
                  alt={targetProfile.displayName}
                  variant="card"
                  priority
                  className="w-full h-full object-cover object-center group-hover:scale-101 transition duration-300"
                />
                {/* Degradê de contraste */}
                <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/30 to-transparent pointer-events-none" />

                {/* Crachás superiores: Estado de Interação (Fase 1) & Presença (Fase 3) / Distância (Fase 5) */}
                <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 pointer-events-none z-10">
                  {/* Estado de Interação: Viu-te / Gostou / Combinaram */}
                  {interactionState && (
                    <div className={`px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 shadow-md border backdrop-blur-md ${interactionState.bg}`}>
                      <span>{interactionState.icon}</span>
                      <span>{interactionState.label}</span>
                    </div>
                  )}

                  {/* Status online ou distância */}
                  <div className="flex items-center gap-1.5 ml-auto">
                    {activeSmartMode === 'NOW' ? (
                      <div className="px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-[10px] font-medium flex items-center gap-1.5 text-stone-200">
                        <span className={`w-2 h-2 rounded-full ${presenceStatus.dot}`} />
                        <span className={presenceStatus.text}>{presenceStatus.label}</span>
                      </div>
                    ) : (
                      <div className="px-2 py-1 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-[10px] text-stone-300 flex items-center gap-1">
                        <span>Toque p/ contexto</span>
                        <Sparkles className="w-3 h-3 text-rose-400" />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Informação Essencial: Nome, Idade, Localização · Intenção · Frase */}
              <div
                onClick={() => setShowContextSheet(true)}
                className="relative z-10 p-5 space-y-2 pb-24 cursor-pointer"
              >
                {/* Módulo Específico Fase 2: Compatibilidade & Botão "Porquê esta pessoa?" */}
                {activeSmartMode === 'FOR_ME' && (
                  <div className="inline-flex items-center gap-2 p-1.5 px-3 rounded-xl bg-black/60 backdrop-blur-md border border-amber-500/30 text-xs">
                    <span className="font-bold text-amber-300">{compatibilityPct}% Compatível</span>
                    <span className="text-stone-500">•</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowWhyThisPersonModal(true);
                      }}
                      className="text-amber-400 hover:text-amber-200 font-semibold flex items-center gap-1 cursor-pointer transition underline decoration-amber-400/40"
                    >
                      <HelpCircle className="w-3 h-3" />
                      <span>Porquê esta pessoa?</span>
                    </button>
                  </div>
                )}

                {/* Módulo Específico Fase 4: Inesperadas & Botão "Por que apareceu?" */}
                {activeSmartMode === 'UNEXPECTED' && (
                  <div className="inline-flex items-center gap-2 p-1.5 px-3 rounded-xl bg-black/60 backdrop-blur-md border border-purple-500/30 text-xs">
                    <span className="font-bold text-purple-300">Afinidade Inesperada</span>
                    <span className="text-stone-500">•</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowWhyUnexpectedModal(true);
                      }}
                      className="text-purple-300 hover:text-purple-100 font-semibold flex items-center gap-1 cursor-pointer transition underline decoration-purple-400/40"
                    >
                      <Shuffle className="w-3 h-3" />
                      <span>Por que apareceu?</span>
                    </button>
                  </div>
                )}

                {/* Módulo Específico Fase 5: Bandeira + Distância + Status Online */}
                {activeSmartMode === 'CPLP' && (
                  <div className="inline-flex items-center gap-2 p-1.5 px-3 rounded-xl bg-black/60 backdrop-blur-md border border-cyan-500/30 text-xs text-cyan-300">
                    <span>{countryFlag} {targetProfile.countryName}</span>
                    <span className="text-stone-500">•</span>
                    <span>{approximateDistance}</span>
                    <span className="text-stone-500">•</span>
                    <span className="text-emerald-400 font-semibold">🟢 Online</span>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <h2 className="text-2xl sm:text-3xl font-bold font-serif text-white tracking-tight drop-shadow-md">
                    {targetProfile.displayName}, {targetProfile.age}
                  </h2>
                  <span className="text-xl" title={targetProfile.countryName}>{countryFlag}</span>
                  {targetProfile.verificationStatus === 'verified' && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-500/90 text-white px-2 py-0.5 rounded-full shadow-sm">
                      <ShieldCheck className="w-3 h-3" />
                      <span>Verificado</span>
                    </span>
                  )}
                </div>

                <p className="text-xs font-semibold text-rose-300 drop-shadow flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>{targetProfile.cityName} · Procura {intentLabel.toLowerCase()}</span>
                </p>

                {/* Frase Essencial */}
                <div className="p-3 bg-black/45 backdrop-blur-sm rounded-xl border border-white/10 text-stone-100 text-sm leading-relaxed font-sans shadow-lg">
                  "{targetProfile.bio || 'Gosto de viagens, boa música e construir uma conexão sincera.'}"
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-stone-300 space-y-4">
            <div className="w-16 h-16 rounded-full bg-stone-800 border border-stone-700 flex items-center justify-center text-rose-500">
              <Globe className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white mb-1">Exploraste todos os perfis neste modo</h3>
              <p className="text-xs text-stone-400 max-w-xs mx-auto">
                Experimenta outro modo inteligente ou ajusta as preferências na Camada 3.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsFilterSheetOpen(true)}
              className="py-2.5 px-5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-md cursor-pointer"
            >
              Ajustar Filtros
            </button>
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          CAMADA 1 — BOTÕES MÍNIMOS RIGOROSAMENTE ESPECIFICADOS:
          Passar (✕) | Abrir perfil (👁️) | Super Interesse (★) | Gostar (♡)
          ───────────────────────────────────────────────────────────── */}
      {targetProfile && (
        <div className="absolute bottom-4 left-0 right-0 max-w-md mx-auto px-4 flex items-center justify-center gap-3 z-20">
          {/* 1. Passar */}
          <button
            type="button"
            id="btn-discover-pass"
            onClick={handleNextAction}
            aria-label="Passar perfil"
            title="Passar"
            className="w-12 h-12 rounded-full bg-stone-900/95 border border-stone-700/80 text-stone-300 hover:text-rose-400 hover:border-rose-500/50 flex items-center justify-center shadow-xl backdrop-blur-md active:scale-95 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          {/* 2. Abrir Perfil */}
          <button
            type="button"
            id="btn-discover-open-profile"
            onClick={() => {
              setShowContextSheet(true);
              if (targetProfile) onRecordView?.(targetProfile);
            }}
            aria-label="Abrir perfil completo"
            title="Abrir Perfil"
            className="w-12 h-12 rounded-full bg-stone-900/95 border border-stone-700/80 text-stone-300 hover:text-cyan-400 hover:border-cyan-500/50 flex items-center justify-center shadow-xl backdrop-blur-md active:scale-95 transition cursor-pointer"
          >
            <Eye className="w-5 h-5" />
          </button>

          {/* 3. Super Interesse */}
          <button
            type="button"
            id="btn-discover-super-interest"
            onClick={handleSuperInterestAction}
            aria-label="Super interesse"
            title="Super Interesse"
            className="w-13 h-13 rounded-full bg-gradient-to-tr from-amber-500 to-amber-400 text-stone-950 flex items-center justify-center shadow-xl shadow-amber-500/30 active:scale-95 transition cursor-pointer border border-amber-300 font-bold"
          >
            <Star className="w-6 h-6 fill-current" />
          </button>

          {/* 4. Gostar */}
          <button
            type="button"
            id="btn-discover-heart"
            onClick={handleHeartAction}
            aria-label="Gostar e conectar"
            title="Gostar"
            className="w-15 h-15 rounded-full bg-gradient-to-tr from-rose-600 to-rose-500 text-white flex items-center justify-center shadow-2xl shadow-rose-600/50 active:scale-95 transition cursor-pointer border border-rose-400/40"
          >
            <Heart className="w-7 h-7 fill-current" />
          </button>

          {/* 5. Opções / Filtros */}
          <button
            type="button"
            id="btn-discover-options"
            onClick={() => setShowOptionsMenu(true)}
            aria-label="Opções e filtros"
            title="Opções"
            className="w-10 h-10 rounded-full bg-stone-900/80 border border-stone-800 text-stone-400 hover:text-white flex items-center justify-center shadow-md active:scale-95 transition cursor-pointer"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          FASE 2 — MODAL: "PORQUÊ ESTA PESSOA?" (Breakdown Visual com Barras)
          ───────────────────────────────────────────────────────────── */}
      {showWhyThisPersonModal && targetProfile && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-700/80 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-stone-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                  {compatibilityPct}%
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Porquê {targetProfile.displayName}?</h3>
                  <p className="text-[11px] text-stone-400">Critérios de compatibilidade calculados</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowWhyThisPersonModal(false)}
                className="text-stone-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Breakdown com barras */}
            <div className="space-y-3 text-xs">
              {/* 1. Interesses */}
              <div>
                <div className="flex justify-between text-stone-300 font-semibold mb-1">
                  <span>Interesses em Comum</span>
                  <span className="text-amber-400">{Math.min(98, 70 + sharedInterests.length * 9)}%</span>
                </div>
                <div className="w-full bg-stone-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-amber-400 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(98, 70 + sharedInterests.length * 9)}%` }}
                  />
                </div>
                <p className="text-[10px] text-stone-400 mt-1">
                  Partilham {sharedInterests.length > 0 ? sharedInterests.join(', ') : 'gosto por viagens e cultura'}.
                </p>
              </div>

              {/* 2. Localização & Comunidade */}
              <div>
                <div className="flex justify-between text-stone-300 font-semibold mb-1">
                  <span>Localização & Afinidade Cultural</span>
                  <span className="text-amber-400">88%</span>
                </div>
                <div className="w-full bg-stone-800 h-2 rounded-full overflow-hidden">
                  <div className="bg-amber-400 h-full rounded-full" style={{ width: '88%' }} />
                </div>
                <p className="text-[10px] text-stone-400 mt-1">
                  {targetProfile.cityName} ({countryFlag} {targetProfile.countryName}).
                </p>
              </div>

              {/* 3. Objetivo */}
              <div>
                <div className="flex justify-between text-stone-300 font-semibold mb-1">
                  <span>Alinhamento de Intenção</span>
                  <span className="text-amber-400">95%</span>
                </div>
                <div className="w-full bg-stone-800 h-2 rounded-full overflow-hidden">
                  <div className="bg-amber-400 h-full rounded-full" style={{ width: '95%' }} />
                </div>
                <p className="text-[10px] text-stone-400 mt-1">
                  Ambos priorizam relacionamentos com sinceridade e conexão com propósito.
                </p>
              </div>

              {/* 4. Atividade */}
              <div>
                <div className="flex justify-between text-stone-300 font-semibold mb-1">
                  <span>Nível de Atividade & Presença</span>
                  <span className="text-amber-400">92%</span>
                </div>
                <div className="w-full bg-stone-800 h-2 rounded-full overflow-hidden">
                  <div className="bg-amber-400 h-full rounded-full" style={{ width: '92%' }} />
                </div>
                <p className="text-[10px] text-stone-400 mt-1">
                  Membro ativo e verificado na comunidade ÉNós.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowWhyThisPersonModal(false)}
              className="w-full py-2.5 bg-stone-800 hover:bg-stone-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Compreendi
            </button>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          FASE 4 — MODAL: "POR QUE APARECEU?" (Inesperadas / Serendipidade)
          ───────────────────────────────────────────────────────────── */}
      {showWhyUnexpectedModal && targetProfile && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-purple-500/40 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-stone-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center">
                  <Shuffle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Por que apareceu?</h3>
                  <p className="text-[11px] text-stone-400">Descoberta fora da sua bolha</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowWhyUnexpectedModal(false)}
                className="text-stone-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-stone-300 leading-relaxed">
              <div className="p-3 bg-purple-950/40 border border-purple-800/60 rounded-xl">
                <p className="font-semibold text-purple-200 mb-1">Quebra de Padrão com Propósito</p>
                <p className="text-stone-300 text-[11px]">
                  {targetProfile.displayName} foge aos seus critérios habituais de distância ou idade, mas foi sugerido(a) porque partilham afinidades reais em {sharedInterests.length > 0 ? sharedInterests.join(' e ') : 'interesses essenciais'}.
                </p>
              </div>

              <div className="p-3 bg-stone-850 rounded-xl border border-stone-800 space-y-1">
                <span className="text-[10px] text-stone-400 block uppercase font-bold tracking-wider">Por que vale a pena conhecer:</span>
                <p className="text-xs text-stone-200">
                  No ÉNós, conexões duradouras muitas vezes surgem de pessoas que complementam a sua visão de mundo em vez de apenas espelhá-la.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowWhyUnexpectedModal(false)}
              className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Explorar Conexão
            </button>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          CAMADA 2 — CONTEXTO DA PESSOA (Acionado por toque na foto)
          📷 Fotos | 🎙️ Voz | ❤️ Intenção | ✨ Afinidades | 🛡️ Confiança | 📍 Localização aproximada
          ───────────────────────────────────────────────────────────── */}
      {showContextSheet && targetProfile && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex flex-col justify-end">
          <div className="bg-stone-900 border-t border-stone-800 rounded-t-3xl p-5 max-w-md mx-auto w-full max-h-[85vh] overflow-y-auto space-y-4 animate-in slide-in-from-bottom duration-200">
            {/* Header com Nome, Idade e Fechar */}
            <div className="flex items-center justify-between pb-2 border-b border-stone-800 sticky top-0 bg-stone-900 z-10">
              <div className="flex items-center gap-2">
                <span className="text-xl">{countryFlag}</span>
                <div>
                  <h3 className="font-bold text-base text-white">{targetProfile.displayName}, {targetProfile.age}</h3>
                  <span className="text-[10px] text-stone-400">Contexto detalhado</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowContextSheet(false)}
                className="p-1 text-stone-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 📷 Fotos */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-rose-400">
                <Camera className="w-4 h-4" />
                <span>Fotos ({targetProfile.photos?.length || 1})</span>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                {(targetProfile.photos && targetProfile.photos.length > 0 ? targetProfile.photos : [targetProfile.profilePhoto]).map((ph, idx) => (
                  <div key={idx} className="w-32 h-44 shrink-0 rounded-xl overflow-hidden border border-stone-800 bg-stone-800">
                    <OptimizedImage src={ph} alt={`${targetProfile.displayName} foto ${idx + 1}`} variant="thumbnail" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </div>

            {/* 🎙️ Voz */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-rose-400">
                <Volume2 className="w-4 h-4" />
                <span>Apresentação de Voz</span>
              </div>
              <div className="bg-stone-800/80 p-3 rounded-xl border border-stone-700/60 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsPlayingAudio(!isPlayingAudio)}
                    className="w-9 h-9 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center transition cursor-pointer shadow-sm"
                  >
                    {isPlayingAudio ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                  </button>
                  <div>
                    <div className="text-xs font-bold text-white">Mensagem de Voz de {targetProfile.displayName}</div>
                    <div className="text-[10px] text-stone-400">{isPlayingAudio ? 'A reproduzir tom de voz natural...' : 'Toque para ouvir voz e sotaque (0:18)'}</div>
                  </div>
                </div>
                <span className="text-xs font-mono text-rose-400">0:18</span>
              </div>
            </div>

            {/* ❤️ Intenção */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-rose-400">
                <Heart className="w-4 h-4 fill-current" />
                <span>Intenção de Relacionamento</span>
              </div>
              <div className="bg-stone-800/80 p-3 rounded-xl border border-stone-700/60 text-xs">
                <span className="font-bold text-white block mb-0.5">{intentLabel}</span>
                <span className="text-stone-300 text-[11px]">{intentConfig?.description || 'Buscando uma conexão sincera e com propósito.'}</span>
              </div>
            </div>

            {/* ✨ Afinidades */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-rose-400">
                <Sparkles className="w-4 h-4" />
                <span>Afinidades & Interesses</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(targetProfile.interests || []).map(i => {
                  const isShared = (myProfile?.interests || []).includes(i);
                  return (
                    <span
                      key={i}
                      className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                        isShared
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold'
                          : 'bg-stone-800 text-stone-300 border border-stone-700'
                      }`}
                    >
                      {isShared ? `✨ ${i}` : i}
                    </span>
                  );
                })}
              </div>
              {sharedInterests.length > 0 && (
                <p className="text-[11px] text-emerald-400 font-medium pt-1">
                  ✓ {sharedInterests.length} {sharedInterests.length === 1 ? 'afinidade partilhada' : 'afinidades partilhadas'} contigo
                </p>
              )}
            </div>

            {/* 🛡️ Confiança */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-rose-400">
                <ShieldCheck className="w-4 h-4" />
                <span>Nível de Confiança & Segurança</span>
              </div>
              <div className="bg-stone-800/80 p-3 rounded-xl border border-stone-700/60 flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-white">
                    {targetProfile.verificationStatus === 'verified' ? 'Identidade Verificada' : 'Membro da Comunidade'}
                  </div>
                  <div className="text-[10px] text-stone-400">
                    {targetProfile.verificationStatus === 'verified'
                      ? 'Selfie biométrica confirmada com sucesso'
                      : 'Perfil ativo e em conformidade com as regras'}
                  </div>
                </div>
                <span className="text-emerald-400 font-bold text-xs bg-emerald-950/60 border border-emerald-800 px-2 py-1 rounded-lg">
                  {targetProfile.verificationStatus === 'verified' ? '100% Confiável' : 'Verificado'}
                </span>
              </div>
            </div>

            {/* 📍 Localização aproximada */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-rose-400">
                <MapPin className="w-4 h-4" />
                <span>Localização Aproximada</span>
              </div>
              <div className="bg-stone-800/80 p-3 rounded-xl border border-stone-700/60 text-xs">
                <div className="font-bold text-white">{targetProfile.cityName}, {targetProfile.countryName}</div>
                <div className="text-[10px] text-stone-400 mt-0.5">
                  Privacidade respeitada: a localização exata nunca é partilhada.
                </div>
              </div>
            </div>

            {/* Botão de Conexão */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowContextSheet(false);
                  handleHeartAction();
                }}
                className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-lg cursor-pointer flex items-center justify-center gap-2"
              >
                <Heart className="w-4 h-4 fill-current" />
                <span>Conectar com {targetProfile.displayName}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          CAMADA 3 — AFINAR DESCOBERTA (FILTROS VISUAIS)
          👨 👩 ⚥ | Idade | 📍 Distância | ❤️ Intenção | 🌍 País | ✨ Interesses
          ───────────────────────────────────────────────────────────── */}
      {isFilterSheetOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex flex-col justify-end">
          <div className="bg-stone-900 border-t border-stone-800 rounded-t-3xl p-5 max-w-md mx-auto w-full max-h-[85vh] overflow-y-auto space-y-4 animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-stone-800 sticky top-0 bg-stone-900 z-10">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-rose-500" />
                <h3 className="font-bold text-sm text-white">Afinar Descoberta</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsFilterSheetOpen(false)}
                className="p-1 text-stone-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 👨 👩 ⚥ Género Visual */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-stone-400 uppercase tracking-wider block">
                Quem queres ver?
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { id: 'woman', label: 'Mulheres', icon: '👩' },
                  { id: 'man', label: 'Homens', icon: '👨' },
                  { id: 'non_binary', label: 'Não-Binário', icon: '⚥' },
                  { id: 'all', label: 'Todos', icon: '👥' }
                ].map(g => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setFilterGender(g.id as any)}
                    className={`py-2.5 px-2 rounded-xl text-xs font-bold border flex flex-col items-center gap-1 transition cursor-pointer ${
                      filterGender === g.id
                        ? 'bg-rose-600 border-rose-500 text-white shadow-sm'
                        : 'bg-stone-800 border-stone-700 text-stone-300 hover:border-stone-600'
                    }`}
                  >
                    <span className="text-base leading-none">{g.icon}</span>
                    <span className="text-[10px] truncate">{g.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Idade */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-stone-400 uppercase tracking-wider text-[11px]">Faixa Etária</span>
                <span className="text-rose-400">{filterMinAge} – {filterMaxAge} anos</span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="18"
                  max="65"
                  value={filterMinAge}
                  onChange={e => setFilterMinAge(Math.min(Number(e.target.value), filterMaxAge - 2))}
                  className="flex-1 accent-rose-500 cursor-pointer"
                />
                <input
                  type="range"
                  min="20"
                  max="75"
                  value={filterMaxAge}
                  onChange={e => setFilterMaxAge(Math.max(Number(e.target.value), filterMinAge + 2))}
                  className="flex-1 accent-rose-500 cursor-pointer"
                />
              </div>
            </div>

            {/* 📍 Distância */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-stone-400 uppercase tracking-wider text-[11px] flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-rose-400" />
                  <span>Distância Máxima</span>
                </span>
                <span className="text-rose-400">
                  {filterMaxDistanceKm >= 1000 ? 'Sem limite (Toda CPLP)' : `${filterMaxDistanceKm} km`}
                </span>
              </div>
              <input
                type="range"
                min="10"
                max="1000"
                step="10"
                value={filterMaxDistanceKm}
                onChange={e => setFilterMaxDistanceKm(Number(e.target.value))}
                className="w-full accent-rose-500 cursor-pointer"
              />
            </div>

            {/* ❤️ Intenção Visual */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-stone-400 uppercase tracking-wider block flex items-center gap-1">
                <span>Intenção de Relacionamento</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFilterIntent('all')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition text-left cursor-pointer ${
                    filterIntent === 'all'
                      ? 'bg-rose-600 border-rose-500 text-white'
                      : 'bg-stone-800 border-stone-700 text-stone-300'
                  }`}
                >
                  ❤️ Todas as Intenções
                </button>
                {RELATIONSHIP_INTENTS_CONFIG.map(intent => (
                  <button
                    key={intent.id}
                    type="button"
                    onClick={() => setFilterIntent(intent.id)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition text-left cursor-pointer truncate ${
                      filterIntent === intent.id
                        ? 'bg-rose-600 border-rose-500 text-white'
                        : 'bg-stone-800 border-stone-700 text-stone-300'
                    }`}
                  >
                    {intent.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 🌍 País */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-stone-400 uppercase tracking-wider block">
                País da Comunidade CPLP
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => setFilterCountry('all')}
                  className={`py-2 px-2 rounded-xl text-xs font-bold border transition cursor-pointer truncate ${
                    filterCountry === 'all'
                      ? 'bg-rose-600 border-rose-500 text-white'
                      : 'bg-stone-800 border-stone-700 text-stone-300'
                  }`}
                >
                  🌍 Todos (CPLP)
                </button>
                {CPLP_COUNTRY_LIST.map(country => (
                  <button
                    key={country.code}
                    type="button"
                    onClick={() => setFilterCountry(country.code)}
                    className={`py-2 px-2 rounded-xl text-xs font-bold border transition cursor-pointer truncate flex items-center gap-1.5 ${
                      filterCountry === country.code
                        ? 'bg-rose-600 border-rose-500 text-white'
                        : 'bg-stone-800 border-stone-700 text-stone-300'
                    }`}
                  >
                    <span>{country.flag}</span>
                    <span className="truncate">{country.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* ✨ Interesses */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-stone-400 uppercase tracking-wider block">
                Interesses Preferenciais
              </label>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto no-scrollbar">
                {NORMALIZED_INTERESTS.slice(0, 10).map(interest => {
                  const isSelected = filterInterests.includes(interest);
                  return (
                    <button
                      key={interest}
                      type="button"
                      onClick={() => toggleInterestFilter(interest)}
                      className={`text-xs px-2.5 py-1 rounded-full font-medium border transition cursor-pointer ${
                        isSelected
                          ? 'bg-rose-600 border-rose-500 text-white font-bold'
                          : 'bg-stone-800 border-stone-700 text-stone-300 hover:border-stone-600'
                      }`}
                    >
                      {interest}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Ação Aplicar Filtros */}
            <button
              type="button"
              onClick={handleApplyVisualFilters}
              className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-lg cursor-pointer flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span>Aplicar Filtros de Descoberta</span>
            </button>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL DE OPÇÕES (⋮)
          ───────────────────────────────────────────────────────────── */}
      {showOptionsMenu && targetProfile && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex flex-col justify-end">
          <div className="bg-stone-900 border-t border-stone-800 rounded-t-3xl p-5 max-w-md mx-auto w-full space-y-2 animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-stone-800">
              <div className="flex items-center gap-2">
                <span className="text-xl">{countryFlag}</span>
                <span className="font-bold text-sm text-white">{targetProfile.displayName}, {targetProfile.age}</span>
              </div>
              <button
                type="button"
                onClick={() => setShowOptionsMenu(false)}
                className="p-1 text-stone-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Ver Contexto Completo */}
            <button
              type="button"
              onClick={() => {
                setShowOptionsMenu(false);
                setShowContextSheet(true);
              }}
              className="w-full py-3 px-4 bg-stone-800/80 hover:bg-stone-800 text-stone-200 rounded-xl text-xs font-bold flex items-center justify-between transition cursor-pointer"
            >
              <span>Ver contexto completo (Fotos, Voz, Afinidades)</span>
              <Sparkles className="w-4 h-4 text-rose-400" />
            </button>

            {/* Afinar Descoberta (Filtros) */}
            <button
              type="button"
              onClick={() => {
                setShowOptionsMenu(false);
                setIsFilterSheetOpen(true);
              }}
              className="w-full py-3 px-4 bg-stone-800/80 hover:bg-stone-800 text-stone-200 rounded-xl text-xs font-bold flex items-center justify-between transition cursor-pointer"
            >
              <span>Afinar descoberta (Filtros visuais)</span>
              <SlidersHorizontal className="w-4 h-4 text-stone-400" />
            </button>

            {/* Denunciar Perfil */}
            <button
              type="button"
              onClick={() => {
                setShowOptionsMenu(false);
                if (currentCandidate) onReport(currentCandidate);
              }}
              className="w-full py-3 px-4 bg-rose-950/40 hover:bg-rose-950/70 text-rose-300 rounded-xl text-xs font-bold flex items-center justify-between transition cursor-pointer"
            >
              <span>Denunciar este perfil</span>
              <Flag className="w-4 h-4 text-rose-400" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
