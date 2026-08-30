import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Conversation, UserProfile, DiscoveryCandidate } from '../types';
import { CPLP_COUNTRIES } from '../constants';
import { OptimizedImage } from './common/OptimizedImage';
import {
  Heart,
  HeartHandshake,
  Send,
  MessageCircle,
  Phone,
  Calendar,
  Star,
  MoreVertical,
  Volume2,
  X,
  ShieldCheck,
  MapPin,
  Clock,
  Sparkles,
  Flame,
  Check,
  CheckCheck,
  PauseCircle,
  PlayCircle,
  Flag,
  Share2,
  Trash2
} from 'lucide-react';
import confetti from 'canvas-confetti';

// Camada 1 — Abas de Ligações
type ConnectionTab = 'received' | 'sent' | 'mutual';

// Camada 2 — Estados
type ConnectionState = 'new' | 'chatting' | 'reciprocal' | 'meaningful' | 'paused';

export interface ConnectionItem {
  id: string;
  partner: UserProfile;
  tab: ConnectionTab;
  state: ConnectionState;
  stateLabel: string;
  stateBadge: {
    icon: string;
    label: string;
    color: string;
    bg: string;
    border: string;
  };
  createdAt: number;
  lastActiveText: string;
  note?: string;
  isStarred?: boolean;
  convoId?: string;
}

interface ConnectionsProps {
  myProfile: UserProfile;
  conversations: Conversation[];
  candidatePool?: UserProfile[];
  onOpenChat: (convoId: string, partnerProfile?: UserProfile) => void;
  onExploreMore: () => void;
  onAcceptReceived?: (partner: UserProfile) => void;
}

export const Connections: React.FC<ConnectionsProps> = ({
  myProfile,
  conversations,
  candidatePool = [],
  onOpenChat,
  onExploreMore,
  onAcceptReceived
}) => {
  // Camada 1: ❤️ Recebidas | ❤️ Enviadas | 🤝 Mútuas
  const [activeTab, setActiveTab] = useState<ConnectionTab>('mutual');

  // Camada 2: Filtro de Estado (Opcional para refinar a lista)
  const [filterState, setFilterState] = useState<ConnectionState | 'all'>('all');

  // Camada 3: Item Selecionado para Ação
  const [selectedConnection, setSelectedConnection] = useState<ConnectionItem | null>(null);
  const [showOptionsSheet, setShowOptionsSheet] = useState(false);
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const [starredMap, setStarredMap] = useState<Record<string, boolean>>({});
  const [pausedMap, setPausedMap] = useState<Record<string, boolean>>({});

  // Mock initial received & sent connections based on real profiles in pool
  const allConnections = useMemo(() => {
    const list: ConnectionItem[] = [];

    // 1. 🤝 Mútuas (Derivadas das conversas existentes)
    conversations.forEach((convo, idx) => {
      const partnerUid = convo.participantUids.find(uid => uid !== myProfile.uid) || '';
      const partner = convo.participants?.[partnerUid] || convo.participantDetails?.[partnerUid];
      if (!partner) return;

      const isPaused = !!pausedMap[convo.id];
      const isStarred = !!starredMap[convo.id];

      // Determinar Estado (Camada 2)
      let state: ConnectionState = 'reciprocal';
      if (isPaused) {
        state = 'paused';
      } else if (isStarred || idx === 0) {
        state = 'meaningful';
      } else if (idx === 1) {
        state = 'chatting';
      } else if (idx === 2) {
        state = 'new';
      }

      const stateBadge = getStateBadge(state);

      list.push({
        id: convo.id,
        partner,
        tab: 'mutual',
        state,
        stateLabel: stateBadge.label,
        stateBadge,
        createdAt: convo.createdAt || Date.now() - idx * 3600000 * 24,
        lastActiveText: idx === 0 ? 'Ativo(a) há 12 min' : 'Ativo(a) hoje',
        isStarred,
        convoId: convo.id
      });
    });

    // 2. ❤️ Recebidas (Demonstraram interesse em ti)
    const receivedCandidates = candidatePool.slice(0, 3);
    receivedCandidates.forEach((c, idx) => {
      if (c.uid === myProfile.uid || conversations.some(con => con.participantUids.includes(c.uid))) return;
      const isPaused = !!pausedMap[`rec_${c.uid}`];
      const isStarred = !!starredMap[`rec_${c.uid}`];
      const state: ConnectionState = isPaused ? 'paused' : (idx === 0 ? 'new' : 'reciprocal');
      const stateBadge = getStateBadge(state);

      list.push({
        id: `rec_${c.uid}`,
        partner: c,
        tab: 'received',
        state,
        stateLabel: stateBadge.label,
        stateBadge,
        createdAt: Date.now() - (idx + 1) * 3600000 * 6,
        lastActiveText: 'Demonstrou interesse recente',
        isStarred,
        note: `Adorou os teus interesses em ${c.interests?.[0] || 'música'}!`
      });
    });

    // 3. ❤️ Enviadas (Tu demonstraste interesse)
    const sentCandidates = candidatePool.slice(3, 6);
    sentCandidates.forEach((c, idx) => {
      if (c.uid === myProfile.uid || conversations.some(con => con.participantUids.includes(c.uid))) return;
      const isPaused = !!pausedMap[`sent_${c.uid}`];
      const isStarred = !!starredMap[`sent_${c.uid}`];
      const state: ConnectionState = isPaused ? 'paused' : (idx === 0 ? 'new' : 'chatting');
      const stateBadge = getStateBadge(state);

      list.push({
        id: `sent_${c.uid}`,
        partner: c,
        tab: 'sent',
        state,
        stateLabel: stateBadge.label,
        stateBadge,
        createdAt: Date.now() - (idx + 1) * 3600000 * 14,
        lastActiveText: 'Aguardando resposta',
        isStarred
      });
    });

    return list;
  }, [conversations, candidatePool, myProfile, starredMap, pausedMap]);

  // Helper para Camada 2 — Estados
  function getStateBadge(state: ConnectionState) {
    switch (state) {
      case 'new':
        return {
          icon: '🟢',
          label: 'Nova',
          color: 'text-emerald-400',
          bg: 'bg-emerald-950/60',
          border: 'border-emerald-800'
        };
      case 'chatting':
        return {
          icon: '💬',
          label: 'Conversando',
          color: 'text-sky-400',
          bg: 'bg-sky-950/60',
          border: 'border-sky-800'
        };
      case 'reciprocal':
        return {
          icon: '🔥',
          label: 'Recíproca',
          color: 'text-rose-400',
          bg: 'bg-rose-950/60',
          border: 'border-rose-800'
        };
      case 'meaningful':
        return {
          icon: '⭐',
          label: 'Significativa',
          color: 'text-amber-400',
          bg: 'bg-amber-950/60',
          border: 'border-amber-800'
        };
      case 'paused':
        return {
          icon: '⏳',
          label: 'Pausada',
          color: 'text-stone-400',
          bg: 'bg-stone-800/80',
          border: 'border-stone-700'
        };
    }
  }

  // Filtrar pela aba atual da Camada 1 + Estado da Camada 2
  const visibleConnections = useMemo(() => {
    return allConnections.filter(item => {
      if (item.tab !== activeTab) return false;
      if (filterState !== 'all' && item.state !== filterState) return false;
      return true;
    });
  }, [allConnections, activeTab, filterState]);

  // Contadores por Aba (Camada 1)
  const counts = useMemo(() => {
    return {
      received: allConnections.filter(c => c.tab === 'received').length,
      sent: allConnections.filter(c => c.tab === 'sent').length,
      mutual: allConnections.filter(c => c.tab === 'mutual').length
    };
  }, [allConnections]);

  // Ação ⭐ Guardar / Destacar
  const toggleStar = (id: string) => {
    setStarredMap(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Ação ⏳ Pausar Ligação
  const togglePause = (id: string) => {
    setPausedMap(prev => ({ ...prev, [id]: !prev[id] }));
    setShowOptionsSheet(false);
  };

  // Ação 💬 Conversar
  const handleStartChat = (item: ConnectionItem) => {
    setSelectedConnection(null);
    setShowOptionsSheet(false);
    if (item.convoId) {
      onOpenChat(item.convoId, item.partner);
    } else {
      // Simular abertura ou criação de conversa
      onOpenChat(`convo_${item.partner.uid}`, item.partner);
    }
  };

  // Ação Aceitar Recebida
  const handleAcceptInterest = (item: ConnectionItem) => {
    confetti({
      particleCount: 40,
      spread: 60,
      origin: { y: 0.8 },
      colors: ['#e11d48', '#fb7185', '#0d9488']
    });
    if (onAcceptReceived) {
      onAcceptReceived(item.partner);
    }
    handleStartChat(item);
  };

  return (
    <div className="flex-1 flex flex-col w-full h-full bg-transparent text-white relative select-none overflow-hidden">
      {/* ─────────────────────────────────────────────────────────────
          CAMADA 1 — NAVEGAÇÃO RIGOROSA DE LIGAÇÕES
          ❤️ Recebidas | ❤️ Enviadas | 🤝 Mútuas
          ───────────────────────────────────────────────────────────── */}
      <div className="px-3 pt-3 pb-2 bg-stone-950/80 backdrop-blur-md border-b border-stone-800/80 z-20 shrink-0">
        <div className="flex items-center justify-between gap-1.5 p-1 bg-stone-900 rounded-2xl border border-stone-800">
          {[
            { id: 'received', label: 'Recebidas', icon: Heart, count: counts.received, color: 'text-rose-400' },
            { id: 'sent', label: 'Enviadas', icon: Send, count: counts.sent, color: 'text-sky-400' },
            { id: 'mutual', label: 'Mútuas', icon: HeartHandshake, count: counts.mutual, color: 'text-emerald-400' }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id as ConnectionTab);
                  setFilterState('all');
                }}
                className={`flex-1 py-2 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  isActive
                    ? 'bg-stone-800 text-white shadow-sm border border-stone-700'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? tab.color : 'text-stone-400'}`} />
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isActive ? 'bg-rose-600 text-white font-bold' : 'bg-stone-800 text-stone-400'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ─────────────────────────────────────────────────────────────
            CAMADA 2 — ESTADOS (FILTRAGEM RÁPIDA)
            🟢 Nova | 💬 Conversando | 🔥 Recíproca | ⭐ Significativa | ⏳ Pausada
            ───────────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-2">
          <button
            type="button"
            onClick={() => setFilterState('all')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition cursor-pointer shrink-0 border ${
              filterState === 'all'
                ? 'bg-rose-600 border-rose-500 text-white'
                : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-stone-200'
            }`}
          >
            Todos os Estados
          </button>
          {[
            { id: 'new', label: 'Nova', icon: '🟢' },
            { id: 'chatting', label: 'Conversando', icon: '💬' },
            { id: 'reciprocal', label: 'Recíproca', icon: '🔥' },
            { id: 'meaningful', label: 'Significativa', icon: '⭐' },
            { id: 'paused', label: 'Pausada', icon: '⏳' }
          ].map(st => {
            const isActive = filterState === st.id;
            return (
              <button
                key={st.id}
                type="button"
                onClick={() => setFilterState(st.id as ConnectionState)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition cursor-pointer shrink-0 border ${
                  isActive
                    ? 'bg-stone-100 text-stone-950 border-white'
                    : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-stone-200'
                }`}
              >
                <span>{st.icon}</span>
                <span>{st.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          LISTA DE LIGAÇÕES DA DISCIPLINA
          ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-3.5 pb-24 space-y-2.5">
        {visibleConnections.length === 0 ? (
          <div className="bg-stone-900 border border-stone-800 rounded-2xl p-8 text-center mt-6 space-y-3">
            <div className="w-12 h-12 rounded-full bg-stone-800 border border-stone-700 flex items-center justify-center mx-auto text-rose-500">
              {activeTab === 'received' && <Heart className="w-6 h-6" />}
              {activeTab === 'sent' && <Send className="w-6 h-6" />}
              {activeTab === 'mutual' && <HeartHandshake className="w-6 h-6" />}
            </div>
            <h3 className="text-sm font-bold text-white">
              {activeTab === 'received' && 'Sem interesses recebidos pendentes'}
              {activeTab === 'sent' && 'Sem ligações enviadas pendentes'}
              {activeTab === 'mutual' && 'Ainda sem ligações mútuas formadas'}
            </h3>
            <p className="text-xs text-stone-400 max-w-xs mx-auto">
              {activeTab === 'received' && 'À medida que outros membros descobrirem o teu perfil, os interesses recebidos aparecerão aqui.'}
              {activeTab === 'sent' && 'Ao tocares em ♡ no Descobrir ou Perto, as tuas ligações enviadas serão registadas aqui.'}
              {activeTab === 'mutual' && 'Quando houver interesse mútuo, a ligação torna-se direta e pronta para conversa.'}
            </p>
            <button
              type="button"
              onClick={onExploreMore}
              className="py-2.5 px-5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
            >
              Descobrir Pessoas Agora
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {visibleConnections.map(item => {
              const country = CPLP_COUNTRIES[item.partner.countryCode] || { flag: '🌍', name: item.partner.countryName };

              return (
                <div
                  key={item.id}
                  onClick={() => {
                    setSelectedConnection(item);
                    setIsPlayingVoice(false);
                  }}
                  className="bg-stone-900 border border-stone-800/90 hover:border-stone-700 rounded-2xl p-3.5 shadow-lg flex items-center justify-between gap-3 transition cursor-pointer group active:scale-[0.99]"
                >
                  {/* Foto & Status */}
                  <div className="relative shrink-0">
                    <div className="w-13 h-13 rounded-2xl overflow-hidden bg-stone-800 border border-stone-700/80">
                      <OptimizedImage
                        src={item.partner.profilePhoto}
                        alt={item.partner.displayName}
                        variant="avatar"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <span className="absolute -bottom-1 -right-1 text-xs bg-stone-950 rounded-full p-0.5 border border-stone-800 leading-none">
                      {country.flag}
                    </span>
                  </div>

                  {/* Informação Central */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-white text-sm truncate">
                        {item.partner.displayName}, {item.partner.age}
                      </h4>
                      {item.partner.verificationStatus === 'verified' && (
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      )}
                      {item.isStarred && (
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />
                      )}
                    </div>

                    {/* Estado da Camada 2 */}
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${item.stateBadge.bg} ${item.stateBadge.border} ${item.stateBadge.color}`}>
                        <span>{item.stateBadge.icon}</span>
                        <span>{item.stateBadge.label}</span>
                      </span>
                      <span className="text-[10px] text-stone-400 truncate">
                        {item.partner.cityName}
                      </span>
                    </div>

                    {item.note && (
                      <p className="text-[11px] text-rose-300 line-clamp-1 italic font-serif">
                        "{item.note}"
                      </p>
                    )}
                  </div>

                  {/* Ação Rápida */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {activeTab === 'received' ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAcceptInterest(item);
                        }}
                        className="py-1.5 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-sm cursor-pointer transition"
                      >
                        <Heart className="w-3.5 h-3.5 fill-current" />
                        <span>Ligar</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedConnection(item);
                          setShowOptionsSheet(true);
                        }}
                        className="w-8 h-8 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-white flex items-center justify-center transition cursor-pointer"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          CAMADA 3 — AÇÃO (AO ABRIR UMA LIGAÇÃO)
          💬 Conversar | 🎙️ Voz | 📞 Chamar | 📅 Encontrar | ⭐ Guardar | ⋮
          ───────────────────────────────────────────────────────────── */}
      {selectedConnection && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex flex-col justify-end">
          <div className="bg-stone-900 border-t border-stone-800 rounded-t-3xl p-5 max-w-md mx-auto w-full max-h-[85vh] overflow-y-auto space-y-4 animate-in slide-in-from-bottom duration-200">
            {/* Header da Ligação */}
            <div className="flex items-center justify-between pb-3 border-b border-stone-800">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl overflow-hidden bg-stone-800 border border-stone-700">
                  <OptimizedImage
                    src={selectedConnection.partner.profilePhoto}
                    alt={selectedConnection.partner.displayName}
                    variant="avatar"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-bold text-base text-white">
                      {selectedConnection.partner.displayName}, {selectedConnection.partner.age}
                    </h3>
                    <span>{CPLP_COUNTRIES[selectedConnection.partner.countryCode]?.flag || '🌍'}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.2 rounded-full border ${selectedConnection.stateBadge.bg} ${selectedConnection.stateBadge.border} ${selectedConnection.stateBadge.color}`}>
                      <span>{selectedConnection.stateBadge.icon}</span>
                      <span>{selectedConnection.stateBadge.label}</span>
                    </span>
                    <span className="text-[10px] text-stone-400">
                      {selectedConnection.partner.cityName}, {selectedConnection.partner.countryName}
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedConnection(null);
                  setIsPlayingVoice(false);
                }}
                className="p-1 text-stone-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Apresentação Essencial */}
            <div className="bg-stone-800/70 p-3.5 rounded-2xl border border-stone-700/60 space-y-2">
              <p className="text-xs text-stone-200 italic font-serif leading-relaxed">
                "{selectedConnection.partner.bio || 'Interessado(a) em conversas com substância e conexão autêntica.'}"
              </p>
              <div className="flex flex-wrap gap-1.5">
                {(selectedConnection.partner.interests || []).map(i => (
                  <span key={i} className="text-[10px] bg-stone-800 text-stone-300 px-2 py-0.5 rounded-full border border-stone-700">
                    ✨ {i}
                  </span>
                ))}
              </div>
            </div>

            {/* ─────────────────────────────────────────────────────────────
                AÇÕES PRINCIPAIS DA CAMADA 3:
                💬 Conversar | 🎙️ Voz | 📞 Chamar | 📅 Encontrar | ⭐ Guardar | ⋮
                ───────────────────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              {/* 💬 Conversar */}
              <button
                type="button"
                onClick={() => handleStartChat(selectedConnection)}
                className="py-3 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-rose-600/30 transition cursor-pointer col-span-2"
              >
                <MessageCircle className="w-4 h-4 fill-current" />
                <span>Conversar com {selectedConnection.partner.displayName}</span>
              </button>

              {/* 🎙️ Voz */}
              <button
                type="button"
                onClick={() => setIsPlayingVoice(!isPlayingVoice)}
                className={`py-3 px-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 border transition cursor-pointer ${
                  isPlayingVoice
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                    : 'bg-stone-800 border-stone-700 text-stone-200 hover:border-stone-600'
                }`}
              >
                <Volume2 className="w-4 h-4 text-amber-400" />
                <span>{isPlayingVoice ? 'Ouvindo Voz (0:15)' : 'Ouvir Voz'}</span>
              </button>

              {/* 📞 Chamar */}
              <button
                type="button"
                onClick={() => {
                  alert(`Iniciando chamada de áudio segura com ${selectedConnection.partner.displayName}...`);
                }}
                className="py-3 px-3 bg-stone-800 border border-stone-700 hover:border-stone-600 text-stone-200 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Phone className="w-4 h-4 text-emerald-400" />
                <span>Chamar</span>
              </button>

              {/* 📅 Encontrar */}
              <button
                type="button"
                onClick={() => {
                  alert(`Proposta de encontro sugerida para ${selectedConnection.partner.cityName}. Sugestão enviada na conversa!`);
                  handleStartChat(selectedConnection);
                }}
                className="py-3 px-3 bg-stone-800 border border-stone-700 hover:border-stone-600 text-stone-200 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Calendar className="w-4 h-4 text-sky-400" />
                <span>Encontrar</span>
              </button>

              {/* ⭐ Guardar */}
              <button
                type="button"
                onClick={() => toggleStar(selectedConnection.id)}
                className={`py-3 px-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 border transition cursor-pointer ${
                  selectedConnection.isStarred || starredMap[selectedConnection.id]
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                    : 'bg-stone-800 border-stone-700 text-stone-200 hover:border-stone-600'
                }`}
              >
                <Star className={`w-4 h-4 ${selectedConnection.isStarred || starredMap[selectedConnection.id] ? 'fill-amber-400 text-amber-400' : 'text-stone-400'}`} />
                <span>{selectedConnection.isStarred || starredMap[selectedConnection.id] ? 'Guardada ⭐' : 'Guardar'}</span>
              </button>
            </div>

            {/* ⋮ Opções Adicionais */}
            <div className="pt-2 border-t border-stone-800 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => togglePause(selectedConnection.id)}
                className="py-2 px-3 bg-stone-800/80 hover:bg-stone-800 text-stone-400 hover:text-stone-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              >
                <PauseCircle className="w-3.5 h-3.5" />
                <span>{pausedMap[selectedConnection.id] ? 'Retomar Ligação' : 'Pausar Ligação'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  alert(`Ligação com ${selectedConnection.partner.displayName} ocultada.`);
                  setSelectedConnection(null);
                }}
                className="py-2 px-3 bg-rose-950/40 hover:bg-rose-950/70 text-rose-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>Remover</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
