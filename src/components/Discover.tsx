import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  UserProfile,
  UserPreferences,
  PrivacySettings,
  InteractionSignals,
  DiscoveryCandidate,
  ExpansionLevel,
  TrustBadge,
  NetworkCondition
} from '../types';
import { DiscoveryAppService } from '../services/discoveryService';
import { ClientAiAdapter } from '../services/aiAdapter';
import { persistCommunityAnswer, persistDiscoveryEvent } from '../services/discoveryPersistence';
import { connectionGraph } from '../services/connectionGraph';
import { relationalMemory } from '../services/relationalMemory';
import { dataSaver } from '../services/dataSaverService';
import { CPLP_COUNTRIES } from '../constants';
import { OptimizedImage } from './common/OptimizedImage';
import {
  Sparkles,
  MessageCircle,
  MapPin,
  Globe,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  RefreshCw,
  Layers,
  Volume2,
  Send,
  HelpCircle,
  ArrowRight,
  UserCheck,
  Compass,
  HeartHandshake,
  Lightbulb,
  CheckCircle2,
  Clock,
  Flame,
  VolumeX,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Award,
  Zap,
  Check,
  Brain,
  Wifi,
  WifiOff
} from 'lucide-react';
import confetti from 'canvas-confetti';

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
  onOpenPreferences?: () => void;
}

// Pergunta que Une data contract
interface CommunityQuestion {
  id: string;
  question: string;
  theme: string;
  countryContext: string;
  sampleAnswers: {
    candidateUid: string;
    answer: string;
    highlight: string;
    timeAgo: string;
  }[];
}

const LUSOFONE_QUESTIONS: CommunityQuestion[] = [
  {
    id: 'q_musica_raiz',
    question: 'Qual é a canção ou ritmo da tua infância que nunca sai da tua cabeça?',
    theme: 'Música & Memória',
    countryContext: 'CPLP · Ritmos e Raízes',
    sampleAnswers: [
      {
        candidateUid: 'demo_marta_ao',
        answer: 'O Semba clássico dos Kiezos nos almoços de domingo na Ilha de Luanda.',
        highlight: 'Semba & Memória Familiar',
        timeAgo: 'há 12m'
      },
      {
        candidateUid: 'demo_tiago_pt',
        answer: 'Fado de Coimbra ouvido nas noites de verão na varanda dos meus avós.',
        highlight: 'Fado & Tradição',
        timeAgo: 'há 28m'
      },
      {
        candidateUid: 'demo_ines_cv',
        answer: 'A Morna "Sodade" cantada à capela ao entardecer no Mindelo.',
        highlight: 'Morna & Sodade',
        timeAgo: 'há 1h'
      }
    ]
  },
  {
    id: 'q_lugar_casa',
    question: 'Que lugar na Lusofonia te faz sentir em casa mesmo estando longe?',
    theme: 'Sentimento de Pertença',
    countryContext: 'CPLP · Horizontes e Afetos',
    sampleAnswers: [
      {
        candidateUid: 'demo_marta_ao',
        answer: 'A orla da Marginal de Luanda com a brisa atlântica.',
        highlight: 'Atlântico Sul',
        timeAgo: 'há 15m'
      },
      {
        candidateUid: 'demo_ines_cv',
        answer: 'A Baía do Porto Grande no Mindelo, onde todos os barcos trazem histórias.',
        highlight: 'Mar & Encontros',
        timeAgo: 'há 45m'
      }
    ]
  },
  {
    id: 'q_conexao_real',
    question: 'O que é inegociável para ti para criar uma conexão verdadeira?',
    theme: 'Valores & Confiança',
    countryContext: 'CPLP · Autenticidade',
    sampleAnswers: [
      {
        candidateUid: 'demo_tiago_pt',
        answer: 'Sinceridade no olhar, sentido de humor e respeito pelos valores familiares.',
        highlight: 'Sinceridade & Valores',
        timeAgo: 'há 20m'
      }
    ]
  }
];

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
  const [showCommunityPrompt, setShowCommunityPrompt] = useState(false);

  // Progressive revelation phase: 'affinity' -> 'curiosity' -> 'revelation' -> 'conversation'
  const [activeStep, setActiveStep] = useState<'affinity' | 'curiosity' | 'revelation' | 'conversation'>('affinity');
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  // Pergunta que Une State
  const [selectedQuestionIdx, setSelectedQuestionIdx] = useState(0);
  const [userQuestionResponse, setUserQuestionResponse] = useState('');
  const [isSubmittingResponse, setIsSubmittingResponse] = useState(false);
  const [networkCondition, setNetworkCondition] = useState<NetworkCondition>(() => dataSaver.detectCurrentNetworkCondition());
  const [savedUserResponse, setSavedUserResponse] = useState<string | null>(() => {
    try {
      return localStorage.getItem('enos_user_daily_answer');
    } catch {
      return null;
    }
  });

  // Subscribe to network condition changes (PONTO 4: Data-Saver & Network Awareness)
  useEffect(() => {
    const unsubscribe = dataSaver.subscribe((event) => {
      if (event === 'network_change' || event === 'settings_change') {
        setNetworkCondition(dataSaver.detectCurrentNetworkCondition());
      }
    });
    return unsubscribe;
  }, []);

  // Evaluate discovery feed on dependencies change
  useEffect(() => {
    const state = discoveryService.evaluateDiscoveryFeed(
      candidatePool,
      myProfile,
      myPreferences,
      privacy,
      signals
    );

    // Apply progressive loading: First meaningful screen < 150 KB
    const progressiveCandidates = state.candidates.map(c => dataSaver.createProgressiveCandidateShell(c));
    setCandidates(progressiveCandidates);
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

  // Single-card focused candidate
  const currentCandidate: DiscoveryCandidate | undefined = candidates[currentIndex];
  const targetProfile = currentCandidate?.profile;

  // Preload primary candidate media
  useEffect(() => {
    if (candidates.length > 0 && currentIndex < candidates.length) {
      discoveryService.preloadCandidateMedia(candidates.slice(currentIndex, currentIndex + 2));
    }
  }, [currentIndex, candidates]);

  // Record candidate seen & telemetry persistence
  useEffect(() => {
    if (targetProfile && myProfile?.uid) {
      onRecordSeen(targetProfile.uid);
      discoveryService.markSeenInSession(targetProfile.uid);
      persistDiscoveryEvent(myProfile.uid, targetProfile.uid, 'candidate_shown', {
        compatibilityReasons: currentCandidate?.compatibilityReasons || [],
        compositeRank: currentCandidate?.prioritizationScore?.finalCompositeRank || 0,
        discoveryMode: currentCandidate?.discoveryMode
      });

      // PONTO 2 MCR Funnel: Record IMPRESSION stage with discoveryOrigin
      const origin = currentCandidate?.discoveryMode || 'VALUES_AFFINITY';
      connectionGraph.recordFunnelEvent({
        userId: myProfile.uid,
        targetUid: targetProfile.uid,
        stage: 'IMPRESSION',
        countryPair: [myProfile.countryCode, targetProfile.countryCode],
        discoveryOrigin: origin,
        metadata: {
          discoveryOrigin: origin,
          discoveryMode: currentCandidate?.discoveryMode,
          isSerendipitous: currentCandidate?.discoveryMode === 'SERENDIPITY'
        }
      });
    }
  }, [targetProfile?.uid, myProfile?.uid]);

  // Track QUALIFIED_DISCOVERY when user spends time or interacts with progressive revelation
  const trackQualifiedDiscovery = () => {
    if (!targetProfile || !myProfile?.uid) return;
    const origin = currentCandidate?.discoveryMode || 'VALUES_AFFINITY';
    connectionGraph.recordFunnelEvent({
      userId: myProfile.uid,
      targetUid: targetProfile.uid,
      stage: 'QUALIFIED_DISCOVERY',
      countryPair: [myProfile.countryCode, targetProfile.countryCode],
      discoveryOrigin: origin,
      metadata: {
        discoveryOrigin: origin,
        revelationStep: activeStep
      }
    });
  };

  // Reset revelation step on candidate switch
  useEffect(() => {
    setActiveStep('affinity');
    setSelectiveAiExplanation(null);
    setIsPlayingAudio(false);
  }, [targetProfile?.uid]);

  // AI Explainer on demand
  const handleRequestAiInsight = async () => {
    if (!targetProfile || loadingAi || !myProfile?.uid) return;
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
      persistDiscoveryEvent(myProfile.uid, targetProfile.uid, 'reason_viewed', { type: 'ai_explanation' });
    } catch {
      setSelectiveAiExplanation('Sintonia autêntica baseada na partilha de intenções sinceras e referências culturais lusófonas.');
    } finally {
      setLoadingAi(false);
    }
  };

  // Initiate Conversation with Reason Context
  const handleInitiateApproach = (customReason?: string) => {
    if (!currentCandidate || !myProfile?.uid) return;

    confetti({
      particleCount: 40,
      spread: 65,
      origin: { y: 0.8 },
      colors: ['#e11d48', '#fb7185', '#0d9488', '#f59e0b']
    });

    const starterPrompt = currentCandidate.conversationPrompt ||
      (currentCandidate.evidenceDetails?.conversationStarters?.[0]) ||
      undefined;

    const reasonToUse = customReason || starterPrompt || currentCandidate.discoveryReason || currentCandidate.compatibilityReasons[0] || 'valores e vivências';
    const contextText = customReason
      ? `Olá, ${targetProfile?.displayName}! Fiquei com curiosidade em relação à nossa afinidade: "${customReason}". Vamos conversar? 🌍✨`
      : starterPrompt
        ? `Olá, ${targetProfile?.displayName}! ${starterPrompt} Adoraria trocar impressões contigo!`
        : `Olá, ${targetProfile?.displayName}! Notei a nossa afinidade em ${reasonToUse}. Adoraria trocar ideias!`;

    persistDiscoveryEvent(myProfile.uid, targetProfile?.uid || '', 'approach_initiated', {
      contextReason: reasonToUse,
      discoveryMode: currentCandidate.discoveryMode
    });

    // PONTO 2 MCR Funnel: Record INTENTIONAL_INTEREST stage
    if (targetProfile) {
      connectionGraph.recordFunnelEvent({
        userId: myProfile.uid,
        targetUid: targetProfile.uid,
        stage: 'INTENTIONAL_INTEREST',
        countryPair: [myProfile.countryCode, targetProfile.countryCode],
        discoveryOrigin: currentCandidate.discoveryMode || 'VALUES_AFFINITY',
        metadata: {
          discoveryOrigin: currentCandidate.discoveryMode,
          contextReason: reasonToUse
        }
      });
    }

    onLike(currentCandidate, contextText, true);
  };

  const handleNextSignal = () => {
    if (!currentCandidate || !myProfile?.uid) return;
    persistDiscoveryEvent(myProfile.uid, currentCandidate.profile.uid, 'pass', {
      discoveryMode: currentCandidate.discoveryMode
    });
    onPass(currentCandidate);
    setCurrentIndex(prev => prev + 1);
  };

  const handlePrevSignal = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  // Persist user community answer
  const handleSaveUserResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userQuestionResponse.trim() || !myProfile?.uid) return;
    setIsSubmittingResponse(true);

    const q = LUSOFONE_QUESTIONS[selectedQuestionIdx];
    const answerText = userQuestionResponse.trim();

    try {
      await persistCommunityAnswer(
        myProfile.uid,
        myProfile.displayName,
        myProfile.cityName,
        myProfile.countryCode,
        myProfile.profilePhoto,
        q.id,
        q.theme,
        answerText
      );
      setSavedUserResponse(answerText);
      try {
        localStorage.setItem('enos_user_daily_answer', answerText);
      } catch {}
      setUserQuestionResponse('');
    } catch (err) {
      console.warn('Persistence notice:', err);
      setSavedUserResponse(answerText);
    } finally {
      setIsSubmittingResponse(false);
    }
  };

  const currentQuestion = LUSOFONE_QUESTIONS[selectedQuestionIdx];

  // Empty or Exhausted state
  if (!targetProfile || currentIndex >= candidates.length || availability === 'NO_CANDIDATES') {
    return (
      <div id="discover-empty-state" className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-sm mx-auto min-h-[70vh]">
        <div className="w-16 h-16 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center mb-4 text-rose-600 shadow-2xs">
          <Globe className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-stone-900 mb-2">O teu Foco está Concluído</h3>
        <p className="text-xs text-stone-600 leading-relaxed mb-6">
          {scarcityMessage || 'Você explorou todas as razões de descoberta prioritárias disponíveis para este momento.'}
        </p>

        <div className="flex flex-col gap-2 w-full">
          <button
            type="button"
            id="btn-reset-discovery-session"
            onClick={() => {
              discoveryService.resetSession();
              setCurrentIndex(0);
            }}
            className="w-full py-2.5 bg-stone-900 text-white rounded-xl font-medium text-xs hover:bg-stone-800 transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Rever Foco de Descoberta</span>
          </button>

          {onOpenPreferences && (
            <button
              type="button"
              id="btn-open-preferences"
              onClick={onOpenPreferences}
              className="w-full py-2.5 bg-white border border-stone-200 text-stone-700 rounded-xl font-medium text-xs hover:bg-stone-50 transition flex items-center justify-center gap-2 cursor-pointer"
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
  const myCountryInfo = CPLP_COUNTRIES[myProfile.countryCode] || { flag: '🌍', name: myProfile.countryName };

  // Primary Discovery Reason & Mode
  const primaryReason = currentCandidate.discoveryReason ||
    currentCandidate.crossCulturalHighlight ||
    currentCandidate.compatibilityReasons[0] ||
    `Sintonia de vivências e referências entre ${myProfile.cityName} e ${targetProfile.cityName}`;

  const evidenceDetails = currentCandidate.evidenceDetails;
  const prioritization = currentCandidate.prioritizationScore;

  // Numerical metrics computed by Reason-First heuristic
  const culturalConnectionScore = prioritization?.culturalConnection
    ? Math.round(prioritization.culturalConnection * 100)
    : 80;
  const conversationPotentialScore = prioritization?.conversationPotential
    ? Math.round(prioritization.conversationPotential * 100)
    : 85;

  const isDominantCultural = culturalConnectionScore >= conversationPotentialScore;

  const discoveryModeLabel = currentCandidate.discoveryMode === 'CULTURAL_BRIDGE'
    ? 'Ponte Cultural'
    : currentCandidate.discoveryMode === 'COMPLEMENTARITY'
      ? 'Diferenças Enriquecedoras'
      : currentCandidate.discoveryMode === 'SERENDIPITY'
        ? 'Descoberta Inesperada'
        : currentCandidate.discoveryMode === 'DEEP_CONVERSATION'
          ? 'Diálogo Profundo'
          : 'Sintonia Autêntica';

  // Relational Memory Evaluation (Pessoa + Contexto + Comportamento + Reciprocidade + Resultado)
  const conditionFitness = relationalMemory.evaluateConditionFit(myProfile, currentCandidate);

  return (
    <div id="discover-single-card-view" className="flex-1 flex flex-col max-w-lg mx-auto w-full p-4 pb-24 space-y-4">
      {/* ─────────────────────────────────────────────────────────────
          HEADER: FOCUS BAR & PROGRESS COUNTER
          ───────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-stone-200/80 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-rose-600 text-white flex items-center justify-center shadow-2xs">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-xs text-stone-900 font-bold tracking-tight">
              <span>Foco de Descoberta</span>
              <span className="text-[10px] font-semibold bg-rose-50 text-rose-700 px-1.5 py-0.2 rounded border border-rose-200">
                {currentIndex + 1} de {candidates.length}
              </span>
              {networkCondition.category !== 'HIGH_SPEED_4G' && (
                <span
                  className="hidden sm:inline-flex items-center gap-1 text-[9px] font-semibold bg-amber-50 text-amber-800 px-1.5 py-0.2 rounded border border-amber-200"
                  title={`Rede: ${networkCondition.category} · Orçamento de tela inicial: <${networkCondition.budgetKbTarget} KB`}
                >
                  <Wifi className="w-2.5 h-2.5 text-amber-600" />
                  <span>{networkCondition.category === 'CONSTRAINED_2G' ? '2G (<120KB)' : networkCondition.category === 'OFFLINE' ? 'Offline' : '3G Eco'}</span>
                </span>
              )}
            </div>
            <p className="text-[11px] text-stone-500 font-medium">
              Avaliação orientada por Razão, Cultura e Diálogo
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Navigation between cards */}
          <button
            type="button"
            onClick={handlePrevSignal}
            disabled={currentIndex === 0}
            title="Sinal anterior"
            className="p-1.5 rounded-lg border border-stone-200 text-stone-600 disabled:opacity-30 hover:bg-stone-50 transition cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleNextSignal}
            disabled={currentIndex >= candidates.length - 1}
            title="Próximo sinal"
            className="p-1.5 rounded-lg border border-stone-200 text-stone-600 disabled:opacity-30 hover:bg-stone-50 transition cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onReport(currentCandidate)}
            title="Denunciar / Segurança"
            className="text-stone-400 hover:text-stone-700 p-1.5 rounded-lg transition cursor-pointer"
          >
            <ShieldAlert className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          SINGLE FOCUSED CARD (CARD PRINCIPAL DE DESCOBERTA)
          ───────────────────────────────────────────────────────────── */}
      <motion.div
        key={targetProfile.uid}
        initial={{ opacity: 0, scale: 0.98, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: -8 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="discover-card-container bg-white rounded-2xl border border-stone-200/90 shadow-sm overflow-hidden flex flex-col"
      >
        {/* TOP HIGH-IMPACT DISCOVERY REASON HERO HEADER */}
        <div className="p-4 sm:p-5 bg-gradient-to-br from-stone-900 via-stone-850 to-stone-900 text-white border-b border-stone-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-rose-400 uppercase">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Razão da Descoberta · {discoveryModeLabel}</span>
            </div>

            <div className="flex items-center gap-1 text-[10px] font-semibold bg-white/10 px-2.5 py-0.5 rounded-full border border-white/20">
              {isDominantCultural ? (
                <>
                  <Globe className="w-3 h-3 text-emerald-400" />
                  <span className="text-emerald-300">Ponte Cultural</span>
                </>
              ) : (
                <>
                  <Flame className="w-3 h-3 text-rose-400" />
                  <span className="text-rose-300">Diálogo Expressivo</span>
                </>
              )}
            </div>
          </div>

          {/* High-impact dynamic discovery reason title */}
          <div className="space-y-1.5">
            <h2 className="text-base sm:text-lg font-serif font-semibold text-stone-100 leading-snug tracking-tight">
              "{primaryReason}"
            </h2>
            {currentCandidate.connectionContext && (
              <p className="text-xs text-stone-300 font-sans leading-relaxed">
                {currentCandidate.connectionContext}
              </p>
            )}
          </div>

          {/* ROW OF PILL-SHAPED UI MARKERS (PURPLE FOR CULTURAL CONNECTION, GOLD FOR CONVERSATION POTENTIAL) */}
          <div
            id="discovery-reason-markers-row"
            className="flex flex-wrap items-center gap-1.5 pt-1"
            role="list"
            aria-label="Marcadores de Afinidade e Conexão"
          >
            {/* PURPLE BADGES: Cultural Connection Signals */}
            {culturalConnectionScore >= 60 && (
              <span
                role="listitem"
                className="inline-flex items-center gap-1 text-[11px] font-semibold bg-purple-950/70 text-purple-200 px-2.5 py-1 rounded-full border border-purple-500/40 shadow-2xs"
                title={`Índice de Conexão Cultural: ${culturalConnectionScore}%`}
              >
                <Globe className="w-3 h-3 text-purple-300 shrink-0" aria-hidden="true" />
                <span>Conexão Cultural ({culturalConnectionScore}%)</span>
              </span>
            )}

            {targetProfile.countryCode !== myProfile.countryCode ? (
              <span
                role="listitem"
                className="inline-flex items-center gap-1 text-[11px] font-semibold bg-purple-950/70 text-purple-200 px-2.5 py-1 rounded-full border border-purple-500/40 shadow-2xs"
                title="Ponte entre diferentes nações da CPLP"
              >
                <span className="text-xs">{myCountryInfo.flag}</span>
                <span className="text-[10px] text-purple-400">⟷</span>
                <span className="text-xs">{countryInfo.flag}</span>
                <span>Ponte Lusófona</span>
              </span>
            ) : (
              <span
                role="listitem"
                className="inline-flex items-center gap-1 text-[11px] font-semibold bg-purple-950/70 text-purple-200 px-2.5 py-1 rounded-full border border-purple-500/40 shadow-2xs"
                title="Vivência na mesma região cultural"
              >
                <MapPin className="w-3 h-3 text-purple-300 shrink-0" aria-hidden="true" />
                <span>Mesma Região Cultural ({targetProfile.cityName})</span>
              </span>
            )}

            {evidenceDetails?.culturalBridge && (
              <span
                role="listitem"
                className="inline-flex items-center gap-1 text-[11px] font-semibold bg-purple-950/70 text-purple-200 px-2.5 py-1 rounded-full border border-purple-500/40 shadow-2xs max-w-[280px] truncate"
                title={evidenceDetails.culturalBridge}
              >
                <HeartHandshake className="w-3 h-3 text-purple-300 shrink-0" aria-hidden="true" />
                <span className="truncate">{evidenceDetails.culturalBridge}</span>
              </span>
            )}

            {/* GOLD / AMBER BADGES: Conversation Potential Signals */}
            {conversationPotentialScore >= 60 && (
              <span
                role="listitem"
                className="inline-flex items-center gap-1 text-[11px] font-semibold bg-amber-950/70 text-amber-200 px-2.5 py-1 rounded-full border border-amber-500/40 shadow-2xs"
                title={`Índice de Potencial Conversacional: ${conversationPotentialScore}%`}
              >
                <MessageCircle className="w-3 h-3 text-amber-300 shrink-0" aria-hidden="true" />
                <span>Potencial de Conversa ({conversationPotentialScore}%)</span>
              </span>
            )}

            {targetProfile.online && (
              <span
                role="listitem"
                className="inline-flex items-center gap-1 text-[11px] font-semibold bg-amber-950/70 text-amber-200 px-2.5 py-1 rounded-full border border-amber-500/40 shadow-2xs"
                title="Membro com alta prontidão para responder"
              >
                <Zap className="w-3 h-3 text-amber-300 shrink-0" aria-hidden="true" />
                <span>Online · Prontidão</span>
              </span>
            )}

            {targetProfile.bio && targetProfile.bio.trim().length > 30 && (
              <span
                role="listitem"
                className="inline-flex items-center gap-1 text-[11px] font-semibold bg-amber-950/70 text-amber-200 px-2.5 py-1 rounded-full border border-amber-500/40 shadow-2xs"
                title="Perfil com apresentação detalhada e rica em contexto"
              >
                <Sparkles className="w-3 h-3 text-amber-300 shrink-0" aria-hidden="true" />
                <span>Bio Expressiva</span>
              </span>
            )}

            {((evidenceDetails?.conversationStarters?.length ?? 0) > 0 || currentCandidate.conversationPrompt) && (
              <span
                role="listitem"
                className="inline-flex items-center gap-1 text-[11px] font-semibold bg-amber-950/70 text-amber-200 px-2.5 py-1 rounded-full border border-amber-500/40 shadow-2xs"
                title="Quebra-gelo sugerido disponível"
              >
                <Flame className="w-3 h-3 text-amber-300 shrink-0" aria-hidden="true" />
                <span>Quebra-Gelo Ativo</span>
              </span>
            )}
          </div>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          {/* RELATIONAL MEMORY: FERTILE CONDITIONS FIT BANNER */}
          {conditionFitness.fitnessScore >= 0.65 && (
            <div
              id="relational-memory-fit-callout"
              className="p-3.5 bg-gradient-to-br from-rose-500/10 via-amber-500/10 to-purple-500/10 border border-rose-200/90 rounded-xl space-y-2 shadow-2xs"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-rose-950 flex items-center gap-1.5 font-serif">
                  <Brain className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                  <span>Memória Relacional · {Math.round(conditionFitness.fitnessScore * 100)}% de Fertilidade</span>
                </span>
                <span className="text-[9px] font-bold text-rose-800 bg-white/90 px-2 py-0.5 rounded-full border border-rose-200 shadow-2xs uppercase tracking-wider">
                  Condições Férteis
                </span>
              </div>
              <p className="text-xs text-stone-800 leading-relaxed font-sans font-medium">
                "{conditionFitness.fertileReasoning}"
              </p>
              {conditionFitness.matchedConditions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {conditionFitness.matchedConditions.map((cond, cIdx) => (
                    <span
                      key={cIdx}
                      className="inline-flex items-center gap-1 text-[10px] font-semibold bg-white/95 px-2 py-0.5 rounded-md border border-rose-200/80 text-stone-800 shadow-2xs"
                    >
                      <Check className="w-2.5 h-2.5 text-emerald-600" />
                      <span>{cond}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SERENDIPITY SPECIAL CALLOUT (DESCOBERTA INESPERADA) */}
          {(currentCandidate.discoveryMode === 'SERENDIPITY' || currentCandidate.serendipityInsight) && (
            <div
              id="serendipity-insight-callout"
              className="p-3 bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-purple-500/10 border border-amber-300/60 rounded-xl flex items-start gap-2.5 shadow-2xs"
            >
              <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs">
                <span className="font-bold text-amber-900 block font-serif">✦ Descoberta Inesperada</span>
                <p className="text-stone-700 leading-relaxed mt-0.5">
                  {currentCandidate.serendipityInsight || 'Perfis com trajetórias distintas, mas um ritmo comunicativo e abertura surpreendentemente alinhados.'}
                </p>
              </div>
            </div>
          )}

          {/* CANDIDATE IDENTITY BLOCK (POSITIONED DIRECTLY BELOW REASON HEADER) */}
          <div className="flex items-center justify-between pb-3 border-b border-stone-100">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl" role="img" aria-label={targetProfile.countryName}>
                {countryInfo.flag}
              </span>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-bold text-stone-900 text-base leading-none">
                    {targetProfile.displayName}, {targetProfile.age}
                  </h3>
                  {targetProfile.verificationStatus === 'verified' && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" title="Perfil Verificado" />
                  )}
                </div>
                <p className="text-xs text-stone-500 font-medium flex items-center gap-1 mt-1">
                  <MapPin className="w-3 h-3 text-stone-400" />
                  <span>{targetProfile.cityName}, {targetProfile.countryName}</span>
                </p>
              </div>
            </div>

            <div className="flex flex-col items-end gap-1">
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>{targetProfile.online ? 'Online' : 'Membro Ativo'}</span>
              </span>
              <span className="text-[10px] text-stone-400 font-medium">
                Relevância: {Math.round((prioritization?.finalCompositeRank ?? 0.85) * 100)}%
              </span>
            </div>
          </div>

          {/* TRUST GRAPH BADGES ROW (PONTO 3: CONFIRMAÇÃO NÃO-PUNITIVA) */}
          {currentCandidate.trustBadges && currentCandidate.trustBadges.length > 0 && (
            <div
              id="candidate-trust-badges-row"
              className="flex flex-wrap items-center gap-1.5 py-1"
              aria-label="Distintivos de Confiança ÉNós"
            >
              {currentCandidate.trustBadges.slice(0, 3).map((badge, bIdx) => (
                <span
                  key={bIdx}
                  title={badge.description}
                  className="inline-flex items-center gap-1 text-[10px] font-semibold bg-stone-100 text-stone-800 px-2 py-0.5 rounded-full border border-stone-200 shadow-2xs"
                >
                  <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0" />
                  <span>{badge.label}</span>
                </span>
              ))}
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────
              DYNAMIC UI MARKERS: Cultural Connection vs Conversation Potential
              ───────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* MARKER 1: CULTURAL CONNECTION */}
            <div
              id="marker-cultural-connection"
              className={`p-3 rounded-xl border transition-all ${
                isDominantCultural
                  ? 'bg-teal-50/80 border-teal-200 ring-1 ring-teal-300/50'
                  : 'bg-stone-50 border-stone-200/80'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="flex items-center gap-1.5 text-xs font-bold text-teal-950">
                  <Globe className="w-3.5 h-3.5 text-teal-600" />
                  <span>Conexão Cultural</span>
                </span>
                <span className="text-[10px] font-bold bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full border border-teal-200">
                  {culturalConnectionScore}%
                </span>
              </div>

              {/* Bilateral Flags and Regional Synergy */}
              <div className="flex items-center gap-1.5 text-[11px] text-teal-900 font-medium py-1">
                <span className="text-sm">{myCountryInfo.flag}</span>
                <span>{myProfile.cityName}</span>
                <span className="text-teal-400 font-bold">⟷</span>
                <span className="text-sm">{countryInfo.flag}</span>
                <span>{targetProfile.cityName}</span>
              </div>

              <p className="text-[10px] text-teal-800 leading-tight mt-0.5 line-clamp-2">
                {evidenceDetails?.culturalBridge || 'Partilha de tradições, identidade atlântica e raízes da Lusofonia.'}
              </p>
            </div>

            {/* MARKER 2: CONVERSATION POTENTIAL */}
            <div
              id="marker-conversation-potential"
              className={`p-3 rounded-xl border transition-all ${
                !isDominantCultural
                  ? 'bg-rose-50/80 border-rose-200 ring-1 ring-rose-300/50'
                  : 'bg-stone-50 border-stone-200/80'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="flex items-center gap-1.5 text-xs font-bold text-rose-950">
                  <MessageCircle className="w-3.5 h-3.5 text-rose-600" />
                  <span>Potencial de Conversa</span>
                </span>
                <span className="text-[10px] font-bold bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full border border-rose-200">
                  {conversationPotentialScore}%
                </span>
              </div>

              {/* Conversation Trigger Cue */}
              <div className="flex items-center gap-1.5 text-[11px] text-rose-900 font-medium py-1">
                <Zap className="w-3 h-3 text-rose-500 shrink-0" />
                <span className="truncate">
                  {targetProfile.online ? 'Online agora · Resposta rápida' : 'Bio profunda & ativa'}
                </span>
              </div>

              <p className="text-[10px] text-rose-800 leading-tight mt-0.5 line-clamp-2">
                {currentCandidate.conversationPrompt || (evidenceDetails?.conversationStarters?.[0] ?? 'Pontos de diálogo e curiosidades para iniciar a troca.')}
              </p>
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────
              PROGRESSIVE REVELATION TABS
              ───────────────────────────────────────────────────────── */}
          <div className="space-y-3 pt-1 border-t border-stone-100">
            <div className="flex items-center justify-between bg-stone-100 p-1 rounded-xl text-[10px] font-semibold text-stone-600">
              <button
                type="button"
                id="tab-step-affinity"
                onClick={() => setActiveStep('affinity')}
                className={`flex-1 py-1.5 rounded-lg transition text-center cursor-pointer ${
                  activeStep === 'affinity' ? 'bg-white text-rose-600 shadow-2xs font-bold' : 'hover:text-stone-900'
                }`}
              >
                1. Afinidade
              </button>
              <button
                type="button"
                id="tab-step-curiosity"
                onClick={() => setActiveStep('curiosity')}
                className={`flex-1 py-1.5 rounded-lg transition text-center cursor-pointer ${
                  activeStep === 'curiosity' ? 'bg-white text-rose-600 shadow-2xs font-bold' : 'hover:text-stone-900'
                }`}
              >
                2. Expressão
              </button>
              <button
                type="button"
                id="tab-step-revelation"
                onClick={() => setActiveStep('revelation')}
                className={`flex-1 py-1.5 rounded-lg transition text-center cursor-pointer ${
                  activeStep === 'revelation' ? 'bg-white text-rose-600 shadow-2xs font-bold' : 'hover:text-stone-900'
                }`}
              >
                3. Voz & Tom
              </button>
              <button
                type="button"
                id="tab-step-conversation"
                onClick={() => setActiveStep('conversation')}
                className={`flex-1 py-1.5 rounded-lg transition text-center cursor-pointer ${
                  activeStep === 'conversation' ? 'bg-white text-rose-600 shadow-2xs font-bold' : 'hover:text-stone-900'
                }`}
              >
                4. Presença
              </button>
            </div>

            {/* TAB CONTENT PANELS */}
            <AnimatePresence mode="wait">
              {activeStep === 'affinity' && (
                <motion.div
                  key="step-affinity"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="space-y-2.5 p-3 bg-stone-50 rounded-xl border border-stone-200/70"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{countryInfo.flag}</span>
                      <div>
                        <h3 className="font-bold text-stone-900 text-sm">{targetProfile.displayName}, {targetProfile.age}</h3>
                        <p className="text-[11px] text-stone-500 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-stone-400" />
                          <span>{targetProfile.cityName}, {targetProfile.countryName}</span>
                        </p>
                      </div>
                    </div>

                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span>{targetProfile.online ? 'Online' : 'Ativo recentemente'}</span>
                    </span>
                  </div>

                  <div className="pt-1">
                    <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block mb-1.5">
                      Interesses & Afinidades Partilhadas
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {targetProfile.interests.map(i => {
                        const isShared = myProfile.interests.includes(i);
                        return (
                          <span
                            key={i}
                            className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                              isShared
                                ? 'bg-rose-100/80 text-rose-800 border border-rose-200 font-bold'
                                : 'bg-white text-stone-600 border border-stone-200'
                            }`}
                          >
                            {isShared ? `✓ ${i}` : i}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              )}

              {activeStep === 'curiosity' && (
                <motion.div
                  key="step-curiosity"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="p-3.5 bg-stone-50 rounded-xl border border-stone-200/80 space-y-2.5"
                >
                  <span className="text-[10px] font-bold text-stone-500 uppercase block">Bio & Perspetiva de Vida</span>
                  <p className="text-xs text-stone-800 leading-relaxed font-serif italic bg-white p-2.5 rounded-lg border border-stone-200/60">
                    "{targetProfile.bio || 'Criando pontes e conexões genuínas na comunidade lusófona.'}"
                  </p>

                  {/* Conversation Starter Prompt */}
                  <div className="pt-1">
                    <span className="text-[10px] font-bold text-rose-800 uppercase flex items-center gap-1 mb-1">
                      <Lightbulb className="w-3 h-3 text-amber-500" />
                      <span>Ponto de partida sugerido:</span>
                    </span>
                    <p className="text-[11px] text-stone-700 bg-amber-50/60 p-2 rounded-lg border border-amber-200/60 font-medium">
                      "{currentCandidate.conversationPrompt || evidenceDetails?.conversationStarters?.[0] || 'O que mais te apaixona na tua cidade e cultura?'}"
                    </p>
                  </div>
                </motion.div>
              )}

              {activeStep === 'revelation' && (
                <motion.div
                  key="step-revelation"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="p-3.5 bg-rose-50/50 rounded-xl border border-rose-100 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-rose-900 flex items-center gap-1.5">
                      <Volume2 className="w-3.5 h-3.5 text-rose-600" />
                      <span>Cadência, Sotaque e Calor Lusófono</span>
                    </span>
                    <span className="text-[10px] text-stone-500">15s de voz</span>
                  </div>

                  <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-rose-200/60 shadow-2xs">
                    <button
                      type="button"
                      id="btn-toggle-voice-audio"
                      onClick={() => setIsPlayingAudio(!isPlayingAudio)}
                      className="w-9 h-9 rounded-full bg-rose-600 text-white flex items-center justify-center hover:bg-rose-700 transition cursor-pointer shadow-xs shrink-0"
                    >
                      {isPlayingAudio ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </button>
                    <div className="flex-1">
                      <div className="flex items-center gap-0.5 h-4">
                        {[40, 75, 50, 90, 60, 30, 85, 95, 45, 60, 80, 55, 35, 70, 60, 85, 40].map((h, i) => (
                          <div
                            key={i}
                            className={`flex-1 rounded-full transition-all duration-300 ${
                              isPlayingAudio ? 'bg-rose-500 animate-pulse' : 'bg-stone-200'
                            }`}
                            style={{ height: `${h}%` }}
                          />
                        ))}
                      </div>
                      <span className="text-[9px] text-stone-500 block mt-1 font-medium">
                        {isPlayingAudio ? 'A reproduzir cadência autêntica...' : 'Toque para escutar a voz e o sotaque'}
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeStep === 'conversation' && (
                <motion.div
                  key="step-conversation"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="relative aspect-4/3 w-full rounded-xl overflow-hidden bg-stone-100 border border-stone-200"
                >
                  <OptimizedImage
                    src={targetProfile.profilePhoto}
                    alt={targetProfile.displayName}
                    variant="card"
                    aspectRatio="auto"
                    showSavingsBadge={true}
                    className="w-full h-full"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3 text-white flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm">{targetProfile.displayName}, {targetProfile.age}</span>
                        <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                      </div>
                      <p className="text-[10px] text-white/80">{targetProfile.cityName}, {targetProfile.countryName}</p>
                    </div>
                    <span className="text-2xl">{countryInfo.flag}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* AI EXPLANATION ON DEMAND */}
          {selectiveAiExplanation ? (
            <div className="p-3 bg-rose-50/70 rounded-xl border border-rose-100 text-xs text-stone-800 leading-relaxed italic font-serif">
              <span className="font-sans font-bold text-[10px] text-rose-700 block not-italic mb-1 uppercase tracking-wider">
                Análise de Afinidade Profunda
              </span>
              "{selectiveAiExplanation}"
            </div>
          ) : (
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-stone-500">Quer saber mais sobre este match?</span>
              <button
                type="button"
                id="btn-request-ai-explanation"
                onClick={handleRequestAiInsight}
                disabled={loadingAi}
                className="text-[11px] font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer transition"
              >
                <Sparkles className="w-3 h-3 text-rose-500" />
                <span>{loadingAi ? 'Aprofundando...' : 'Explicar com IA'}</span>
              </button>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────
              CARD ACTIONS: Passar / Próximo vs Aproximar & Conversar
              ───────────────────────────────────────────────────────── */}
          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              id="btn-next-signal"
              onClick={handleNextSignal}
              className="flex-1 py-3 px-3 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl font-medium text-xs transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-98"
            >
              <span>Próximo Sinal</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              id="btn-initiate-approach"
              onClick={() => handleInitiateApproach(primaryReason)}
              className="flex-1 py-3 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-98"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>Aproximar & Conversar</span>
            </button>
          </div>
        </div>
      </motion.div>

      {/* ─────────────────────────────────────────────────────────────
          EXPANDABLE COMMUNITY INSPIRATION (OPTIONAL & DISCREET)
          ───────────────────────────────────────────────────────────── */}
      <div className="border border-stone-200/80 rounded-xl bg-white overflow-hidden shadow-2xs">
        <button
          type="button"
          id="btn-toggle-community-question"
          onClick={() => setShowCommunityPrompt(!showCommunityPrompt)}
          className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-semibold text-stone-700 hover:bg-stone-50 transition cursor-pointer"
        >
          <span className="flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-amber-500" />
            <span>Pergunta da Lusofonia do Dia: {currentQuestion.theme}</span>
          </span>
          <span className="text-[10px] text-rose-600 font-bold">
            {showCommunityPrompt ? 'Ocultar' : 'Ver & Partilhar'}
          </span>
        </button>

        {showCommunityPrompt && (
          <div className="p-4 border-t border-stone-100 bg-stone-50/50 space-y-3">
            <p className="text-xs font-bold text-stone-900 font-serif">
              "{currentQuestion.question}"
            </p>

            {savedUserResponse ? (
              <div className="p-2.5 bg-white rounded-lg border border-stone-200 text-xs text-stone-800 flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-bold text-stone-500 block">Tua Resposta Partilhada:</span>
                  <p className="mt-0.5 italic">"{savedUserResponse}"</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSavedUserResponse(null)}
                  className="text-[10px] text-rose-600 font-bold hover:underline shrink-0 cursor-pointer"
                >
                  Editar
                </button>
              </div>
            ) : (
              <form onSubmit={handleSaveUserResponse} className="flex gap-2">
                <input
                  type="text"
                  value={userQuestionResponse}
                  onChange={e => setUserQuestionResponse(e.target.value)}
                  placeholder="Partilha a tua resposta..."
                  className="flex-1 px-3 py-1.5 bg-white border border-stone-200 rounded-lg text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-amber-500"
                />
                <button
                  type="submit"
                  disabled={!userQuestionResponse.trim() || isSubmittingResponse}
                  className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700 disabled:opacity-40 transition cursor-pointer"
                >
                  Partilhar
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

