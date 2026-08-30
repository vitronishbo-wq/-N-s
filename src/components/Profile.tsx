import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  UserProfile,
  UserPreferences,
  PrivacySettings,
  CPLPCountryCode,
  RelationshipIntent,
  DataSaverSettings,
  AuthUser
} from '../types';
import {
  CPLP_COUNTRY_LIST,
  RELATIONSHIP_INTENTS_CONFIG,
  NORMALIZED_INTERESTS,
  CPLP_COUNTRIES
} from '../constants';
import { compressImage } from '../utils/imageCompression';
import { trustGraph } from '../services/trustGraph';
import { dataSaver, SimulatedNetworkMode, BandwidthTelemetry } from '../services/dataSaverService';
import { authService } from '../services/authService';
import { AccountSecurityModal } from './auth/AccountSecurityModal';
import { IdentityVerificationModal } from './profile/IdentityVerificationModal';
import { OptimizedImage } from './common/OptimizedImage';
import { ImmutableTrustEvidenceRecord } from '../types';
import {
  Camera,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Globe,
  Heart,
  Lock,
  Sparkles,
  Check,
  ChevronDown,
  ChevronRight,
  Mic,
  Volume2,
  Edit3,
  Sliders,
  Bell,
  Wifi,
  Moon,
  Sun,
  UserX,
  AlertTriangle,
  LogOut,
  KeyRound,
  Trash2,
  Eye,
  EyeOff,
  UserCheck,
  Users,
  MapPin,
  Compass,
  CheckCircle2,
  Radio,
  Share2,
  Plus,
  Play,
  Pause,
  Layers
} from 'lucide-react';

interface ProfileProps {
  profile: UserProfile;
  preferences: UserPreferences;
  privacy: PrivacySettings;
  isAnonymous: boolean;
  onUpdateProfile: (updated: Partial<UserProfile>) => void;
  onUpdatePreferences: (updated: Partial<UserPreferences>) => void;
  onUpdatePrivacy: (updated: Partial<PrivacySettings>) => void;
  onLinkAccount: (email: string) => void;
  onOpenKeypad?: () => void;
  onOpenGmail?: () => void;
}

export const Profile: React.FC<ProfileProps> = ({
  profile,
  preferences,
  privacy,
  isAnonymous,
  onUpdateProfile,
  onUpdatePreferences,
  onUpdatePrivacy,
  onLinkAccount
}) => {
  // ─────────────────────────────────────────────────────────────
  // ESTADO DE CONTROLO DE RECOLHIMENTO (100% RECOLHÍVEL & ACORDEÃO SUAVE)
  // ─────────────────────────────────────────────────────────────
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    identity: true,      // Camada 1 aberta por padrão para experiência acolhedora
    preferences: false, // Camada 2
    safety: false,      // Camada 3
    account: false      // Camada 4
  });

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Sub-modais e fluxos especializados
  const [isAccountSecurityModalOpen, setIsAccountSecurityModalOpen] = useState(false);
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);
  const [immutableEvidences, setImmutableEvidences] = useState<ImmutableTrustEvidenceRecord[]>([]);
  const [authUser, setAuthUser] = useState<AuthUser | null>(() => authService.getCurrentUser());

  // Estados de edição da Camada 1
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [bioText, setBioText] = useState(profile.bio || '');
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [hasVoiceBio, setHasVoiceBio] = useState(true);

  // Estados da Camada 3 (Segurança & Bloqueados & Denúncias)
  const [blockedUsers, setBlockedUsers] = useState<string[]>([
    'Utilizador_9842 (Portugal)',
    'Perfil_Suspeito_104 (Brasil)'
  ]);
  const [recentReports, setRecentReports] = useState<string[]>([
    'Denúncia #49102: SPAM / Bot - Resolvido com sucesso'
  ]);

  // Estados da Camada 4 (Conta, Aparência, Notificações, Idioma)
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [selectedTheme, setSelectedTheme] = useState<'dark' | 'light' | 'system'>('dark');
  const [selectedLanguage, setSelectedLanguage] = useState<'pt' | 'pt-BR' | 'pt-AO' | 'pt-MZ'>('pt');

  // Economia de Dados (Camada 4 - Conectividade)
  const [dataSaverSettings, setDataSaverSettings] = useState<DataSaverSettings>(() => dataSaver.getSettings());
  const [telemetry, setTelemetry] = useState<BandwidthTelemetry>(() => dataSaver.getTelemetry());

  const country = CPLP_COUNTRIES[profile.countryCode];
  const myTrustEvaluation = trustGraph.evaluateTrust(profile);

  // Galeria de Fotos
  const userGallery = profile.photos && profile.photos.length > 0
    ? profile.photos
    : [
        profile.profilePhoto,
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=600&auto=format&fit=crop&q=80'
      ];

  useEffect(() => {
    const unsubscribeAuth = authService.subscribe((u) => setAuthUser(u));
    const unsubscribeDataSaver = dataSaver.subscribe((event) => {
      if (event === 'telemetry_change') setTelemetry(dataSaver.getTelemetry());
      if (event === 'settings_change') setDataSaverSettings(dataSaver.getSettings());
    });

    trustGraph.fetchVerifiedImmutableEvidences(profile.uid).then(evs => {
      if (evs && evs.length > 0) setImmutableEvidences(evs);
    });

    return () => {
      unsubscribeAuth();
      unsubscribeDataSaver();
    };
  }, [profile.uid]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const compressed = await compressImage(file, 600, 0.7);
      onUpdateProfile({ profilePhoto: compressed });
    }
  };

  const handleVerificationSuccess = (evidence: ImmutableTrustEvidenceRecord) => {
    setImmutableEvidences(prev => [evidence, ...prev.filter(e => e.id !== evidence.id)]);
    onUpdateProfile({ verificationStatus: 'verified' });
  };

  const handleSaveBio = () => {
    onUpdateProfile({ bio: bioText });
    setIsEditingBio(false);
  };

  const handleToggleDataSaver = (enabled: boolean) => {
    const updated = dataSaver.updateSettings({ enabled });
    setDataSaverSettings(updated);
  };

  const handleUnblockUser = (name: string) => {
    setBlockedUsers(prev => prev.filter(u => u !== name));
  };

  return (
    <div className="flex-1 max-w-md mx-auto w-full min-h-screen bg-stone-950 text-white p-3.5 pb-28 space-y-3.5 select-none overflow-y-auto">
      
      {/* ─────────────────────────────────────────────────────────────
          CABEÇALHO COMPACTO & ELEGANTE (ESTILO LUXO MOBILE)
          ───────────────────────────────────────────────────────────── */}
      <div className="bg-stone-900/90 backdrop-blur-md rounded-3xl p-4 border border-stone-800 shadow-xl flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative w-14 h-14 rounded-2xl overflow-hidden border-2 border-rose-500/80 shrink-0 bg-stone-800 shadow-inner">
            <OptimizedImage
              src={profile.profilePhoto}
              alt={profile.displayName}
              variant="avatar"
              className="w-full h-full object-cover"
            />
            <label
              htmlFor="main-photo-upload"
              className="absolute inset-0 bg-black/40 hover:bg-black/60 flex items-center justify-center cursor-pointer text-white transition"
              title="Trocar Foto"
            >
              <Camera className="w-4 h-4" />
            </label>
            <input
              id="main-photo-upload"
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              className="hidden"
            />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="font-bold text-white text-base truncate">{profile.displayName}</h2>
              <span className="text-stone-400 text-sm font-normal">, {profile.age}</span>
              {profile.verificationStatus === 'verified' && (
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" title="Verificado" />
              )}
            </div>
            <p className="text-xs text-stone-400 flex items-center gap-1 mt-0.5">
              <span>{country?.flag}</span>
              <span className="truncate">{profile.cityName}, {country?.name}</span>
            </p>
          </div>
        </div>

        {/* Botão de Verificação Rápida */}
        <button
          type="button"
          onClick={() => setIsVerificationModalOpen(true)}
          className={`py-1.5 px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition cursor-pointer shrink-0 ${
            profile.verificationStatus === 'verified'
              ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
              : 'bg-stone-800 border-stone-700 text-stone-300 hover:border-stone-600'
          }`}
        >
          <ShieldCheck className={`w-3.5 h-3.5 ${profile.verificationStatus === 'verified' ? 'text-emerald-400' : 'text-amber-400'}`} />
          <span>{profile.verificationStatus === 'verified' ? 'Verificado' : 'Verificar'}</span>
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          CAMADA 1 — IDENTIDADE (100% RECOLHÍVEL)
          Foto | Galeria | 🎙️ Voz | ✏️ Editar | 🛡️ Verificação
          ───────────────────────────────────────────────────────────── */}
      <div className="bg-stone-900 border border-stone-800 rounded-3xl overflow-hidden shadow-lg transition-all">
        {/* Cabeçalho da Camada 1 */}
        <button
          type="button"
          onClick={() => toggleSection('identity')}
          className="w-full p-4 flex items-center justify-between bg-stone-900 hover:bg-stone-850 transition cursor-pointer text-left"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-xl bg-rose-950/60 border border-rose-800/80 flex items-center justify-center text-rose-400">
              <Camera className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Camada 1 — Identidade</h3>
              <p className="text-[11px] text-stone-400">Fotos, áudio de apresentação e biografia</p>
            </div>
          </div>
          <div className="p-1 rounded-lg text-stone-400 bg-stone-800">
            {openSections.identity ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </div>
        </button>

        {/* Conteúdo Expansível Camada 1 */}
        <AnimatePresence initial={false}>
          {openSections.identity && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="px-4 pb-4 space-y-3.5 border-t border-stone-800/60 pt-3"
            >
              {/* 📷 Galeria de Fotos */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-stone-300">Galeria de Fotos ({userGallery.length}/6)</label>
                  <label
                    htmlFor="gallery-upload"
                    className="text-[11px] font-bold text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Adicionar</span>
                  </label>
                  <input
                    id="gallery-upload"
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const comp = await compressImage(file, 600, 0.7);
                        onUpdateProfile({ photos: [...(profile.photos || []), comp] });
                      }
                    }}
                    className="hidden"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {userGallery.map((photoUrl, idx) => (
                    <div key={idx} className="relative aspect-4/5 rounded-2xl overflow-hidden bg-stone-800 border border-stone-700/80 group">
                      <OptimizedImage
                        src={photoUrl}
                        alt={`Foto ${idx + 1}`}
                        variant="card"
                        className="w-full h-full object-cover"
                      />
                      {idx === 0 && (
                        <span className="absolute top-1.5 left-1.5 bg-rose-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md shadow-xs">
                          Principal
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* 🎙️ Voz de Apresentação */}
              <div className="p-3 bg-stone-950/60 rounded-2xl border border-stone-800 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <Mic className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">Áudio de Apresentação</h4>
                    <p className="text-[11px] text-stone-400 font-mono">0:15 • Tom natural e sotaque</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPlayingVoice(!isPlayingVoice)}
                    className={`py-1.5 px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition cursor-pointer ${
                      isPlayingVoice
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                        : 'bg-stone-800 border-stone-700 text-stone-200 hover:border-stone-600'
                    }`}
                  >
                    {isPlayingVoice ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                    <span>{isPlayingVoice ? 'A Pausar' : 'Ouvir'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsRecordingVoice(true);
                      setTimeout(() => {
                        setIsRecordingVoice(false);
                        alert('Novo áudio de voz gravado e sincronizado com sucesso!');
                      }, 2000);
                    }}
                    className="p-2 bg-stone-800 hover:bg-stone-700 border border-stone-700 rounded-xl text-stone-300 transition cursor-pointer"
                    title="Gravar Novo Áudio"
                  >
                    <Mic className={`w-3.5 h-3.5 ${isRecordingVoice ? 'text-rose-500 animate-pulse' : ''}`} />
                  </button>
                </div>
              </div>

              {/* ✏️ Biografia & Apresentação */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-stone-300">Biografia</label>
                  <button
                    type="button"
                    onClick={() => {
                      if (isEditingBio) handleSaveBio();
                      else setIsEditingBio(true);
                    }}
                    className="text-[11px] font-bold text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>{isEditingBio ? 'Salvar' : 'Editar'}</span>
                  </button>
                </div>

                {isEditingBio ? (
                  <textarea
                    rows={3}
                    value={bioText}
                    onChange={e => setBioText(e.target.value)}
                    placeholder="Conte sobre seus valores, estilo de vida e o que torna a sua história única..."
                    className="w-full p-2.5 text-xs bg-stone-950 border border-stone-700 rounded-xl text-white focus:outline-rose-500"
                  />
                ) : (
                  <p className="text-xs text-stone-300 bg-stone-950/60 p-2.5 rounded-xl border border-stone-800/80 italic font-serif leading-relaxed">
                    "{profile.bio || 'Interessado(a) em conversas com profundidade, cultura lusófona e conexões genuínas.'}"
                  </p>
                )}
              </div>

              {/* 🛡️ Verificação de Identidade */}
              <div className="p-3 bg-emerald-950/30 rounded-2xl border border-emerald-900/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div className="text-xs">
                    <span className="font-bold text-emerald-200 block">Selo de Autenticidade</span>
                    <span className="text-[10px] text-emerald-400/80">Foto + Biometria auditada</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsVerificationModalOpen(true)}
                  className="py-1 px-2.5 bg-emerald-800/60 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  Gerir Selo
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          CAMADA 2 — PREFERÊNCIAS (100% RECOLHÍVEL)
          ❤️ O que procuro | 👥 Quem procuro | 📍 Onde procuro | ⚙️ Preferências
          ───────────────────────────────────────────────────────────── */}
      <div className="bg-stone-900 border border-stone-800 rounded-3xl overflow-hidden shadow-lg transition-all">
        <button
          type="button"
          onClick={() => toggleSection('preferences')}
          className="w-full p-4 flex items-center justify-between bg-stone-900 hover:bg-stone-850 transition cursor-pointer text-left"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-xl bg-rose-950/60 border border-rose-800/80 flex items-center justify-center text-rose-400">
              <Sliders className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Camada 2 — Preferências</h3>
              <p className="text-[11px] text-stone-400">Critérios de busca, intenção e alcance</p>
            </div>
          </div>
          <div className="p-1 rounded-lg text-stone-400 bg-stone-800">
            {openSections.preferences ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </div>
        </button>

        <AnimatePresence initial={false}>
          {openSections.preferences && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="px-4 pb-4 space-y-4 border-t border-stone-800/60 pt-3"
            >
              {/* ❤️ O que procuro (Intenção) */}
              <div>
                <label className="text-xs font-bold text-stone-300 block mb-1.5 flex items-center gap-1">
                  <Heart className="w-3.5 h-3.5 text-rose-500 fill-current" />
                  <span>O que procuro (Intenção)</span>
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {Object.entries(RELATIONSHIP_INTENTS_CONFIG).map(([key, cfg]) => {
                    const isSelected = profile.intent === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => onUpdateProfile({ intent: key as RelationshipIntent })}
                        className={`p-2 rounded-xl text-xs font-bold text-left border transition cursor-pointer ${
                          isSelected
                            ? 'bg-rose-600 border-rose-500 text-white'
                            : 'bg-stone-950 border-stone-800 text-stone-300 hover:border-stone-700'
                        }`}
                      >
                        <span className="block truncate">{cfg.label}</span>
                        <span className="text-[10px] opacity-75 font-normal block truncate">{cfg.description}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 👥 Quem procuro (Gênero & Faixa Etária) */}
              <div>
                <label className="text-xs font-bold text-stone-300 block mb-1.5 flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-sky-400" />
                  <span>Quem procuro (Gênero & Idade)</span>
                </label>

                {/* Seletor de Gênero Desejado */}
                <div className="flex gap-1.5 mb-2.5">
                  {[
                    { id: 'woman', label: 'Mulheres' },
                    { id: 'man', label: 'Homens' },
                    { id: 'non_binary', label: 'Todos' }
                  ].map(g => {
                    const isSelected = (preferences.genders || []).includes(g.id as any);
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => {
                          const current = preferences.genders || [];
                          const updated = isSelected
                            ? current.filter(x => x !== g.id)
                            : [...current, g.id as any];
                          onUpdatePreferences({ genders: updated.length > 0 ? updated : ['woman', 'man'] });
                        }}
                        className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                          isSelected
                            ? 'bg-stone-100 text-stone-950 border-white'
                            : 'bg-stone-950 border-stone-800 text-stone-400'
                        }`}
                      >
                        {g.label}
                      </button>
                    );
                  })}
                </div>

                {/* Idade Slider */}
                <div className="bg-stone-950/60 p-2.5 rounded-2xl border border-stone-800 space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-stone-400">Faixa Etária:</span>
                    <span className="font-bold text-white">{preferences.minAge} — {preferences.maxAge} anos</span>
                  </div>
                  <input
                    type="range"
                    min="18"
                    max="70"
                    value={preferences.maxAge}
                    onChange={e => onUpdatePreferences({ maxAge: Number(e.target.value) })}
                    className="w-full accent-rose-500 cursor-pointer"
                  />
                </div>
              </div>

              {/* 📍 Onde procuro (Raio & Comunidade CPLP) */}
              <div>
                <label className="text-xs font-bold text-stone-300 block mb-1.5 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Onde procuro (Distância & Países)</span>
                </label>

                {/* Distância Máxima */}
                <div className="bg-stone-950/60 p-2.5 rounded-2xl border border-stone-800 space-y-1.5 mb-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-stone-400">Raio de Proximidade:</span>
                    <span className="font-bold text-emerald-400">
                      {preferences.distanceKm && preferences.distanceKm > 0 ? `${preferences.distanceKm} km` : 'Toda a Lusofonia 🌍'}
                    </span>
                  </div>
                  <div className="flex gap-1 overflow-x-auto no-scrollbar py-1">
                    {[10, 25, 50, 100, 0].map(dist => (
                      <button
                        key={dist}
                        type="button"
                        onClick={() => onUpdatePreferences({ distanceKm: dist })}
                        className={`py-1 px-2.5 rounded-lg text-xs font-bold shrink-0 border transition cursor-pointer ${
                          preferences.distanceKm === dist
                            ? 'bg-emerald-600 border-emerald-500 text-white'
                            : 'bg-stone-900 border-stone-800 text-stone-400'
                        }`}
                      >
                        {dist === 0 ? 'Sem Limite' : `${dist} km`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Alternância Lusofonia Global */}
                <div className="flex items-center justify-between p-2.5 bg-stone-950/60 rounded-2xl border border-stone-800">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-purple-400 shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold text-white">Conexões Interculturais CPLP</h4>
                      <p className="text-[10px] text-stone-400">Descobrir em Angola, Brasil, Portugal, etc.</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={preferences.crossCultural}
                    onChange={e => onUpdatePreferences({ crossCultural: e.target.checked })}
                    className="w-4 h-4 accent-rose-600 cursor-pointer"
                  />
                </div>
              </div>

              {/* ⚙️ Preferências Extras */}
              <div className="flex items-center justify-between p-2.5 bg-stone-950/60 rounded-2xl border border-stone-800">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <h4 className="text-xs font-bold text-white">Somente Perfis Verificados</h4>
                    <p className="text-[10px] text-stone-400">Exibir apenas membros com selo de identidade</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.verifiedOnly}
                  onChange={e => onUpdatePreferences({ verifiedOnly: e.target.checked })}
                  className="w-4 h-4 accent-rose-600 cursor-pointer"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          CAMADA 3 — SEGURANÇA (100% RECOLHÍVEL)
          🛡️ Identidade | 🔐 Privacidade | 🚫 Bloqueados | ⚠️ Denúncias
          ───────────────────────────────────────────────────────────── */}
      <div className="bg-stone-900 border border-stone-800 rounded-3xl overflow-hidden shadow-lg transition-all">
        <button
          type="button"
          onClick={() => toggleSection('safety')}
          className="w-full p-4 flex items-center justify-between bg-stone-900 hover:bg-stone-855 transition cursor-pointer text-left"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-xl bg-emerald-950/60 border border-emerald-800/80 flex items-center justify-center text-emerald-400">
              <Shield className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Camada 3 — Segurança</h3>
              <p className="text-[11px] text-stone-400">Privacidade, bloqueios, auditoria e denúncias</p>
            </div>
          </div>
          <div className="p-1 rounded-lg text-stone-400 bg-stone-800">
            {openSections.safety ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </div>
        </button>

        <AnimatePresence initial={false}>
          {openSections.safety && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="px-4 pb-4 space-y-3.5 border-t border-stone-800/60 pt-3"
            >
              {/* 🛡️ Identidade & Grau de Confiança */}
              <div className="p-3 bg-stone-950/60 rounded-2xl border border-stone-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Identidade & Confiabilidade</span>
                  </span>
                  <span className="text-xs font-bold text-emerald-400 font-mono">
                    {myTrustEvaluation.eligibleBadges.length} Selos Ativos
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {myTrustEvaluation.eligibleBadges.map((b, idx) => (
                    <span key={idx} className="text-[10px] bg-emerald-950/60 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-emerald-400" />
                      <span>{b.label}</span>
                    </span>
                  ))}
                  {myTrustEvaluation.eligibleBadges.length === 0 && (
                    <span className="text-[10px] text-stone-400">Verifique a sua identidade para obter selos oficiais.</span>
                  )}
                </div>
                <p className="text-[10px] text-stone-400">
                  Perfis com verificação biométrica e foto auditada têm 4x mais respostas e prioridade nos filtros.
                </p>
              </div>

              {/* 🔐 Privacidade */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-stone-300">Controlo de Visibilidade</h4>

                <div className="flex items-center justify-between p-2.5 bg-stone-950/60 rounded-2xl border border-stone-800">
                  <div className="text-xs">
                    <span className="font-bold text-white block">Localização Aproximada</span>
                    <span className="text-[10px] text-stone-400">Exibir apenas cidade/região sem coordenadas exatas</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={privacy.shareApproximateLocationOnly}
                    onChange={e => onUpdatePrivacy({ shareApproximateLocationOnly: e.target.checked })}
                    className="w-4 h-4 accent-rose-600 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-2.5 bg-stone-950/60 rounded-2xl border border-stone-800">
                  <div className="text-xs">
                    <span className="font-bold text-white block">Status Online</span>
                    <span className="text-[10px] text-stone-400">Mostrar quando estiver ativo(a) na app</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={privacy.showOnlineStatus}
                    onChange={e => onUpdatePrivacy({ showOnlineStatus: e.target.checked })}
                    className="w-4 h-4 accent-rose-600 cursor-pointer"
                  />
                </div>
              </div>

              {/* 🚫 Bloqueados */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <h4 className="text-xs font-bold text-stone-300 flex items-center gap-1">
                    <UserX className="w-3.5 h-3.5 text-rose-400" />
                    <span>Perfis Bloqueados ({blockedUsers.length})</span>
                  </h4>
                </div>

                {blockedUsers.length === 0 ? (
                  <p className="text-[11px] text-stone-500 p-2.5 bg-stone-950/40 rounded-xl border border-stone-850 text-center">
                    Nenhum utilizador bloqueado.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {blockedUsers.map((user, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-stone-950/60 rounded-xl border border-stone-800 text-xs">
                        <span className="text-stone-300 truncate max-w-[200px]">{user}</span>
                        <button
                          type="button"
                          onClick={() => handleUnblockUser(user)}
                          className="text-[10px] font-bold text-rose-400 hover:text-rose-300 transition cursor-pointer"
                        >
                          Desbloquear
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ⚠️ Denúncias & Histórico de Moderação */}
              <div>
                <h4 className="text-xs font-bold text-stone-300 flex items-center gap-1 mb-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  <span>Histórico de Segurança & Denúncias</span>
                </h4>
                <div className="space-y-1.5">
                  {recentReports.map((rep, idx) => (
                    <div key={idx} className="p-2 bg-amber-950/20 border border-amber-900/40 rounded-xl text-[11px] text-amber-200">
                      {rep}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          CAMADA 4 — CONTA (100% RECOLHÍVEL)
          🔔 Notificações | 📶 Dados | 🌙 Aparência | 🌍 Idioma | ⚙️ Conta
          ───────────────────────────────────────────────────────────── */}
      <div className="bg-stone-900 border border-stone-800 rounded-3xl overflow-hidden shadow-lg transition-all">
        <button
          type="button"
          onClick={() => toggleSection('account')}
          className="w-full p-4 flex items-center justify-between bg-stone-900 hover:bg-stone-850 transition cursor-pointer text-left"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-xl bg-sky-950/60 border border-sky-800/80 flex items-center justify-center text-sky-400">
              <KeyRound className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Camada 4 — Conta & Sistema</h3>
              <p className="text-[11px] text-stone-400">Notificações, dados, tema, idioma e sessões</p>
            </div>
          </div>
          <div className="p-1 rounded-lg text-stone-400 bg-stone-800">
            {openSections.account ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </div>
        </button>

        <AnimatePresence initial={false}>
          {openSections.account && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="px-4 pb-4 space-y-4 border-t border-stone-800/60 pt-3"
            >
              {/* 🔔 Notificações */}
              <div className="flex items-center justify-between p-2.5 bg-stone-950/60 rounded-2xl border border-stone-800">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-sky-400 shrink-0" />
                  <div>
                    <h4 className="text-xs font-bold text-white">Notificações Push</h4>
                    <p className="text-[10px] text-stone-400">Alertas de novas ligações e mensagens</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={notificationsEnabled}
                  onChange={e => setNotificationsEnabled(e.target.checked)}
                  className="w-4 h-4 accent-rose-600 cursor-pointer"
                />
              </div>

              {/* 📶 Dados & Conectividade Inteligente */}
              <div className="p-3 bg-stone-950/60 rounded-2xl border border-stone-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wifi className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold text-white">Economia Extrema de Dados</h4>
                      <p className="text-[10px] text-stone-400">Otimizado para redes 2G/3G e pacotes móveis</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={dataSaverSettings.enabled}
                    onChange={e => handleToggleDataSaver(e.target.checked)}
                    className="w-4 h-4 accent-emerald-500 cursor-pointer"
                  />
                </div>
                <div className="text-[10px] text-stone-400 bg-stone-900 p-2 rounded-xl border border-stone-800 flex justify-between font-mono">
                  <span>Tráfego Poupado:</span>
                  <span className="text-emerald-400 font-bold">{(telemetry.totalBytesSaved / (1024 * 1024)).toFixed(2)} MB</span>
                </div>
              </div>

              {/* 🌙 Aparência */}
              <div>
                <label className="text-xs font-bold text-stone-300 block mb-1.5 flex items-center gap-1">
                  <Moon className="w-3.5 h-3.5 text-purple-400" />
                  <span>Aparência</span>
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: 'dark', label: 'Escuro', icon: Moon },
                    { id: 'light', label: 'Claro', icon: Sun },
                    { id: 'system', label: 'Automático', icon: Layers }
                  ].map(thm => {
                    const Icon = thm.icon;
                    const isSelected = selectedTheme === thm.id;
                    return (
                      <button
                        key={thm.id}
                        type="button"
                        onClick={() => setSelectedTheme(thm.id as any)}
                        className={`py-2 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 border transition cursor-pointer ${
                          isSelected
                            ? 'bg-stone-100 text-stone-950 border-white'
                            : 'bg-stone-950 border-stone-800 text-stone-400 hover:text-stone-200'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{thm.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 🌍 Idioma & Dialeto Lusófono */}
              <div>
                <label className="text-xs font-bold text-stone-300 block mb-1.5 flex items-center gap-1">
                  <Globe className="w-3.5 h-3.5 text-amber-400" />
                  <span>Idioma & Expressão</span>
                </label>
                <select
                  value={selectedLanguage}
                  onChange={e => setSelectedLanguage(e.target.value as any)}
                  className="w-full p-2.5 text-xs bg-stone-950 border border-stone-700 rounded-xl text-white focus:outline-rose-500 cursor-pointer"
                >
                  <option value="pt">Português (Padrão CPLP)</option>
                  <option value="pt-BR">Português (Brasil)</option>
                  <option value="pt-AO">Português (Angola)</option>
                  <option value="pt-MZ">Português (Moçambique)</option>
                </select>
              </div>

              {/* ⚙️ Conta & Sessões */}
              <div className="pt-2 border-t border-stone-800 space-y-2">
                <button
                  type="button"
                  onClick={() => setIsAccountSecurityModalOpen(true)}
                  className="w-full py-2.5 bg-stone-800 hover:bg-stone-700 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 cursor-pointer border border-stone-700"
                >
                  <KeyRound className="w-3.5 h-3.5 text-rose-400" />
                  <span>Gerir Sessões e Credenciais</span>
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    if (confirm('Deseja realmente terminar a sua sessão?')) {
                      try {
                        const { auth, signOut } = await import('../firebase/config');
                        await signOut(auth);
                      } catch (e) {
                        console.info('Logout completed', e);
                      }
                      window.location.reload();
                    }
                  }}
                  className="w-full py-2 bg-rose-950/40 hover:bg-rose-950/80 text-rose-300 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer border border-rose-900/50"
                >
                  <LogOut className="w-3.5 h-3.5 text-rose-400" />
                  <span>Terminar Sessão</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          MODAIS ESSENCIAIS
          ───────────────────────────────────────────────────────────── */}
      <AccountSecurityModal
        isOpen={isAccountSecurityModalOpen}
        onClose={() => setIsAccountSecurityModalOpen(false)}
        profile={profile}
        onAccountLinked={(email) => {
          onLinkAccount(email);
        }}
      />

      <IdentityVerificationModal
        isOpen={isVerificationModalOpen}
        onClose={() => setIsVerificationModalOpen(false)}
        profile={profile}
        onVerificationSuccess={handleVerificationSuccess}
      />
    </div>
  );
};
