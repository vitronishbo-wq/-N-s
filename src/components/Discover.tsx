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
import { persistCommunityAnswer, persistDiscoveryEvent } from '../services/discoveryPersistence';
import { CPLP_COUNTRIES } from '../constants';
import {
  Sparkles,
  MessageCircle,
  MapPin,
  Globe,
  ShieldAlert,
  SlidersHorizontal,
  RefreshCw,
  Layers,
  Volume2,
  Send,
  HelpCircle,
  Activity,
  ArrowRight,
  UserCheck,
  Compass,
  Radio,
  HeartHandshake,
  Lightbulb,
  CheckCircle,
  Clock,
  Flame,
  VolumeX
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

// 2.6: Pergunta que Une data contract
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
      },
      {
        candidateUid: 'demo_camila_br',
        answer: 'Os tambores do Olodum ecoando pelo Pelourinho em Salvador.',
        highlight: 'Axé & Conexão Afro-Brasileira',
        timeAgo: 'há 2h'
      },
      {
        candidateUid: 'demo_antonio_mz',
        answer: 'Marrabenta animada tocada na rádio comunitária em Maputo.',
        highlight: 'Marrabenta & Energia',
        timeAgo: 'há 3h'
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
      },
      {
        candidateUid: 'demo_antonio_mz',
        answer: 'A praia da Costa do Sol ao pôr-do-sol quando a cidade desacelera.',
        highlight: 'Calmaria & Oceano',
        timeAgo: 'há 2h'
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
      },
      {
        candidateUid: 'demo_camila_br',
        answer: 'Gente com coração generoso, que ri alto e não tem medo de ser autêntica.',
        highlight: 'Leveza & Verdade',
        timeAgo: 'há 1h'
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

  // 2.12: Progressive revelation phase: 'affinity' -> 'curiosity' -> 'revelation' -> 'conversation'
  const [activeStep, setActiveStep] = useState<'affinity' | 'curiosity' | 'revelation' | 'conversation'>('affinity');
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  // 2.6 & 2.7: Pergunta que Une State
  const [selectedQuestionIdx, setSelectedQuestionIdx] = useState(0);
  const [userQuestionResponse, setUserQuestionResponse] = useState('');
  const [isSubmittingResponse, setIsSubmittingResponse] = useState(false);
  const [savedUserResponse, setSavedUserResponse] = useState<string | null>(() => {
    try {
      return localStorage.getItem('enos_user_daily_answer');
    } catch {
      return null;
    }
  });

  // Evaluate discovery feed on dependencies change
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

  // 2.2 & 2.3: Singular contextual candidate prioritizer
  const currentCandidate: DiscoveryCandidate | undefined = candidates[currentIndex];
  const targetProfile = currentCandidate?.profile;

  // Preload primary candidate media
  useEffect(() => {
    if (candidates.length > 0 && currentIndex < candidates.length) {
      discoveryService.preloadCandidateMedia(candidates.slice(currentIndex, currentIndex + 2));
    }
  }, [currentIndex, candidates]);

  // Record candidate seen & telemetry persistence (2.18 & 2.19)
  useEffect(() => {
    if (targetProfile && myProfile?.uid) {
      onRecordSeen(targetProfile.uid);
      discoveryService.markSeenInSession(targetProfile.uid);
      persistDiscoveryEvent(myProfile.uid, targetProfile.uid, 'candidate_shown', {
        compatibilityReasons: currentCandidate?.compatibilityReasons || [],
        compositeRank: currentCandidate?.prioritizationScore?.finalCompositeRank || 0
      });
    }
  }, [targetProfile?.uid, myProfile?.uid]);

  // Reset revelation step on candidate switch
  useEffect(() => {
    setActiveStep('affinity');
    setSelectiveAiExplanation(null);
    setIsPlayingAudio(false);
  }, [targetProfile?.uid]);

  // AI Explainer on demand (2.5)
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

  // 2.9 & 2.12: Initiate Conversation with Reason Context
  const handleInitiateApproach = (customReason?: string) => {
    if (!currentCandidate || !myProfile?.uid) return;

    confetti({
      particleCount: 35,
      spread: 60,
      origin: { y: 0.8 },
      colors: ['#e11d48', '#fb7185', '#f43f5e']
    });

    const reasonToUse = customReason || currentCandidate.discoveryReason || currentCandidate.compatibilityReasons[0] || 'valores e vivências';
    const contextText = customReason
      ? `Olá, ${targetProfile?.displayName}! Fiquei curioso(a) com a nossa conexão sobre "${customReason}". Vamos conversar? 🌍✨`
      : `Olá, ${targetProfile?.displayName}! Notei a nossa afinidade em ${reasonToUse}. Adoraria trocar ideias!`;

    // 2.18 & 2.19 & 3.7: Persist approach telemetry with discoveryMode
    persistDiscoveryEvent(myProfile.uid, targetProfile?.uid || '', 'approach_initiated', {
      contextReason: reasonToUse,
      discoveryMode: currentCandidate.discoveryMode
    });

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

  // 2.7: Persist user response to Firestore
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

  // Helper to find a candidate matching sample answer (2.8)
  const findCandidateByUid = (uid: string): DiscoveryCandidate | undefined => {
    return candidates.find(c => c.profile.uid === uid) ||
      (candidatePool.find(p => p.uid === uid)
        ? {
            profile: candidatePool.find(p => p.uid === uid)!,
            compatibilityScore: 88,
            deterministicScore: 85,
            contextScore: 3,
            noveltyBonus: 0,
            confidence: 0.9,
            compatibilityReasons: ['Sintonia viva em Pergunta da Comunidade'],
            compatibilityResult: {
              score: 88,
              reasons: ['Sintonia viva em Pergunta da Comunidade'],
              sharedInterests: [],
              intentAlignment: 'compatible',
              culturalConnection: 'cross_cultural_cplp',
              confidence: 0.9
            }
          }
        : undefined);
  };

  if (!targetProfile || currentIndex >= candidates.length || availability === 'NO_CANDIDATES') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-sm mx-auto">
        <div className="w-16 h-16 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center mb-4 text-rose-600 shadow-2xs">
          <Globe className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-stone-900 mb-2">O teu Agora está em dia</h3>
        <p className="text-xs text-stone-600 leading-relaxed mb-6">
          {scarcityMessage || 'Você explorou todas as razões de descoberta disponíveis para este momento.'}
        </p>

        <div className="flex flex-col gap-2 w-full">
          <button
            type="button"
            onClick={() => {
              discoveryService.resetSession();
              setCurrentIndex(0);
            }}
            className="w-full py-2.5 bg-stone-900 text-white rounded-xl font-medium text-xs hover:bg-stone-800 transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Rever Sinais e Conexões</span>
          </button>

          {onOpenPreferences && (
            <button
              type="button"
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

  // Primary Discovery Reason (3.1 & 3.2: Evidence-Grounded Reason-First)
  const primaryReason = currentCandidate.discoveryReason ||
    currentCandidate.crossCulturalHighlight ||
    currentCandidate.compatibilityReasons[0] ||
    `Sintonia de vivências entre ${myProfile.cityName} e ${targetProfile.cityName}`;

  const evidenceDetails = currentCandidate.evidenceDetails;
  const evidenceItems = Array.isArray(currentCandidate.evidence) ? currentCandidate.evidence : [];

  const discoveryModeLabel = currentCandidate.discoveryMode === 'CULTURAL_BRIDGE'
    ? 'Ponte Cultural'
    : currentCandidate.discoveryMode === 'COMPLEMENTARITY'
      ? 'Diferenças Enriquecedoras'
      : currentCandidate.discoveryMode === 'SERENDIPITY'
        ? 'Descoberta Inesperada'
        : currentCandidate.discoveryMode === 'DEEP_CONVERSATION'
          ? 'Diálogo Profundo'
          : 'Sintonia Autêntica';

  return (
    <div className="flex-1 flex flex-col max-w-md mx-auto w-full p-4 pb-24 space-y-6">
      {/* Top Header of "O teu Agora" (2.1: Intelligent Layer over Discovery) */}
      <div className="flex items-center justify-between border-b border-stone-200/80 pb-3">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-rose-600 font-bold uppercase tracking-wider">
            <Compass className="w-3.5 h-3.5" />
            <span>O teu Agora</span>
          </div>
          <p className="text-xs text-stone-500 font-medium mt-0.5">
            Sinais, perguntas e encontros ao vivo na Lusofonia
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Pulso Vivo</span>
          </span>
          <button
            type="button"
            onClick={() => onReport(currentCandidate)}
            title="Denunciar / Segurança"
            className="text-stone-400 hover:text-stone-700 p-1 rounded-lg transition cursor-pointer"
          >
            <ShieldAlert className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          SUPERFÍCIE 1: CONEXÃO IMPROVÁVEL (2.2, 2.3, 2.4, 2.5, 3.1: Singular Candidate Experience)
          "Há uma pessoa que devias conhecer. Eis porquê."
          ───────────────────────────────────────────────────────────── */}
      <section className="bg-white rounded-2xl border border-stone-200/90 shadow-xs overflow-hidden">
        {/* 2.4: Presentation Banner */}
        <div className="px-4 py-3 bg-gradient-to-r from-rose-50 via-amber-50/40 to-white border-b border-stone-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-rose-600 text-white rounded-lg shadow-2xs">
              <HeartHandshake className="w-3.5 h-3.5" />
            </span>
            <div>
              <h2 className="text-xs font-bold text-stone-900 tracking-tight">Conexão Improvável</h2>
              <span className="text-[10px] text-rose-700 font-medium">Há uma pessoa que devias conhecer. Eis porquê:</span>
            </div>
          </div>

          <span className="text-[10px] bg-rose-100/70 text-rose-800 font-bold px-2 py-0.5 rounded-full border border-rose-200">
            {discoveryModeLabel}
          </span>
        </div>

        <div className="p-4 space-y-4">
          {/* 3.2: Composed Real Evidence Header (Interests + Intent + Context + Signals + Differences) */}
          <div className="bg-stone-50 rounded-xl p-3.5 border border-stone-200/80 space-y-2.5">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-stone-800 uppercase tracking-wide">
              <Flame className="w-3.5 h-3.5 text-rose-500" />
              <span>Razão da Descoberta</span>
            </div>
            
            <p className="text-xs text-stone-900 font-semibold leading-relaxed">
              "{primaryReason}"
            </p>

            {/* Evidence Chips */}
            <div className="space-y-1.5 pt-1">
              {evidenceDetails?.culturalBridge && (
                <div className="flex items-center gap-1.5 text-[10px] text-stone-700">
                  <Globe className="w-3 h-3 text-rose-500 shrink-0" />
                  <span>{evidenceDetails.culturalBridge}</span>
                </div>
              )}
              {evidenceDetails?.intentMatch && (
                <div className="flex items-center gap-1.5 text-[10px] text-stone-700">
                  <CheckCircle className="w-3 h-3 text-emerald-600 shrink-0" />
                  <span>{evidenceDetails.intentMatch}</span>
                </div>
              )}
              {evidenceDetails?.sharedInterests && evidenceDetails.sharedInterests.length > 0 && (
                <div className="flex flex-wrap items-center gap-1 pt-0.5">
                  <span className="text-[10px] text-stone-500 font-medium mr-1">Afinidades:</span>
                  {evidenceDetails.sharedInterests.map((interest, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center text-[10px] font-medium bg-rose-50 text-rose-700 px-2 py-0.5 rounded-md border border-rose-200/60"
                    >
                      {interest}
                    </span>
                  ))}
                </div>
              )}
              {evidenceDetails?.relevantDifferences && evidenceDetails.relevantDifferences.length > 0 && (
                <div className="flex items-center gap-1 text-[10px] text-stone-500 italic pt-0.5">
                  <Lightbulb className="w-3 h-3 text-amber-500 shrink-0" />
                  <span>Diferença enriquecedora: {evidenceDetails.relevantDifferences[0]}</span>
                </div>
              )}
            </div>
          </div>

          {/* 2.5: Contextual Explainability */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-stone-800 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-stone-500" />
                <span>Explicabilidade Contextual</span>
              </span>
              {!selectiveAiExplanation && (
                <button
                  type="button"
                  onClick={handleRequestAiInsight}
                  disabled={loadingAi}
                  className="text-[11px] font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles className="w-3 h-3" />
                  {loadingAi ? 'Analisando...' : 'Aprofundar com IA'}
                </button>
              )}
            </div>

            {selectiveAiExplanation ? (
              <div className="p-2.5 bg-rose-50/60 rounded-xl border border-rose-100 text-xs text-stone-800 leading-relaxed italic">
                {selectiveAiExplanation}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2 bg-stone-50 rounded-lg border border-stone-100">
                  <span className="text-stone-500 block text-[10px]">Origem & Residência</span>
                  <span className="font-medium text-stone-800">{targetProfile.cityName}, {targetProfile.countryName}</span>
                </div>
                <div className="p-2 bg-stone-50 rounded-lg border border-stone-100">
                  <span className="text-stone-500 block text-[10px]">Status na Comunidade</span>
                  <span className="font-medium text-stone-800">{targetProfile.online ? 'Online agora' : 'Membro ativo'}</span>
                </div>
              </div>
            )}
          </div>

          {/* 2.12: Progressive Revelation: Afinidade → Curiosidade → Revelação → Conversa */}
          <div className="pt-2 border-t border-stone-100 space-y-3">
            {/* Step Navigation Bar */}
            <div className="flex items-center justify-between bg-stone-100 p-1 rounded-xl text-[10px] font-semibold text-stone-600">
              <button
                type="button"
                onClick={() => setActiveStep('affinity')}
                className={`flex-1 py-1 rounded-lg transition text-center cursor-pointer ${
                  activeStep === 'affinity' ? 'bg-white text-rose-600 shadow-2xs font-bold' : 'hover:text-stone-900'
                }`}
              >
                1. Afinidade
              </button>
              <button
                type="button"
                onClick={() => setActiveStep('curiosity')}
                className={`flex-1 py-1 rounded-lg transition text-center cursor-pointer ${
                  activeStep === 'curiosity' ? 'bg-white text-rose-600 shadow-2xs font-bold' : 'hover:text-stone-900'
                }`}
              >
                2. Curiosidade
              </button>
              <button
                type="button"
                onClick={() => setActiveStep('revelation')}
                className={`flex-1 py-1 rounded-lg transition text-center cursor-pointer ${
                  activeStep === 'revelation' ? 'bg-white text-rose-600 shadow-2xs font-bold' : 'hover:text-stone-900'
                }`}
              >
                3. Voz & Tom
              </button>
              <button
                type="button"
                onClick={() => setActiveStep('conversation')}
                className={`flex-1 py-1 rounded-lg transition text-center cursor-pointer ${
                  activeStep === 'conversation' ? 'bg-white text-rose-600 shadow-2xs font-bold' : 'hover:text-stone-900'
                }`}
              >
                4. Pessoa
              </button>
            </div>

            {/* Step Content */}
            <AnimatePresence mode="wait">
              {activeStep === 'affinity' && (
                <motion.div
                  key="step-affinity"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{countryInfo.flag}</span>
                    <div>
                      <h3 className="font-bold text-stone-900 text-sm">{targetProfile.displayName}, {targetProfile.age}</h3>
                      <p className="text-[11px] text-stone-500 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-stone-400" />
                        <span>{targetProfile.cityName}, {targetProfile.countryName}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {targetProfile.interests.map(i => {
                      const isShared = myProfile.interests.includes(i);
                      return (
                        <span
                          key={i}
                          className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            isShared ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-stone-100 text-stone-600'
                          }`}
                        >
                          {i}
                        </span>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {activeStep === 'curiosity' && (
                <motion.div
                  key="step-curiosity"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="p-3 bg-stone-50 rounded-xl border border-stone-200/80 space-y-2"
                >
                  <span className="text-[10px] font-bold text-stone-500 uppercase block">Expressão & Essência</span>
                  <p className="text-xs text-stone-800 leading-relaxed font-serif italic">
                    "{targetProfile.bio || 'Criando pontes e conexões genuínas na comunidade lusófona.'}"
                  </p>
                  {evidenceDetails?.conversationStarters && evidenceDetails.conversationStarters.length > 0 && (
                    <div className="pt-1 border-t border-stone-200/50">
                      <span className="text-[9px] font-bold text-rose-800 uppercase block mb-1">Ponto de partida sugerido:</span>
                      <p className="text-[11px] text-stone-700 bg-white p-2 rounded-lg border border-stone-200/70">
                        "{evidenceDetails.conversationStarters[0]}"
                      </p>
                    </div>
                  )}
                </motion.div>
              )}

              {activeStep === 'revelation' && (
                <motion.div
                  key="step-revelation"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="p-3 bg-rose-50/50 rounded-xl border border-rose-100 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-rose-900 flex items-center gap-1.5">
                      <Volume2 className="w-3.5 h-3.5 text-rose-600" />
                      <span>Cadência, Sotaque e Calor</span>
                    </span>
                    <span className="text-[10px] text-stone-500">15s de voz</span>
                  </div>

                  <div className="flex items-center gap-3 bg-white p-2.5 rounded-xl border border-rose-200/60">
                    <button
                      type="button"
                      onClick={() => setIsPlayingAudio(!isPlayingAudio)}
                      className="w-8 h-8 rounded-full bg-rose-600 text-white flex items-center justify-center hover:bg-rose-700 transition cursor-pointer shadow-xs shrink-0"
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
                      <span className="text-[9px] text-stone-500 block mt-1">
                        {isPlayingAudio ? 'Ouvindo tom caloroso...' : 'Toque para escutar a voz e tom'}
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
                  <img
                    src={targetProfile.profilePhoto}
                    alt={targetProfile.displayName}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                  <div className="absolute bottom-2.5 left-3 right-3 text-white flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm">{targetProfile.displayName}, {targetProfile.age}</span>
                        <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                      </div>
                      <p className="text-[10px] text-white/80">{targetProfile.cityName}, {targetProfile.countryName}</p>
                    </div>
                    <span className="text-xl">{countryInfo.flag}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Action Buttons: 2.9 & 2.12: Aproximação (Conversa) vs Próximo Sinal */}
          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              id="btn-next-signal"
              onClick={handleNextSignal}
              className="flex-1 py-2.5 px-3 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl font-medium text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Próximo Sinal</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              id="btn-initiate-approach"
              onClick={() => handleInitiateApproach(primaryReason)}
              className="flex-1 py-2.5 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>Aproximar & Conversar</span>
            </button>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SUPERFÍCIE 2: PERGUNTA QUE UNE (2.6, 2.7, 2.8, 2.9: Respostas como entrada de conversa)
          ───────────────────────────────────────────────────────────── */}
      <section className="bg-white rounded-2xl border border-stone-200/90 shadow-xs overflow-hidden">
        {/* Surface Header */}
        <div className="px-4 py-3 bg-gradient-to-r from-amber-50/80 via-stone-50 to-white border-b border-stone-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-amber-500 text-white rounded-lg shadow-2xs">
              <HelpCircle className="w-3.5 h-3.5" />
            </span>
            <div>
              <h2 className="text-xs font-bold text-stone-900 tracking-tight">Pergunta que Une</h2>
              <span className="text-[10px] text-stone-500">{currentQuestion.countryContext}</span>
            </div>
          </div>

          {/* Question Selector Dots */}
          <div className="flex items-center gap-1">
            {LUSOFONE_QUESTIONS.map((q, idx) => (
              <button
                key={q.id}
                type="button"
                onClick={() => setSelectedQuestionIdx(idx)}
                className={`w-2 h-2 rounded-full transition cursor-pointer ${
                  selectedQuestionIdx === idx ? 'bg-amber-600 w-4' : 'bg-stone-300'
                }`}
                title={q.theme}
              />
            ))}
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Active Question Prompt */}
          <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-100 space-y-1">
            <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">{currentQuestion.theme}</span>
            <p className="text-xs text-stone-900 font-bold leading-relaxed">
              "{currentQuestion.question}"
            </p>
          </div>

          {/* User's Own Answer Input / Display (2.7: Persisted in Firestore) */}
          {savedUserResponse ? (
            <div className="p-3 bg-stone-50 rounded-xl border border-stone-200/80 flex items-start justify-between gap-2">
              <div>
                <span className="text-[10px] font-bold text-stone-500 block">Tua Resposta Partilhada:</span>
                <p className="text-xs text-stone-900 font-medium mt-0.5">"{savedUserResponse}"</p>
              </div>
              <button
                type="button"
                onClick={() => setSavedUserResponse(null)}
                className="text-[10px] text-rose-600 font-semibold hover:underline shrink-0 cursor-pointer"
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
                placeholder="Partilha a tua resposta com a comunidade..."
                className="flex-1 px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 placeholder-stone-400 focus:bg-white focus:border-amber-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!userQuestionResponse.trim() || isSubmittingResponse}
                className="px-3 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
              >
                <Send className="w-3 h-3" />
                <span>{isSubmittingResponse ? 'Gravando...' : 'Unir'}</span>
              </button>
            </form>
          )}

          {/* 2.8 & 2.9: Answers from Community as Direct Conversation Entrypoints */}
          <div className="space-y-2 pt-1">
            <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">
              Respostas de Membros Compatíveis
            </span>

            <div className="space-y-2">
              {currentQuestion.sampleAnswers.map((sample, idx) => {
                const authorCandidate = findCandidateByUid(sample.candidateUid);
                if (!authorCandidate) return null;
                const author = authorCandidate.profile;
                const authorFlag = CPLP_COUNTRIES[author.countryCode]?.flag || '🌍';

                return (
                  <div
                    key={idx}
                    className="p-3 bg-stone-50/80 hover:bg-stone-50 rounded-xl border border-stone-200/70 transition space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <img
                          src={author.profilePhoto}
                          alt={author.displayName}
                          className="w-7 h-7 rounded-full object-cover border border-stone-200"
                          referrerPolicy="no-referrer"
                        />
                        <div>
                          <div className="flex items-center gap-1">
                            <span className="font-bold text-xs text-stone-900">{author.displayName}</span>
                            <span className="text-xs">{authorFlag}</span>
                          </div>
                          <span className="text-[10px] text-stone-500">{author.cityName} · {sample.timeAgo}</span>
                        </div>
                      </div>

                      <span className="text-[9px] bg-white text-stone-600 px-2 py-0.5 rounded-full border border-stone-200">
                        {sample.highlight}
                      </span>
                    </div>

                    <p className="text-xs text-stone-800 leading-relaxed font-serif italic pl-1">
                      "{sample.answer}"
                    </p>

                    {/* 2.9: Direct entry into conversation from answer */}
                    <button
                      type="button"
                      onClick={() => {
                        handleInitiateApproach(`Tua resposta à pergunta sobre ${currentQuestion.theme}: "${sample.answer}"`);
                      }}
                      className="w-full py-1.5 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200/80 rounded-lg text-[11px] font-semibold transition flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <MessageCircle className="w-3 h-3" />
                      <span>Conversar com {author.displayName} sobre esta resposta</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          SUPERFÍCIE 3: O QUE ESTÁ A ACONTECER (2.10: Agregação leve de sinais vivos)
          Conversas relevantes + Possibilidades próximas + Pontes CPLP
          ───────────────────────────────────────────────────────────── */}
      <section className="bg-white rounded-2xl border border-stone-200/90 shadow-xs overflow-hidden">
        {/* Surface Header */}
        <div className="px-4 py-3 bg-gradient-to-r from-emerald-50/80 via-stone-50 to-white border-b border-stone-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-emerald-600 text-white rounded-lg shadow-2xs">
              <Activity className="w-3.5 h-3.5" />
            </span>
            <div>
              <h2 className="text-xs font-bold text-stone-900 tracking-tight">O que está a acontecer</h2>
              <span className="text-[10px] text-stone-500">Pulso ao vivo nos 9 países da CPLP</span>
            </div>
          </div>

          <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
            <Radio className="w-3 h-3 text-emerald-500 animate-pulse" />
            <span>Em Direto</span>
          </span>
        </div>

        <div className="p-4 space-y-4">
          {/* Live Activity Telemetry Badges */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 bg-stone-50 rounded-xl border border-stone-100 flex flex-col justify-between">
              <span className="text-[10px] text-stone-500 flex items-center gap-1">
                <Globe className="w-3 h-3 text-rose-500" />
                <span>Pontes CPLP Vivas</span>
              </span>
              <span className="font-bold text-stone-900 mt-1">Luanda ↔ Lisboa ↔ Salvador</span>
            </div>
            <div className="p-2.5 bg-stone-50 rounded-xl border border-stone-100 flex flex-col justify-between">
              <span className="text-[10px] text-stone-500 flex items-center gap-1">
                <Clock className="w-3 h-3 text-amber-500" />
                <span>Tema do Momento</span>
              </span>
              <span className="font-bold text-stone-900 mt-1">Música & Literatura Lusófona</span>
            </div>
          </div>

          {/* Members Active Right Now (2.10: Possibilidades próximas) */}
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">
              Membros Ativos com Afinidade Aberta
            </span>

            <div className="divide-y divide-stone-100 border border-stone-100 rounded-xl overflow-hidden">
              {candidates.slice(0, 4).map((c, idx) => {
                const prof = c.profile;
                const flag = CPLP_COUNTRIES[prof.countryCode]?.flag || '🌍';

                return (
                  <div
                    key={prof.uid || idx}
                    className="p-2.5 bg-white hover:bg-stone-50 transition flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative shrink-0">
                        <img
                          src={prof.profilePhoto}
                          alt={prof.displayName}
                          className="w-9 h-9 rounded-full object-cover border border-stone-200"
                          referrerPolicy="no-referrer"
                        />
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-stone-900 truncate">{prof.displayName}</span>
                          <span className="text-xs">{flag}</span>
                        </div>
                        <p className="text-[10px] text-stone-500 truncate">
                          {prof.cityName} · {c.compatibilityReasons[0] || 'Conexão ativa'}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        handleInitiateApproach(`Vi que estás ativo(a) em ${prof.cityName} e gostei da nossa afinidade.`);
                      }}
                      className="px-2.5 py-1.5 bg-stone-100 hover:bg-rose-50 text-stone-800 hover:text-rose-700 rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <MessageCircle className="w-3 h-3" />
                      <span>Conectar</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
