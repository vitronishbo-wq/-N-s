import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  UserProfile,
  UserPreferences,
  PrivacySettings,
  DiscoveryCandidate,
  InteractionSignals
} from '../types';
import { CPLP_COUNTRIES } from '../constants';
import { OptimizedImage } from './common/OptimizedImage';
import {
  MapPin,
  Heart,
  X,
  ArrowRight,
  Map as MapIcon,
  Users,
  Calendar,
  Sparkles,
  ShieldCheck,
  Building,
  GraduationCap,
  Briefcase,
  Music,
  Navigation,
  Compass,
  Check,
  ChevronRight
} from 'lucide-react';
import confetti from 'canvas-confetti';

// Camada 3 — Alcance
type ReachRadius = '1km' | '5km' | '10km' | '25km' | '50km' | 'unlimited';

// Camada 4 — Contexto Local
type LocalContextFilter = 'city' | 'university' | 'professionals' | 'interests' | 'relationship';

interface NearbyProps {
  myProfile: UserProfile;
  myPreferences: UserPreferences;
  privacy?: PrivacySettings;
  signals?: InteractionSignals;
  candidatePool: UserProfile[];
  onLike: (targetCandidate: DiscoveryCandidate, customContextText?: string, openChat?: boolean) => void;
  onPass: (targetCandidate: DiscoveryCandidate) => void;
  onSelectCandidate?: (candidate: DiscoveryCandidate) => void;
}

export const Nearby: React.FC<NearbyProps> = ({
  myProfile,
  myPreferences,
  candidatePool,
  onLike,
  onPass
}) => {
  // Active View Tab: Pessoas (Camada 1) or Mapa (Camada 2)
  const [activeView, setActiveView] = useState<'people' | 'map'>('people');

  // Camada 3 — Alcance
  const [activeRadius, setActiveRadius] = useState<ReachRadius>('10km');

  // Camada 4 — Contexto Local
  const [activeContext, setActiveContext] = useState<LocalContextFilter>('city');

  // Selected item on map
  const [selectedMapPin, setSelectedMapPin] = useState<{
    type: 'person' | 'event' | 'community';
    id: string;
    title: string;
    subtitle: string;
    photo?: string;
    distance: string;
    data?: any;
  } | null>(null);

  // Filtered pool based on Alcance & Contexto local
  const nearbyCandidates = useMemo(() => {
    return candidatePool.filter(c => {
      if (c.uid === myProfile?.uid) return false;

      // Filter by Context
      if (activeContext === 'university') {
        const uniKeywords = ['universidade', 'estudante', 'medicina', 'direito', 'engenharia', 'ucan', 'uan', 'isutec', 'usp', 'up', 'estudos'];
        const text = `${c.bio} ${c.interests.join(' ')}`.toLowerCase();
        const matchesUni = uniKeywords.some(k => text.includes(k)) || c.age <= 25;
        if (!matchesUni) return false;
      } else if (activeContext === 'professionals') {
        const profKeywords = ['gestão', 'tecnologia', 'empresa', 'arquitetura', 'negócios', 'consultor', 'saúde', 'finanças'];
        const text = `${c.bio} ${c.interests.join(' ')}`.toLowerCase();
        const matchesProf = profKeywords.some(k => text.includes(k)) || c.age >= 26;
        if (!matchesProf) return false;
      } else if (activeContext === 'interests') {
        const hasShared = c.interests.some(i => (myProfile?.interests || []).includes(i));
        if (!hasShared && c.interests.length === 0) return false;
      } else if (activeContext === 'relationship') {
        if (c.intent !== 'serious' && c.intent !== 'marriage') return false;
      }

      // Filter by Radius
      if (activeRadius === '1km' || activeRadius === '5km') {
        return c.cityName?.toLowerCase() === myProfile?.cityName?.toLowerCase();
      } else if (activeRadius === '10km' || activeRadius === '25km' || activeRadius === '50km') {
        return c.cityName?.toLowerCase() === myProfile?.cityName?.toLowerCase() || c.countryCode === myProfile?.countryCode;
      }
      return true; // unlimited
    });
  }, [candidatePool, myProfile, activeRadius, activeContext]);

  // Deterministic mock distances for local realism
  const getDistanceLabel = (uid: string, index: number): string => {
    if (activeRadius === '1km') return `${(0.3 + (index % 5) * 0.15).toFixed(1)} km de ti`;
    if (activeRadius === '5km') return `${(1.2 + (index % 4) * 0.9).toFixed(1)} km de ti`;
    if (activeRadius === '10km') return `${(2.5 + (index % 6) * 1.2).toFixed(1)} km de ti`;
    if (activeRadius === '25km') return `${(5.0 + (index % 5) * 3.5).toFixed(1)} km de ti`;
    if (activeRadius === '50km') return `${(12 + (index % 5) * 7.5).toFixed(0)} km de ti`;
    return `Em ${myProfile?.cityName || 'CPLP'}`;
  };

  // Local Events for Camada 2 (Mapa)
  const localEvents = useMemo(() => [
    {
      id: 'evt-1',
      title: `Noite de Kizomba & Jazz`,
      subtitle: `Café del Mar · ${myProfile?.cityName || 'Luanda'}`,
      distance: '1.8 km',
      attendees: 18,
      category: 'Música & Convívio',
      icon: '🎵',
      x: 35,
      y: 42
    },
    {
      id: 'evt-2',
      title: `Encontro Literário Lusófono`,
      subtitle: `Centro Cultural · ${myProfile?.cityName || 'Luanda'}`,
      distance: '3.2 km',
      attendees: 12,
      category: 'Cultura & Café',
      icon: '📚',
      x: 65,
      y: 28
    },
    {
      id: 'evt-3',
      title: `Caminhada & Pôr do Sol`,
      subtitle: `Marginal · ${myProfile?.cityName || 'Luanda'}`,
      distance: '4.5 km',
      attendees: 24,
      category: 'Ar Livre & Social',
      icon: '🌅',
      x: 52,
      y: 68
    }
  ], [myProfile]);

  // Local Communities for Camada 2 (Mapa)
  const localCommunities = useMemo(() => [
    {
      id: 'comm-1',
      title: `Jovens Profissionais de ${myProfile?.cityName || 'Luanda'}`,
      subtitle: 'Comunidade ativa com encontros mensais',
      distance: '2.0 km',
      members: 142,
      icon: '💼',
      x: 28,
      y: 60
    },
    {
      id: 'comm-2',
      title: `Círculo Gastronómico & Viagens`,
      subtitle: 'Partilha de experiências e jantares de grupo',
      distance: '3.5 km',
      members: 89,
      icon: '🍷',
      x: 72,
      y: 55
    }
  ], [myProfile]);

  // Quick Like Handler (♡)
  const handleLikeCandidate = (targetProfile: UserProfile) => {
    confetti({
      particleCount: 30,
      spread: 55,
      origin: { y: 0.8 },
      colors: ['#e11d48', '#fb7185', '#0d9488']
    });

    const candidate: DiscoveryCandidate = {
      profile: targetProfile,
      compatibilityScore: 0.88,
      deterministicScore: 0.88,
      contextScore: 0.88,
      noveltyBonus: 0.1,
      confidence: 0.9,
      compatibilityReasons: [`Proximidade física direta em ${targetProfile.cityName}`],
      compatibilityResult: {
        score: 0.88,
        reasons: [`Proximidade física direta em ${targetProfile.cityName}`],
        sharedInterests: [],
        intentAlignment: 'exact',
        culturalConnection: targetProfile.countryCode === myProfile?.countryCode ? 'same_country' : 'cross_cultural_cplp',
        confidence: 0.9
      },
      discoveryReason: `Proximidade em ${targetProfile.cityName}`,
      evidence: [],
      connectionContext: '',
      conversationPrompt: '',
      discoveryMode: 'SIMILARITY'
    };

    onLike(candidate, undefined, true);
  };

  // Pass Handler (✕)
  const handlePassCandidate = (targetProfile: UserProfile) => {
    const candidate: DiscoveryCandidate = {
      profile: targetProfile,
      compatibilityScore: 0.5,
      deterministicScore: 0.5,
      contextScore: 0.5,
      noveltyBonus: 0,
      confidence: 0.5,
      compatibilityReasons: [],
      compatibilityResult: {
        score: 0.5,
        reasons: [],
        sharedInterests: [],
        intentAlignment: 'compatible',
        culturalConnection: 'same_country',
        confidence: 0.5
      },
      discoveryReason: '',
      evidence: [],
      connectionContext: '',
      conversationPrompt: '',
      discoveryMode: 'SIMILARITY'
    };
    onPass(candidate);
  };

  return (
    <div className="flex-1 flex flex-col w-full h-full bg-transparent text-white relative select-none overflow-hidden">
      {/* ─────────────────────────────────────────────────────────────
          CAMADA 4 — CONTEXTO LOCAL (TOPO)
          🏙️ Cidade | 🎓 Universidade | 💼 Profissionais | 🎵 Interesses | ❤️ Relacionamento
          ───────────────────────────────────────────────────────────── */}
      <div className="px-3 py-2 bg-stone-950/80 backdrop-blur-md border-b border-stone-800/80 z-20 shrink-0">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {[
            { id: 'city', label: myProfile?.cityName || 'Cidade', icon: '🏙️' },
            { id: 'university', label: 'Universidade', icon: '🎓' },
            { id: 'professionals', label: 'Profissionais', icon: '💼' },
            { id: 'interests', label: 'Interesses', icon: '🎵' },
            { id: 'relationship', label: 'Relacionamento', icon: '❤️' }
          ].map(ctx => {
            const isActive = activeContext === ctx.id;
            return (
              <button
                key={ctx.id}
                type="button"
                onClick={() => setActiveContext(ctx.id as LocalContextFilter)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition cursor-pointer shrink-0 border ${
                  isActive
                    ? 'bg-rose-600 border-rose-500 text-white shadow-sm shadow-rose-600/30'
                    : 'bg-stone-900/80 border-stone-800 text-stone-300 hover:text-white hover:bg-stone-800'
                }`}
              >
                <span>{ctx.icon}</span>
                <span>{ctx.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          CAMADA 3 — ALCANCE & SELETOR DE VISTA (PESSOAS / MAPA)
          1 km | 5 km | 10 km | 25 km | 50 km | 🌍 Sem limite
          ───────────────────────────────────────────────────────────── */}
      <div className="px-3 py-2 bg-stone-900/90 border-b border-stone-800 flex items-center justify-between gap-2 z-20 shrink-0">
        {/* Botões de Raio */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
          {[
            { id: '1km', label: '1 km' },
            { id: '5km', label: '5 km' },
            { id: '10km', label: '10 km' },
            { id: '25km', label: '25 km' },
            { id: '50km', label: '50 km' },
            { id: 'unlimited', label: '🌍 Sem limite' }
          ].map(r => {
            const isActive = activeRadius === r.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setActiveRadius(r.id as ReachRadius)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition cursor-pointer ${
                  isActive
                    ? 'bg-stone-100 text-stone-950 shadow-xs'
                    : 'bg-stone-800/80 text-stone-400 hover:text-stone-200'
                }`}
              >
                {r.label}
              </button>
            );
          })}
        </div>

        {/* Alternador de Vista: Pessoas vs Mapa */}
        <div className="flex bg-stone-800 p-0.5 rounded-lg border border-stone-700/60 shrink-0">
          <button
            type="button"
            onClick={() => setActiveView('people')}
            className={`p-1.5 rounded-md transition cursor-pointer ${
              activeView === 'people' ? 'bg-rose-600 text-white' : 'text-stone-400 hover:text-white'
            }`}
            title="Ver Lista de Pessoas"
          >
            <Users className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setActiveView('map')}
            className={`p-1.5 rounded-md transition cursor-pointer ${
              activeView === 'map' ? 'bg-rose-600 text-white' : 'text-stone-400 hover:text-white'
            }`}
            title="Ver Mapa Interativo"
          >
            <MapIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          CAMADA 1 — PESSOAS (LISTA DE CARTÕES COM FOTO, DISTÂNCIA, ♡, ✕, →)
          ───────────────────────────────────────────────────────────── */}
      {activeView === 'people' && (
        <div className="flex-1 overflow-y-auto p-4 pb-24 space-y-3">
          {nearbyCandidates.length === 0 ? (
            <div className="bg-stone-900 border border-stone-800 rounded-2xl p-8 text-center mt-6 space-y-3">
              <div className="w-12 h-12 rounded-full bg-stone-800 border border-stone-700 flex items-center justify-center mx-auto text-rose-500">
                <Compass className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-white">Ninguém encontrado com este alcance</h3>
              <p className="text-xs text-stone-400 max-w-xs mx-auto">
                Experimenta aumentar o alcance para "25 km" ou "🌍 Sem limite" para veres mais pessoas.
              </p>
              <button
                type="button"
                onClick={() => setActiveRadius('unlimited')}
                className="py-2 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Expandir Raio
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {nearbyCandidates.map((candidate, idx) => {
                const distanceLabel = getDistanceLabel(candidate.uid, idx);
                const country = CPLP_COUNTRIES[candidate.countryCode] || { flag: '🌍', name: candidate.countryName };

                return (
                  <div
                    key={candidate.uid}
                    className="bg-stone-900 border border-stone-800/90 rounded-2xl overflow-hidden shadow-lg flex items-center p-3 gap-3.5 group hover:border-stone-700 transition"
                  >
                    {/* Foto da Pessoa */}
                    <div className="relative w-18 h-22 shrink-0 rounded-xl overflow-hidden bg-stone-800">
                      <OptimizedImage
                        src={candidate.profilePhoto}
                        alt={candidate.displayName}
                        variant="card"
                        className="w-full h-full object-cover"
                      />
                      {candidate.verificationStatus === 'verified' && (
                        <span className="absolute top-1 right-1 bg-emerald-600/90 text-white p-0.5 rounded-full shadow-xs">
                          <ShieldCheck className="w-2.5 h-2.5" />
                        </span>
                      )}
                    </div>

                    {/* Informação e Distância */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <h4 className="font-bold text-white text-base truncate">
                          {candidate.displayName}, {candidate.age}
                        </h4>
                        <span className="text-xs">{country.flag}</span>
                      </div>

                      {/* Distância */}
                      <div className="inline-flex items-center gap-1 text-xs font-semibold text-rose-400 bg-rose-950/40 px-2 py-0.5 rounded-full border border-rose-900/50">
                        <MapPin className="w-3 h-3" />
                        <span>{distanceLabel}</span>
                      </div>

                      <p className="text-xs text-stone-400 line-clamp-1 italic font-serif">
                        "{candidate.bio || 'À procura de uma boa conversa.'}"
                      </p>
                    </div>

                    {/* Controles da Camada 1: ♡ (Ligar) | ✕ (Passar) | → (Mais) */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* ✕ Passar */}
                      <button
                        type="button"
                        onClick={() => handlePassCandidate(candidate)}
                        aria-label="Passar pessoa"
                        title="Passar"
                        className="w-9 h-9 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-white flex items-center justify-center transition cursor-pointer border border-stone-700/60 active:scale-95"
                      >
                        <X className="w-4 h-4" />
                      </button>

                      {/* ♡ Conectar */}
                      <button
                        type="button"
                        onClick={() => handleLikeCandidate(candidate)}
                        aria-label="Conectar com pessoa"
                        title="Gostar"
                        className="w-10 h-10 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center transition cursor-pointer shadow-md shadow-rose-600/30 active:scale-95"
                      >
                        <Heart className="w-5 h-5 fill-current" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          CAMADA 2 — MAPA INTERATIVO
          📍 Minha posição | Pessoas | Eventos | Comunidades
          ───────────────────────────────────────────────────────────── */}
      {activeView === 'map' && (
        <div className="flex-1 relative bg-stone-900 flex flex-col overflow-hidden">
          {/* Estilização Gráfica do Mapa Radar */}
          <div className="absolute inset-0 bg-[radial-gradient(#262626_1px,transparent_1px)] [background-size:20px_20px] opacity-70" />

          {/* Círculos Concéntricos de Radar de Distância */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-32 h-32 rounded-full border border-rose-500/20 animate-ping opacity-25" />
            <div className="w-48 h-48 rounded-full border border-stone-700/50 absolute" />
            <div className="w-72 h-72 rounded-full border border-stone-800/60 absolute" />
          </div>

          {/* 📍 Minha Posição (Centro do Mapa) */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center">
            <div className="relative">
              <div className="w-12 h-12 rounded-full bg-rose-600/20 border-2 border-rose-500 flex items-center justify-center animate-pulse">
                <div className="w-4 h-4 rounded-full bg-rose-500" />
              </div>
            </div>
            <span className="mt-1 text-[10px] font-bold bg-black/80 px-2 py-0.5 rounded-full border border-stone-700 text-white flex items-center gap-1">
              <Navigation className="w-2.5 h-2.5 text-rose-400" />
              <span>Minha posição ({myProfile?.cityName || 'Local'})</span>
            </span>
          </div>

          {/* Pins de Pessoas no Mapa */}
          {nearbyCandidates.slice(0, 5).map((candidate, idx) => {
            const positions = [
              { x: 30, y: 32 },
              { x: 70, y: 38 },
              { x: 26, y: 72 },
              { x: 74, y: 68 },
              { x: 50, y: 22 }
            ];
            const pos = positions[idx % positions.length];
            const distance = getDistanceLabel(candidate.uid, idx);

            return (
              <button
                key={candidate.uid}
                type="button"
                onClick={() => setSelectedMapPin({
                  type: 'person',
                  id: candidate.uid,
                  title: `${candidate.displayName}, ${candidate.age}`,
                  subtitle: candidate.bio || 'À procura de ligação.',
                  photo: candidate.profilePhoto,
                  distance,
                  data: candidate
                })}
                style={{ top: `${pos.y}%`, left: `${pos.x}%` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 z-10 group cursor-pointer"
              >
                <div className="relative">
                  <div className="w-10 h-10 rounded-full border-2 border-white shadow-xl overflow-hidden bg-stone-800 group-hover:scale-115 transition">
                    <OptimizedImage
                      src={candidate.profilePhoto}
                      alt={candidate.displayName}
                      variant="avatar"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border border-black" />
                </div>
              </button>
            );
          })}

          {/* Pins de Eventos Locais */}
          {localEvents.map(evt => (
            <button
              key={evt.id}
              type="button"
              onClick={() => setSelectedMapPin({
                type: 'event',
                id: evt.id,
                title: evt.title,
                subtitle: evt.subtitle,
                distance: evt.distance,
                data: evt
              })}
              style={{ top: `${evt.y}%`, left: `${evt.x}%` }}
              className="absolute -translate-x-1/2 -translate-y-1/2 z-10 cursor-pointer group"
            >
              <div className="w-9 h-9 rounded-full bg-amber-500/90 text-white border-2 border-black shadow-lg flex items-center justify-center text-sm group-hover:scale-115 transition">
                <span>{evt.icon}</span>
              </div>
            </button>
          ))}

          {/* Pins de Comunidades Locais */}
          {localCommunities.map(comm => (
            <button
              key={comm.id}
              type="button"
              onClick={() => setSelectedMapPin({
                type: 'community',
                id: comm.id,
                title: comm.title,
                subtitle: comm.subtitle,
                distance: comm.distance,
                data: comm
              })}
              style={{ top: `${comm.y}%`, left: `${comm.x}%` }}
              className="absolute -translate-x-1/2 -translate-y-1/2 z-10 cursor-pointer group"
            >
              <div className="w-9 h-9 rounded-full bg-cyan-500/90 text-white border-2 border-black shadow-lg flex items-center justify-center text-sm group-hover:scale-115 transition">
                <span>{comm.icon}</span>
              </div>
            </button>
          ))}

          {/* Legenda do Mapa no Rodapé */}
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-10">
            <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full border border-stone-700/60 text-[10px] text-stone-300">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500" /> Pessoas</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Eventos</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan-500" /> Comunidades</span>
            </div>
          </div>

          {/* Card Flutuante de Detalhes do Pin Selecionado */}
          {selectedMapPin && (
            <div className="absolute bottom-20 left-4 right-4 bg-stone-900/95 backdrop-blur-md border border-stone-700/80 rounded-2xl p-4 shadow-2xl z-30 animate-in slide-in-from-bottom duration-200">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {selectedMapPin.photo ? (
                    <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-stone-700">
                      <OptimizedImage src={selectedMapPin.photo} alt={selectedMapPin.title} variant="avatar" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-stone-800 flex items-center justify-center text-xl shrink-0 border border-stone-700">
                      {selectedMapPin.type === 'event' ? '🎉' : '👥'}
                    </div>
                  )}

                  <div>
                    <h4 className="font-bold text-sm text-white">{selectedMapPin.title}</h4>
                    <p className="text-xs text-stone-300 line-clamp-1">{selectedMapPin.subtitle}</p>
                    <span className="text-[10px] font-bold text-rose-400 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3" />
                      <span>{selectedMapPin.distance}</span>
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedMapPin(null)}
                  className="p-1 text-stone-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Ação do Pin */}
              {selectedMapPin.type === 'person' && selectedMapPin.data && (
                <div className="mt-3 pt-2 border-t border-stone-800 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      handleLikeCandidate(selectedMapPin.data);
                      setSelectedMapPin(null);
                    }}
                    className="py-1.5 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Heart className="w-3.5 h-3.5 fill-current" />
                    <span>Conectar</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
