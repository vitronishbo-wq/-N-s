import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile, UserPreferences, PrivacySettings, Conversation, ChatMessage } from '../../types';
import { DEMO_LUSOFONE_PROFILES } from '../../constants';
import { firestoreInteractionService, FirestoreInteraction } from '../../services/firestoreInteractionService';
import { db, doc, getDoc, setDoc, deleteDoc } from '../../firebase/config';
import confetti from 'canvas-confetti';
import {
  ArrowRightLeft,
  Sparkles,
  Heart,
  MessageCircle,
  RotateCcw,
  CheckCircle2,
  Clock,
  X,
  ShieldCheck,
  Globe,
  ExternalLink,
  Zap,
  Info
} from 'lucide-react';

interface CPLPDualAccountTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProfile: UserProfile | null;
  onSwitchAccount: (newProfile: UserProfile, newPrefs: UserPreferences, newPrivacy: PrivacySettings) => void;
  onOpenConversation: (convoId: string) => void;
  onNavigateToTab: (tab: 'discover' | 'connections' | 'chat' | 'me') => void;
}

const MARTA_PROFILE = DEMO_LUSOFONE_PROFILES.find(p => p.uid === 'demo_marta_ao')!;
const TIAGO_PROFILE = DEMO_LUSOFONE_PROFILES.find(p => p.uid === 'demo_tiago_pt')!;

const DEFAULT_MARTA_PREFS: UserPreferences = {
  uid: 'demo_marta_ao',
  minAge: 24,
  maxAge: 45,
  genders: ['man'],
  countries: ['AO', 'PT', 'BR', 'CV', 'MZ'],
  relationshipIntents: ['serious', 'dating'],
  crossCultural: true,
  verifiedOnly: false,
  discoveryEnabled: true
};

const DEFAULT_TIAGO_PREFS: UserPreferences = {
  uid: 'demo_tiago_pt',
  minAge: 22,
  maxAge: 40,
  genders: ['woman'],
  countries: ['PT', 'AO', 'BR', 'CV', 'MZ'],
  relationshipIntents: ['dating', 'serious'],
  crossCultural: true,
  verifiedOnly: false,
  discoveryEnabled: true
};

const DEFAULT_PRIVACY: PrivacySettings = {
  uid: '',
  shareApproximateLocationOnly: false,
  showAge: true,
  showOnlineStatus: true,
  visibility: 'public'
};

export const CPLPDualAccountTestModal: React.FC<CPLPDualAccountTestModalProps> = ({
  isOpen,
  onClose,
  currentProfile,
  onSwitchAccount,
  onOpenConversation,
  onNavigateToTab
}) => {
  const [isRunningAutoTest, setIsRunningAutoTest] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [testStatus, setTestStatus] = useState<{
    martaLikedTiago: boolean;
    tiagoLikedMarta: boolean;
    isMutualMatch: boolean;
    convoExists: boolean;
    messageCount: number;
  }>({
    martaLikedTiago: false,
    tiagoLikedMarta: false,
    isMutualMatch: false,
    convoExists: false,
    messageCount: 0
  });

  const checkLiveSync = async () => {
    try {
      const sortedUids = ['demo_marta_ao', 'demo_tiago_pt'].sort();
      const matchId = `match_${sortedUids.join('_')}`;
      const convoId = `convo_${sortedUids.join('_')}`;

      const [likeM2T, likeT2M, matchDoc, convoDoc] = await Promise.all([
        getDoc(doc(db, 'interactions', 'like_demo_marta_ao_demo_tiago_pt')),
        getDoc(doc(db, 'interactions', 'like_demo_tiago_pt_demo_marta_ao')),
        getDoc(doc(db, 'matches', matchId)),
        getDoc(doc(db, 'conversations', convoId))
      ]);

      setTestStatus({
        martaLikedTiago: likeM2T.exists(),
        tiagoLikedMarta: likeT2M.exists(),
        isMutualMatch: matchDoc.exists(),
        convoExists: convoDoc.exists(),
        messageCount: convoDoc.exists() ? 2 : 0
      });
    } catch (e) {
      console.info('Aviso de status de teste:', e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      checkLiveSync();
      const timer = setInterval(checkLiveSync, 3000);
      return () => clearInterval(timer);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isMartaActive = currentProfile?.uid === 'demo_marta_ao';
  const isTiagoActive = currentProfile?.uid === 'demo_tiago_pt';

  const handleSelectMarta = () => {
    onSwitchAccount(MARTA_PROFILE, DEFAULT_MARTA_PREFS, { ...DEFAULT_PRIVACY, uid: 'demo_marta_ao' });
  };

  const handleSelectTiago = () => {
    onSwitchAccount(TIAGO_PROFILE, DEFAULT_TIAGO_PREFS, { ...DEFAULT_PRIVACY, uid: 'demo_tiago_pt' });
  };

  const handleExecuteFullTest = async () => {
    setIsRunningAutoTest(true);
    try {
      // 1. Marta gosta de Tiago no Firestore
      const likeMarta: FirestoreInteraction = {
        id: 'like_demo_marta_ao_demo_tiago_pt',
        fromUid: 'demo_marta_ao',
        targetUid: 'demo_tiago_pt',
        type: 'like',
        fromDisplayName: 'Marta',
        fromCityName: 'Luanda',
        fromCountryCode: 'AO',
        fromPhoto: MARTA_PROFILE.profilePhoto || '',
        targetDisplayName: 'Tiago',
        targetCityName: 'Lisboa',
        targetCountryCode: 'PT',
        note: 'Olá Tiago! Adorei ver o teu interesse por fado, cultura e viagens. Saudações de Luanda! 🇦🇴✨',
        timestamp: Date.now() - 1000 * 60,
        updatedAt: Date.now() - 1000 * 60
      };
      await setDoc(doc(db, 'interactions', likeMarta.id), likeMarta, { merge: true });

      // 2. Tiago gosta de Marta no Firestore -> Cria Match Recíproco!
      const sortedUids = ['demo_marta_ao', 'demo_tiago_pt'].sort();
      const matchId = `match_${sortedUids.join('_')}`;
      const convoId = `convo_${sortedUids.join('_')}`;

      const likeTiago: FirestoreInteraction = {
        id: 'like_demo_tiago_pt_demo_marta_ao',
        fromUid: 'demo_tiago_pt',
        targetUid: 'demo_marta_ao',
        type: 'like',
        fromDisplayName: 'Tiago',
        fromCityName: 'Lisboa',
        fromCountryCode: 'PT',
        fromPhoto: TIAGO_PROFILE.profilePhoto || '',
        targetDisplayName: 'Marta',
        targetCityName: 'Luanda',
        targetCountryCode: 'AO',
        note: 'Olá Marta! Fico muito feliz com a tua mensagem. Um abraço caloroso daqui de Lisboa! 🇵🇹🤝',
        timestamp: Date.now(),
        updatedAt: Date.now()
      };
      await setDoc(doc(db, 'interactions', likeTiago.id), likeTiago, { merge: true });

      // 3. Documento de Match no Firestore
      await setDoc(doc(db, 'matches', matchId), {
        id: matchId,
        userA: sortedUids[0],
        userB: sortedUids[1],
        users: sortedUids,
        matchedAt: Date.now()
      }, { merge: true });

      // 4. Conversa com histórico real bilateral no Firestore
      const newConvo: Conversation = {
        id: convoId,
        participantUids: sortedUids,
        participants: {
          demo_marta_ao: {
            displayName: 'Marta',
            profilePhoto: MARTA_PROFILE.profilePhoto || '',
            cityName: 'Luanda',
            countryCode: 'AO'
          },
          demo_tiago_pt: {
            displayName: 'Tiago',
            profilePhoto: TIAGO_PROFILE.profilePhoto || '',
            cityName: 'Lisboa',
            countryCode: 'PT'
          }
        },
        lastMessageText: 'Olá Marta! Fico muito feliz com a tua mensagem. Um abraço caloroso daqui de Lisboa! 🇵🇹🤝',
        lastMessageTimestamp: Date.now(),
        lastMessageSenderId: 'demo_tiago_pt',
        createdAt: Date.now() - 1000 * 60,
        updatedAt: Date.now()
      };
      await setDoc(doc(db, 'conversations', convoId), newConvo, { merge: true });

      // Mensagens no sub-documento messages
      const msg1: ChatMessage = {
        id: 'msg_marta_1',
        conversationId: convoId,
        senderId: 'demo_marta_ao',
        text: 'Olá Tiago! Adorei ver o teu interesse por fado, cultura e viagens. Saudações calorosas de Luanda! 🇦🇴✨',
        createdAt: Date.now() - 1000 * 50,
        status: 'read'
      };
      const msg2: ChatMessage = {
        id: 'msg_tiago_2',
        conversationId: convoId,
        senderId: 'demo_tiago_pt',
        text: 'Olá Marta! Que alegria conectar contigo! Sempre tive um fascínio enorme pela música e pela energia de Angola. Como estão as coisas por Luanda? 🇵🇹🤝',
        createdAt: Date.now() - 1000 * 20,
        status: 'delivered'
      };

      await setDoc(doc(db, 'conversations', convoId, 'messages', msg1.id), msg1, { merge: true });
      await setDoc(doc(db, 'conversations', convoId, 'messages', msg2.id), msg2, { merge: true });

      // Celebração de Confetes CPLP
      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.6 }
      });

      await checkLiveSync();

      // Ativa Tiago ou Marta se nenhum estiver ativo
      if (!isMartaActive && !isTiagoActive) {
        handleSelectTiago();
      }

      onOpenConversation(convoId);
      onClose();
    } catch (e) {
      console.warn('Erro ao executar teste prático:', e);
    } finally {
      setIsRunningAutoTest(false);
    }
  };

  const handleResetTest = async () => {
    setIsResetting(true);
    try {
      const sortedUids = ['demo_marta_ao', 'demo_tiago_pt'].sort();
      const matchId = `match_${sortedUids.join('_')}`;
      const convoId = `convo_${sortedUids.join('_')}`;

      await Promise.all([
        deleteDoc(doc(db, 'interactions', 'like_demo_marta_ao_demo_tiago_pt')).catch(() => {}),
        deleteDoc(doc(db, 'interactions', 'like_demo_tiago_pt_demo_marta_ao')).catch(() => {}),
        deleteDoc(doc(db, 'matches', matchId)).catch(() => {}),
        deleteDoc(doc(db, 'conversations', convoId)).catch(() => {})
      ]);

      await checkLiveSync();
    } catch (e) {
      console.warn('Erro ao resetar teste:', e);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-stone-900 border border-stone-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 border-b border-stone-800 flex items-center justify-between bg-stone-950/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-rose-600 flex items-center justify-center text-white shadow-md">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <span>Teste Prático Transatlântico CPLP</span>
                <span className="text-[11px] bg-rose-950/80 border border-rose-800/80 text-rose-300 font-semibold px-2 py-0.5 rounded-full">
                  AO 🇦🇴 ↔ PT 🇵🇹
                </span>
              </h3>
              <p className="text-[11px] text-stone-400">
                Simule e alterne entre as contas de Angola e Portugal em tempo real
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-stone-400 hover:text-white hover:bg-stone-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto space-y-4 no-scrollbar">
          {/* Seletor Rápido de Contas */}
          <div>
            <span className="text-xs font-bold text-stone-300 uppercase tracking-wider block mb-2">
              1. Selecionar Conta Ativa para Navegar
            </span>
            <div className="grid grid-cols-2 gap-2.5">
              {/* Conta Angola */}
              <button
                type="button"
                onClick={handleSelectMarta}
                className={`p-3 rounded-2xl border text-left transition relative cursor-pointer ${
                  isMartaActive
                    ? 'bg-rose-950/40 border-rose-500 ring-2 ring-rose-500/30'
                    : 'bg-stone-950/50 border-stone-800 hover:border-stone-700'
                }`}
              >
                <div className="flex items-center gap-2.5 mb-2">
                  <img
                    src={MARTA_PROFILE.profilePhoto}
                    alt={MARTA_PROFILE.displayName}
                    className="w-10 h-10 rounded-full object-cover border border-stone-700"
                  />
                  <div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-bold text-white">{MARTA_PROFILE.displayName}, 27</span>
                      <span className="text-xs">🇦🇴</span>
                    </div>
                    <span className="text-[10px] text-stone-400 block">Luanda, Angola</span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[10px] pt-1 border-t border-stone-800/60">
                  <span className="text-stone-400">Intenção: Séria</span>
                  {isMartaActive ? (
                    <span className="text-emerald-400 font-bold flex items-center gap-0.5">
                      <CheckCircle2 className="w-3 h-3" /> Ativa
                    </span>
                  ) : (
                    <span className="text-stone-500 font-medium hover:text-rose-400">Entrar como Marta</span>
                  )}
                </div>
              </button>

              {/* Conta Portugal */}
              <button
                type="button"
                onClick={handleSelectTiago}
                className={`p-3 rounded-2xl border text-left transition relative cursor-pointer ${
                  isTiagoActive
                    ? 'bg-rose-950/40 border-rose-500 ring-2 ring-rose-500/30'
                    : 'bg-stone-950/50 border-stone-800 hover:border-stone-700'
                }`}
              >
                <div className="flex items-center gap-2.5 mb-2">
                  <img
                    src={TIAGO_PROFILE.profilePhoto}
                    alt={TIAGO_PROFILE.displayName}
                    className="w-10 h-10 rounded-full object-cover border border-stone-700"
                  />
                  <div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-bold text-white">{TIAGO_PROFILE.displayName}, 30</span>
                      <span className="text-xs">🇵🇹</span>
                    </div>
                    <span className="text-[10px] text-stone-400 block">Lisboa, Portugal</span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[10px] pt-1 border-t border-stone-800/60">
                  <span className="text-stone-400">Intenção: Namoro</span>
                  {isTiagoActive ? (
                    <span className="text-emerald-400 font-bold flex items-center gap-0.5">
                      <CheckCircle2 className="w-3 h-3" /> Ativa
                    </span>
                  ) : (
                    <span className="text-stone-500 font-medium hover:text-rose-400">Entrar como Tiago</span>
                  )}
                </div>
              </button>
            </div>
          </div>

          {/* Painel de Estado em Tempo Real (Firestore Live Status) */}
          <div className="bg-stone-950/60 border border-stone-800 rounded-2xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-300 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-sky-400" />
                <span>Estado da Ligação Transatlântica</span>
              </span>
              <button
                type="button"
                onClick={checkLiveSync}
                className="text-[10px] text-stone-400 hover:text-white flex items-center gap-1 font-mono"
              >
                <Clock className="w-3 h-3" /> Atualizar
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="bg-stone-900/80 p-2 rounded-xl border border-stone-800/80 flex items-center justify-between">
                <span className="text-stone-400">Marta 🇦🇴 ➡️ Tiago 🇵🇹:</span>
                {testStatus.martaLikedTiago ? (
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <Heart className="w-3 h-3 fill-emerald-400 text-emerald-400" /> Enviado
                  </span>
                ) : (
                  <span className="text-stone-500 font-medium">Pendente</span>
                )}
              </div>

              <div className="bg-stone-900/80 p-2 rounded-xl border border-stone-800/80 flex items-center justify-between">
                <span className="text-stone-400">Tiago 🇵🇹 ➡️ Marta 🇦🇴:</span>
                {testStatus.tiagoLikedMarta ? (
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <Heart className="w-3 h-3 fill-emerald-400 text-emerald-400" /> Enviado
                  </span>
                ) : (
                  <span className="text-stone-500 font-medium">Pendente</span>
                )}
              </div>
            </div>

            <div className="bg-stone-900/80 p-2.5 rounded-xl border border-stone-800/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <div>
                  <div className="text-xs font-bold text-white">Match Recíproco & Conversa</div>
                  <div className="text-[10px] text-stone-400">
                    {testStatus.isMutualMatch ? 'Conexão Luanda ↔ Lisboa ativa!' : 'Aguardando reciprocidade mútua'}
                  </div>
                </div>
              </div>
              {testStatus.isMutualMatch ? (
                <span className="px-2.5 py-1 bg-emerald-950/70 border border-emerald-800 text-emerald-300 text-[11px] font-bold rounded-full">
                  Ativo ✨
                </span>
              ) : (
                <span className="px-2.5 py-1 bg-stone-800 text-stone-400 text-[11px] font-medium rounded-full">
                  Sem Match
                </span>
              )}
            </div>
          </div>

          {/* Ações de Teste Rápido */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleExecuteFullTest}
              disabled={isRunningAutoTest}
              className="w-full py-3 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 disabled:opacity-50 text-white font-bold text-xs rounded-2xl transition shadow-lg shadow-rose-950/40 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Zap className="w-4 h-4 text-amber-200 fill-amber-200" />
              <span>
                {isRunningAutoTest
                  ? 'A sincronizar teste bilateral...'
                  : 'Executar Teste Automático Completo (Match + Chat Bilateral)'}
              </span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onNavigateToTab('connections');
                  onClose();
                }}
                className="flex-1 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 border border-stone-700 cursor-pointer"
              >
                <Heart className="w-3.5 h-3.5 text-rose-400" />
                <span>Ver Ligações</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onNavigateToTab('chat');
                  onClose();
                }}
                className="flex-1 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 border border-stone-700 cursor-pointer"
              >
                <MessageCircle className="w-3.5 h-3.5 text-sky-400" />
                <span>Abrir Chat</span>
              </button>

              <button
                type="button"
                onClick={handleResetTest}
                disabled={isResetting}
                className="py-2 px-3 bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-rose-400 text-xs font-medium rounded-xl transition border border-stone-700 flex items-center gap-1 cursor-pointer"
                title="Reiniciar dados do teste"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Roteiro do Teste Manual */}
          <div className="bg-stone-950/40 border border-stone-800/60 rounded-2xl p-3 text-[11px] text-stone-300 space-y-1.5">
            <div className="font-bold text-stone-200 flex items-center gap-1.5 text-xs">
              <Info className="w-3.5 h-3.5 text-amber-400" />
              <span>Roteiro de Teste Manual Passo a Passo:</span>
            </div>
            <ol className="list-decimal list-inside space-y-1 text-stone-400 pl-1">
              <li>Clique em <strong>Marta (Angola 🇦🇴)</strong> para assumir o perfil de Luanda.</li>
              <li>Acesse a aba <strong>Descobrir</strong> e envie uma nota / gosto ao perfil de Tiago (Lisboa).</li>
              <li>Abra este modal e clique em <strong>Tiago (Portugal 🇵🇹)</strong> para trocar de conta.</li>
              <li>Acesse <strong>Ligações &gt; Recebidas</strong> e retribua o interesse.</li>
              <li>O match recíproco será confirmado e o chat em tempo real será desbloqueado!</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};
