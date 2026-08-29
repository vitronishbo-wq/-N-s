import React, { useState, useEffect } from 'react';
import {
  UserProfile,
  UserPreferences,
  PrivacySettings,
  CPLPCountryCode,
  RelationshipIntent,
  DataSaverSettings,
  TrustBadge
} from '../types';
import { CPLP_COUNTRY_LIST, RELATIONSHIP_INTENTS_CONFIG, NORMALIZED_INTERESTS, CPLP_COUNTRIES } from '../constants';
import { compressImage } from '../utils/imageCompression';
import { trustGraph } from '../services/trustGraph';
import { dataSaver, SimulatedNetworkMode, BandwidthTelemetry } from '../services/dataSaverService';
import { connectionGraph } from '../services/connectionGraph';
import { relationalMemory } from '../services/relationalMemory';
import { OptimizedImage } from './common/OptimizedImage';
import {
  Camera,
  Shield,
  ShieldCheck,
  Globe,
  Heart,
  Lock,
  UserCheck,
  Sparkles,
  Check,
  Link,
  Mail,
  Wifi,
  WifiOff,
  Activity,
  HeartHandshake,
  Zap,
  Flame,
  CheckCircle2,
  Download,
  Database,
  RefreshCw,
  Eye,
  Radio,
  Smartphone,
  Gauge,
  Brain,
  Layers,
  Compass,
  ArrowRight,
  TrendingUp
} from 'lucide-react';
import { isGmailConnected } from '../services/gmail';

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
  onLinkAccount,
  onOpenKeypad,
  onOpenGmail
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'preferences' | 'safety' | 'dataSaver' | 'memory'>('profile');
  const [emailInput, setEmailInput] = useState('');
  const [linking, setLinking] = useState(false);
  const [linkedSuccess, setLinkedSuccess] = useState(false);
  const [editingBio, setEditingBio] = useState(profile.bio);

  const [dataSaverSettings, setDataSaverSettings] = useState<DataSaverSettings>(() => dataSaver.getSettings());
  const [telemetry, setTelemetry] = useState<BandwidthTelemetry>(() => dataSaver.getTelemetry());
  const [offlineQueue, setOfflineQueue] = useState(() => dataSaver.getQueue());
  const [networkMode, setNetworkMode] = useState<SimulatedNetworkMode>(() => dataSaver.getSimulatedMode());
  const [networkCondition, setNetworkCondition] = useState(() => dataSaver.detectCurrentNetworkCondition());
  const [isFlushing, setIsFlushing] = useState(false);
  const [mcrMetrics, setMcrMetrics] = useState(() => connectionGraph.calculateMCRMetrics());
  const [userMemory, setUserMemory] = useState(() => relationalMemory.getMemoryForUser(profile.uid));

  const country = CPLP_COUNTRIES[profile.countryCode];
  const myTrustEvaluation = trustGraph.evaluateTrust(profile);

  useEffect(() => {
    setMcrMetrics(connectionGraph.calculateMCRMetrics());
    setUserMemory(relationalMemory.getMemoryForUser(profile.uid));

    const unsubscribeDataSaver = dataSaver.subscribe((event) => {
      if (event === 'telemetry_change') setTelemetry(dataSaver.getTelemetry());
      if (event === 'queue_change') setOfflineQueue(dataSaver.getQueue());
      if (event === 'network_change' || event === 'settings_change') {
        setNetworkMode(dataSaver.getSimulatedMode());
        setNetworkCondition(dataSaver.detectCurrentNetworkCondition());
        setDataSaverSettings(dataSaver.getSettings());
      }
    });

    const unsubscribeMemory = relationalMemory.subscribe((uid) => {
      if (uid === profile.uid) {
        setUserMemory(relationalMemory.getMemoryForUser(profile.uid));
      }
    });

    return () => {
      unsubscribeDataSaver();
      unsubscribeMemory();
    };
  }, [profile.uid]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const compressed = await compressImage(file, 600, 0.7);
      onUpdateProfile({ profilePhoto: compressed });
    }
  };

  const handleLinkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) return;
    setLinking(true);
    setTimeout(() => {
      onLinkAccount(emailInput.trim());
      setLinking(false);
      setLinkedSuccess(true);
    }, 600);
  };

  const handleToggleDataSaver = (enabled: boolean) => {
    const updated = dataSaver.updateSettings({ enabled });
    setDataSaverSettings(updated);
  };

  const handleChangeQualityLevel = (qualityLevel: DataSaverSettings['qualityLevel']) => {
    const updated = dataSaver.updateSettings({ qualityLevel });
    setDataSaverSettings(updated);
  };

  const handleToggleThumbnailsOnly = (loadThumbnailsOnly: boolean) => {
    const updated = dataSaver.updateSettings({ loadThumbnailsOnly });
    setDataSaverSettings(updated);
  };

  const handleManualSync = async () => {
    setIsFlushing(true);
    try {
      await dataSaver.flushQueue();
      setOfflineQueue(dataSaver.getQueue());
    } finally {
      setIsFlushing(false);
    }
  };

  const handleChangeNetworkMode = (mode: SimulatedNetworkMode) => {
    dataSaver.setSimulatedMode(mode);
    setNetworkMode(mode);
  };

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const totalCalculated = telemetry.totalBytesDownloaded + telemetry.totalBytesSaved;
  const savedPercent = totalCalculated > 0 ? Math.round((telemetry.totalBytesSaved / totalCalculated) * 100) : 0;

  return (
    <div className="flex-1 max-w-md mx-auto w-full p-4 pb-24 sm:pb-8 space-y-4">
      {/* User Mini Hero */}
      <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs flex items-center gap-4">
        <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-rose-500 shrink-0 bg-stone-100">
          <OptimizedImage
            src={profile.profilePhoto}
            alt={profile.displayName}
            variant="avatar"
            className="w-full h-full"
          />
          <label
            htmlFor="profile-photo-upload"
            className="absolute inset-0 bg-black/40 flex items-center justify-center cursor-pointer text-white hover:bg-black/50 transition z-10"
          >
            <Camera className="w-4 h-4" />
          </label>
          <input
            id="profile-photo-upload"
            type="file"
            accept="image/*"
            onChange={handlePhotoUpload}
            className="hidden"
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h2 className="font-bold text-stone-900 text-lg truncate">{profile.displayName}</h2>
            <span className="text-sm font-normal text-stone-700">, {profile.age}</span>
            {(myTrustEvaluation.signals?.identityEvidenceLevel === 'verified_id' || myTrustEvaluation.signals?.identityEvidenceLevel === 'biometric_cleared' || profile.verificationStatus === 'verified') && (
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" title="Identidade Verificada" />
            )}
          </div>
          <p className="text-xs text-stone-700 flex items-center gap-1 mt-0.5">
            <span>{country?.flag}</span>
            <span>{profile.cityName}, {country?.name}</span>
          </p>

          {/* Meaningful Connection Metric Badge */}
          <div className="flex items-center gap-1.5 mt-2">
            <span className="text-[10px] font-semibold bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full border border-rose-200 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-rose-500" />
              <span>Taxa de Conexão (MCR): {mcrMetrics.mcrScorePercent}%</span>
            </span>
          </div>
        </div>
      </div>

      {/* Anonymous Account Link Prompt Banner */}
      {isAnonymous && !linkedSuccess && (
        <div className="bg-gradient-to-r from-rose-50 to-amber-50 border border-rose-200/80 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-start gap-2.5">
            <Shield className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-xs">
              <h3 className="font-bold text-stone-900">Salvar seu perfil com E-mail</h3>
              <p className="text-stone-600 mt-0.5 leading-relaxed">
                Vincule seu e-mail para não perder seus matches e mensagens.
              </p>
              <form onSubmit={handleLinkSubmit} className="mt-2.5 flex gap-2">
                <input
                  type="email"
                  placeholder="seu.email@exemplo.com"
                  value={emailInput}
                  onChange={e => setEmailInput(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-xs bg-white border border-stone-200 rounded-lg focus:outline-rose-500"
                  required
                />
                <button
                  type="submit"
                  disabled={linking}
                  className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700 transition"
                >
                  {linking ? 'Salvando...' : 'Salvar'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex bg-stone-100 p-1 rounded-xl text-xs font-semibold text-stone-600">
        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className={`flex-1 py-2 rounded-lg transition text-center ${
            activeTab === 'profile' ? 'bg-white text-rose-600 shadow-2xs font-bold' : 'hover:text-stone-900'
          }`}
        >
          Perfil
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('memory')}
          className={`flex-1 py-2 rounded-lg transition text-center flex items-center justify-center gap-1 ${
            activeTab === 'memory' ? 'bg-white text-rose-600 shadow-2xs font-bold' : 'hover:text-stone-900'
          }`}
        >
          <Brain className="w-3 h-3 text-rose-500" />
          <span>Memória</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('preferences')}
          className={`flex-1 py-2 rounded-lg transition text-center ${
            activeTab === 'preferences' ? 'bg-white text-rose-600 shadow-2xs font-bold' : 'hover:text-stone-900'
          }`}
        >
          Preferências
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('safety')}
          className={`flex-1 py-2 rounded-lg transition text-center ${
            activeTab === 'safety' ? 'bg-white text-rose-600 shadow-2xs font-bold' : 'hover:text-stone-900'
          }`}
        >
          Confiança
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('dataSaver')}
          className={`flex-1 py-2 rounded-lg transition text-center ${
            activeTab === 'dataSaver' ? 'bg-white text-rose-600 shadow-2xs font-bold' : 'hover:text-stone-900'
          }`}
        >
          Economia
        </button>
      </div>

      {/* TAB 1: PERFIL */}
      {activeTab === 'profile' && (
        <div className="space-y-4 bg-white p-4 rounded-2xl border border-stone-200 shadow-2xs">
          <div>
            <label className="text-xs font-bold text-stone-900 block mb-1">Biografia & Apresentação</label>
            <textarea
              rows={3}
              value={editingBio}
              onChange={e => setEditingBio(e.target.value)}
              onBlur={() => onUpdateProfile({ bio: editingBio })}
              placeholder="Fale sobre seus gostos, sua cultura e o que busca..."
              className="w-full p-2.5 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-rose-500"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-stone-900 block mb-1">Intenção de Conexão</label>
            <select
              value={profile.intent}
              onChange={e => onUpdateProfile({ intent: e.target.value as RelationshipIntent })}
              className="w-full p-2.5 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-rose-500"
            >
              {Object.entries(RELATIONSHIP_INTENTS_CONFIG).map(([k, cfg]) => (
                <option key={k} value={k}>{cfg.label} ({cfg.description})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-stone-900 block mb-1.5">Interesses & Afinidades</label>
            <div className="flex flex-wrap gap-1.5">
              {NORMALIZED_INTERESTS.map(interest => {
                const isSelected = profile.interests.includes(interest);
                return (
                  <button
                    key={interest}
                    type="button"
                    onClick={() => {
                      const updated = isSelected
                        ? profile.interests.filter(i => i !== interest)
                        : [...profile.interests, interest];
                      onUpdateProfile({ interests: updated });
                    }}
                    className={`text-xs px-2.5 py-1 rounded-full border transition ${
                      isSelected
                        ? 'bg-rose-50 border-rose-400 text-rose-700 font-bold'
                        : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'
                    }`}
                  >
                    {interest}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PREFERÊNCIAS */}
      {activeTab === 'preferences' && (
        <div className="space-y-4 bg-white p-4 rounded-2xl border border-stone-200 shadow-2xs">
          <div className="flex items-center justify-between pb-3 border-b border-stone-100">
            <div>
              <h4 className="text-xs font-bold text-stone-900">Conexão Intercultural Lusófona</h4>
              <p className="text-[11px] text-stone-700">Descobrir pessoas em todos os 9 países da CPLP</p>
            </div>
            <input
              type="checkbox"
              checked={preferences.crossCultural}
              onChange={e => onUpdatePreferences({ crossCultural: e.target.checked })}
              className="w-5 h-5 accent-rose-600 cursor-pointer rounded"
            />
          </div>

          <div>
            <h4 className="text-xs font-bold text-stone-900 mb-2">Faixa Etária Desejada</h4>
            <div className="flex items-center gap-3">
              <span className="text-xs text-stone-700">{preferences.minAge} anos</span>
              <input
                type="range"
                min="18"
                max="65"
                value={preferences.maxAge}
                onChange={e => onUpdatePreferences({ maxAge: Number(e.target.value) })}
                className="flex-1 accent-rose-600"
              />
              <span className="text-xs font-bold text-stone-900">{preferences.maxAge} anos</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CONFIANÇA & SEGURANÇA (PONTO 3: TRUST GRAPH) */}
      {activeTab === 'safety' && (
        <div className="space-y-4 bg-white p-4 rounded-2xl border border-stone-200 shadow-2xs">
          {/* Trust Badges Banner */}
          <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Seus Distintivos de Confiança ÉNós</span>
              </span>
              <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                Privado & Não-Punitivo
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              {(myTrustEvaluation.eligibleBadges || []).map((b, idx) => (
                <div key={idx} className="p-2 bg-white rounded-lg border border-stone-200/80 shadow-2xs flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[11px] font-bold text-stone-900 block">{b.label}</span>
                    <span className="text-[10px] text-stone-600 leading-tight block">{b.description}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pb-3 border-b border-stone-100">
            <div>
              <h4 className="text-xs font-bold text-stone-900">Mostrar Minha Idade</h4>
              <p className="text-[11px] text-stone-700">Exibir idade no perfil público</p>
            </div>
            <input
              type="checkbox"
              checked={privacy.showAge}
              onChange={e => onUpdatePrivacy({ showAge: e.target.checked })}
              className="w-5 h-5 accent-rose-600 cursor-pointer rounded"
            />
          </div>

          <div className="flex items-center justify-between pb-3 border-b border-stone-100">
            <div>
              <h4 className="text-xs font-bold text-stone-900">Localização Aproximada</h4>
              <p className="text-[11px] text-stone-700">Compartilhar apenas região/cidade aproximada</p>
            </div>
            <input
              type="checkbox"
              checked={privacy.shareApproximateLocationOnly}
              onChange={e => onUpdatePrivacy({ shareApproximateLocationOnly: e.target.checked })}
              className="w-5 h-5 accent-rose-600 cursor-pointer rounded"
            />
          </div>

          <div className="flex items-center justify-between pb-3 border-b border-stone-100">
            <div>
              <h4 className="text-xs font-bold text-stone-900">Status Online</h4>
              <p className="text-[11px] text-stone-700">Exibir quando você estiver ativo</p>
            </div>
            <input
              type="checkbox"
              checked={privacy.showOnlineStatus}
              onChange={e => onUpdatePrivacy({ showOnlineStatus: e.target.checked })}
              className="w-5 h-5 accent-rose-600 cursor-pointer rounded"
            />
          </div>

          {onOpenGmail && (
            <div className="pt-2">
              <button
                type="button"
                id="btn-open-gmail-profile"
                onClick={onOpenGmail}
                className="w-full py-2.5 px-4 bg-white hover:bg-stone-50 border border-stone-300 text-stone-800 font-medium text-xs rounded-xl flex items-center justify-between transition cursor-pointer active:scale-98 shadow-2xs"
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
                    <Mail className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-left">
                    <span className="font-semibold block">Google Workspace · Gmail</span>
                    <span className="text-[10px] text-stone-500">
                      {isGmailConnected() ? 'Conectado à sua conta Google' : 'Conectar para ler e enviar e-mails'}
                    </span>
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-rose-600">
                  {isGmailConnected() ? 'Abrir' : 'Conectar'}
                </span>
              </button>
            </div>
          )}

          {onOpenKeypad && (
            <div className="pt-1">
              <button
                type="button"
                id="btn-open-admin-keypad-profile"
                onClick={onOpenKeypad}
                className="w-full py-2.5 px-4 bg-stone-900 hover:bg-stone-800 text-stone-100 font-medium text-xs rounded-xl flex items-center justify-center gap-2 transition cursor-pointer active:scale-98 shadow-sm"
              >
                <Shield className="w-4 h-4 text-rose-500" />
                <span>Acesso Administrativo (Teclado PIN)</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: MODO ECONOMIA DE DADOS & RESILIÊNCIA CPLP (PONTO 4) */}
      {activeTab === 'dataSaver' && (
        <div className="space-y-4 bg-white p-4 rounded-2xl border border-stone-200 shadow-2xs">
          {/* Header Banner - Architectural Philosophy */}
          <div className="p-3.5 bg-gradient-to-r from-amber-50 via-rose-50 to-orange-50 rounded-xl border border-amber-200/80 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-950 font-serif">
                <Wifi className="w-4 h-4 text-amber-600" />
                <span>Economia de Dados & Conexão Lusófona</span>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                dataSaver.isOnline() ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
              }`}>
                {dataSaver.isOnline() ? <CheckCircle2 className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                <span>{dataSaver.isOnline() ? 'Conectado' : 'Offline'}</span>
              </span>
            </div>
            <p className="text-[11px] text-stone-700 leading-relaxed font-sans">
              "A experiência principal deve continuar excelente mesmo quando a internet não é excelente." Otimizado com arquitetura adaptativa para Angola, Cabo Verde, Guiné-Bissau, Moçambique, Portugal, São Tomé e Timor-Leste.
            </p>
          </div>

          {/* 1. Network Awareness & Adaptation Status Card */}
          <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200/90 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-rose-600" />
                <span>Sensibilidade e Estado da Rede</span>
              </span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-rose-50 text-rose-800 rounded-md border border-rose-200">
                {networkCondition.category}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] font-mono">
              <div className="p-2 bg-white rounded-lg border border-stone-200 text-stone-700">
                <span className="text-stone-400 block text-[9px]">Tipo Efetivo</span>
                <span className="font-bold text-stone-900 uppercase">{networkCondition.effectiveType || '3G'}</span>
              </div>
              <div className="p-2 bg-white rounded-lg border border-stone-200 text-stone-700">
                <span className="text-stone-400 block text-[9px]">Latência (RTT)</span>
                <span className="font-bold text-stone-900">{networkCondition.rttMs ? `${networkCondition.rttMs} ms` : '~300 ms'}</span>
              </div>
              <div className="p-2 bg-white rounded-lg border border-stone-200 text-stone-700">
                <span className="text-stone-400 block text-[9px]">Meta Ecrã Inicial</span>
                <span className="font-bold text-emerald-700 font-mono">&lt; 150 KB</span>
              </div>
              <div className="p-2 bg-white rounded-lg border border-stone-200 text-stone-700">
                <span className="text-stone-400 block text-[9px]">Autoplay Mídia</span>
                <span className={`font-bold ${dataSaver.isAutoplayAllowed() ? 'text-amber-700' : 'text-rose-700'}`}>
                  {dataSaver.isAutoplayAllowed() ? 'Permitido' : 'Bloqueado'}
                </span>
              </div>
            </div>

            {/* Auto-Adaptive Switch */}
            <div className="flex items-center justify-between pt-1 border-t border-stone-200/70">
              <div>
                <h5 className="text-xs font-bold text-stone-900">Adaptação Automática à Rede</h5>
                <p className="text-[10px] text-stone-600">O sistema deteta a condição da rede (2G/3G/4G) e ajusta imagens e áudio sem intervenção</p>
              </div>
              <input
                type="checkbox"
                id="toggle-auto-adaptive"
                checked={dataSaverSettings.mode === 'auto_adaptive'}
                onChange={e => {
                  const updated = dataSaver.updateSettings({
                    mode: e.target.checked ? 'auto_adaptive' : 'manual'
                  });
                  setDataSaverSettings(updated);
                }}
                className="w-4 h-4 accent-rose-600 cursor-pointer rounded shrink-0 ml-2"
              />
            </div>
          </div>

          {/* 2. Bandwidth & Telemetry Dashboard */}
          <div className="grid grid-cols-2 gap-2">
            <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl">
              <div className="flex items-center justify-between text-emerald-800 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">Dados Poupados</span>
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <div className="text-base font-black text-emerald-950 font-mono">
                {formatBytes(telemetry.totalBytesSaved)}
              </div>
              <p className="text-[10px] text-emerald-700 mt-0.5 font-medium">
                {savedPercent}% de redução de tráfego
              </p>
            </div>

            <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl">
              <div className="flex items-center justify-between text-stone-600 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">Tráfego Usado</span>
                <Download className="w-3.5 h-3.5 text-stone-500" />
              </div>
              <div className="text-base font-black text-stone-900 font-mono">
                {formatBytes(telemetry.totalBytesDownloaded)}
              </div>
              <p className="text-[10px] text-stone-700 mt-0.5">
                {telemetry.networkRequestsCount} reqs · {telemetry.cacheHitsCount} no cache
              </p>
            </div>
          </div>

          {/* 3. Image Pipeline & Progressive Loading */}
          <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-stone-900">Pipeline de Imagens AVIF/WebP</h4>
                <p className="text-[10px] text-stone-600">Carregamento progressivo de perfis com formato moderno e dimensões responsivas</p>
              </div>
              <span className="text-[9px] font-mono font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
                AVIF + WebP
              </span>
            </div>

            <div className="space-y-2 pt-1">
              <label className="text-xs font-bold text-stone-900 block">
                Nível de Compressão (Qualidade Efetiva: {dataSaver.getEffectiveQuality()})
              </label>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {(
                  [
                    { id: 'ultra_low', label: 'Ultra Econômico', weight: '~15-28 KB' },
                    { id: 'balanced', label: 'Equilibrado', weight: '~45-68 KB' },
                    { id: 'high', label: 'Qualidade', weight: '~180-350 KB' }
                  ] as const
                ).map(lvl => (
                  <button
                    key={lvl.id}
                    type="button"
                    onClick={() => handleChangeQualityLevel(lvl.id)}
                    className={`p-2 rounded-xl border text-center transition flex flex-col items-center justify-center cursor-pointer ${
                      dataSaverSettings.qualityLevel === lvl.id
                        ? 'bg-rose-50 border-rose-500 text-rose-900 shadow-2xs font-bold'
                        : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-100'
                    }`}
                  >
                    <span className="text-[11px]">{lvl.label}</span>
                    <span className="text-[9px] text-stone-500 mt-0.5 font-mono">{lvl.weight}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 4. Persistent Offline Queue Manager & Idempotent Sync */}
          <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-stone-900 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-rose-600" />
                <span>Fila Offline & Sincronização Idempotente</span>
              </span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-stone-200 text-stone-800 rounded-full">
                {offlineQueue.length} {offlineQueue.length === 1 ? 'evento pendente' : 'eventos pendentes'}
              </span>
            </div>

            <p className="text-[11px] text-stone-600 leading-relaxed">
              Suas ações são salvas com chaves de idempotência únicas localmente. Em caso de reconexão intermitente, retentativas nunca duplicam escritas no Firestore.
            </p>

            {offlineQueue.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <div className="max-h-28 overflow-y-auto space-y-1 pr-1">
                  {offlineQueue.map((item) => (
                    <div key={item.id} className="text-[10px] bg-white p-2 rounded-lg border border-stone-200 flex items-center justify-between font-mono text-stone-700">
                      <span className="font-semibold text-rose-700 uppercase">[{item.type}]</span>
                      <span>{new Date(item.enqueuedAt).toLocaleTimeString()}</span>
                      <span className="text-stone-400">idemp: {item.idempotencyKey ? item.idempotencyKey.substring(0, 14) + '...' : 'auto'}</span>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleManualSync}
                  disabled={isFlushing || !dataSaver.isOnline()}
                  className="w-full py-2 bg-stone-900 hover:bg-stone-800 disabled:bg-stone-300 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isFlushing ? 'animate-spin' : ''}`} />
                  <span>{isFlushing ? 'Sincronizando com Firestore...' : 'Sincronizar Fila Agora'}</span>
                </button>
              </div>
            )}
          </div>

          {/* 5. Network Simulator Sandbox (Technical Validation) */}
          <div className="p-3.5 bg-stone-900 text-stone-100 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold flex items-center gap-1.5 text-stone-100">
                <Radio className="w-3.5 h-3.5 text-rose-400" />
                <span>Simulador de Rede CPLP (Validação Técnica)</span>
              </span>
              <span className="text-[9px] font-mono bg-stone-800 text-rose-300 px-1.5 py-0.5 rounded border border-stone-700">
                DEV/TEST
              </span>
            </div>

            <p className="text-[10px] text-stone-300 leading-snug">
              Teste o comportamento da aplicação em diferentes cenários de infraestrutura móvel:
            </p>

            <div className="grid grid-cols-2 gap-1.5 text-[10px]">
              {(
                [
                  { id: 'real', label: 'Rede Real (Dispositivo)' },
                  { id: 'wifi_4g', label: 'WiFi / 4G Rápido' },
                  { id: '3g_balanced', label: '3G Médio (Luanda/Mindelo)' },
                  { id: '2g_edge', label: '2G Edge (< 150KB Target)' },
                  { id: 'offline_simulated', label: 'Offline Simulado' }
                ] as const
              ).map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => handleChangeNetworkMode(mode.id)}
                  className={`p-2 rounded-lg border text-left font-medium transition cursor-pointer ${
                    networkMode === mode.id
                      ? 'bg-rose-600 border-rose-500 text-white font-bold'
                      : 'bg-stone-800 border-stone-700 text-stone-300 hover:bg-stone-700'
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>

            {networkMode === 'offline_simulated' && (
              <div className="p-2 bg-rose-950/80 border border-rose-800/80 rounded-lg text-[10px] text-rose-200 flex items-center gap-1.5">
                <WifiOff className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span>Modo Offline simulado ativo. Todas as ações entrarão na fila persistente local com chave de idempotência.</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: MEMÓRIA RELACIONAL (Pessoa + Contexto + Comportamento + Reciprocidade + Resultado) */}
      {activeTab === 'memory' && (
        <div className="space-y-4">
          {/* Header & Paradigm Shift Statement */}
          <div className="bg-gradient-to-br from-stone-900 via-stone-850 to-stone-900 text-white p-5 rounded-2xl border border-stone-800 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold tracking-wider text-rose-400 flex items-center gap-1">
                <Brain className="w-3.5 h-3.5" />
                <span>Memória de Condições Relacionais</span>
              </span>
              <span className="text-[10px] font-mono bg-white/10 text-stone-200 px-2 py-0.5 rounded-full border border-white/20">
                {userMemory.totalConditionsAnalyzed} interações calibradas
              </span>
            </div>

            <h3 className="text-base font-serif font-bold text-stone-100 leading-snug">
              Que condições produzem uma conexão significativa para ti?
            </h3>

            <p className="text-xs text-stone-300 leading-relaxed font-sans">
              O ÉNós não reduz pessoas a listas de interesses estáticos. Construímos memória contínua sobre a dinâmica viva do encontro:
            </p>

            {/* 5-part Value Tuple Diagram */}
            <div className="grid grid-cols-5 gap-1 pt-1 text-center font-mono">
              <div className="bg-white/10 p-2 rounded-lg border border-white/10">
                <span className="text-[9px] text-rose-300 block font-sans font-bold">1. Pessoa</span>
                <span className="text-[10px] text-stone-200 truncate block mt-0.5">Ritmo</span>
              </div>
              <div className="bg-white/10 p-2 rounded-lg border border-white/10">
                <span className="text-[9px] text-purple-300 block font-sans font-bold">2. Contexto</span>
                <span className="text-[10px] text-stone-200 truncate block mt-0.5">Origem</span>
              </div>
              <div className="bg-white/10 p-2 rounded-lg border border-white/10">
                <span className="text-[9px] text-amber-300 block font-sans font-bold">3. Abertura</span>
                <span className="text-[10px] text-stone-200 truncate block mt-0.5">Tempo</span>
              </div>
              <div className="bg-white/10 p-2 rounded-lg border border-white/10">
                <span className="text-[9px] text-emerald-300 block font-sans font-bold">4. Troca</span>
                <span className="text-[10px] text-stone-200 truncate block mt-0.5">Turnos</span>
              </div>
              <div className="bg-rose-500/20 p-2 rounded-lg border border-rose-500/40">
                <span className="text-[9px] text-rose-300 block font-sans font-bold">5. Vínculo</span>
                <span className="text-[10px] text-rose-200 font-bold truncate block mt-0.5">MCR</span>
              </div>
            </div>
          </div>

          {/* Synthesized Personal Insight */}
          <div className="p-4 bg-white rounded-2xl border border-stone-200 shadow-2xs space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-rose-600 shrink-0" />
              <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wide">
                Diagnóstico de Fertilidade Relacional
              </h4>
            </div>

            <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs text-stone-800 leading-relaxed font-sans">
              "{userMemory.fertileConditions.synthesizedInsight}"
            </div>

            {/* Core Fertile Drivers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <div className="p-3 bg-rose-50/60 rounded-xl border border-rose-100 space-y-1">
                <span className="text-[11px] font-bold text-rose-900 flex items-center gap-1.5">
                  <HeartHandshake className="w-3.5 h-3.5 text-rose-600" />
                  <span>Ritmo Comunicativo Mais Ressonante</span>
                </span>
                <p className="text-xs text-rose-800 font-medium">
                  {userMemory.fertileConditions.topResonantStyles.map(s => 
                    s === 'reflective' ? 'Reflexivo (Profundidade & Pausa)' :
                    s === 'warm' ? 'Acolhedor (Empatia & Cuidado)' :
                    s === 'expressive' ? 'Expressivo (Vitalidade & Arte)' : 'Direto'
                  ).join(' e ')}
                </p>
                <span className="text-[10px] text-rose-700/80 block">
                  Preferência por profundidade: {userMemory.fertileConditions.optimalDepthPreference === 'deep' ? 'Diálogos Profundos' : 'Moderação inicial'}
                </span>
              </div>

              <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-100 space-y-1">
                <span className="text-[11px] font-bold text-purple-900 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-purple-600" />
                  <span>Contextos de Descoberta com Maior MCR</span>
                </span>
                <p className="text-xs text-purple-800 font-medium">
                  {userMemory.fertileConditions.thrivingContexts.topOrigins.map(o =>
                    o === 'SERENDIPITY' ? '✦ Descoberta Inesperada' :
                    o === 'CULTURAL_BRIDGE' ? 'Ponte Cultural Lusófona' :
                    o === 'VALUES_AFFINITY' ? 'Sintonia de Valores' : o
                  ).join(', ')}
                </p>
                <span className="text-[10px] text-purple-700/80 block">
                  Taxa de sucesso transnacional CPLP: {Math.round(userMemory.fertileConditions.thrivingContexts.crossBorderSuccessRate * 100)}%
                </span>
              </div>
            </div>
          </div>

          {/* Dynamic Reciprocity & Friction Awareness */}
          <div className="p-4 bg-white rounded-2xl border border-stone-200 shadow-2xs space-y-3">
            <h4 className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              <span>Dinâmica de Reciprocidade & Equilíbrio de Turnos</span>
            </h4>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2.5 bg-stone-50 rounded-xl border border-stone-200">
                <span className="text-stone-700 font-medium">Janela Ótima de Resposta:</span>
                <span className="font-bold text-stone-900">{userMemory.fertileConditions.reciprocityPace.idealResponseWindow}</span>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-stone-50 rounded-xl border border-stone-200">
                <span className="text-stone-700 font-medium">Equilíbrio de Diálogo:</span>
                <span className="font-bold text-stone-900">
                  {userMemory.fertileConditions.reciprocityPace.preferredTurnBalance === 'symmetric' ? 'Simétrico (50/50 em trocas de ideias)' : 'Fluido e orgânico'}
                </span>
              </div>

              <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl space-y-1.5">
                <span className="text-[11px] font-bold text-amber-900 block">
                  Gatilhos de Fricção Registados (O que desacelera a conexão para ti):
                </span>
                <ul className="text-[11px] text-amber-800 space-y-1 list-disc list-inside">
                  {userMemory.fertileConditions.frictionTriggers.map((trig, idx) => (
                    <li key={idx}>{trig}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
