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
import { dataSaver } from '../services/dataSaverService';
import { connectionGraph } from '../services/connectionGraph';
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
  CheckCircle2
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
  const [activeTab, setActiveTab] = useState<'profile' | 'preferences' | 'safety' | 'dataSaver'>('profile');
  const [emailInput, setEmailInput] = useState('');
  const [linking, setLinking] = useState(false);
  const [linkedSuccess, setLinkedSuccess] = useState(false);
  const [editingBio, setEditingBio] = useState(profile.bio);

  const [dataSaverSettings, setDataSaverSettings] = useState<DataSaverSettings>(() => dataSaver.getSettings());
  const [mcrMetrics, setMcrMetrics] = useState(() => connectionGraph.calculateMCRMetrics());

  const country = CPLP_COUNTRIES[profile.countryCode];
  const myTrustEvaluation = trustGraph.evaluateTrust(profile);

  useEffect(() => {
    setMcrMetrics(connectionGraph.calculateMCRMetrics());
  }, []);

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

  return (
    <div className="flex-1 max-w-md mx-auto w-full p-4 pb-24 sm:pb-8 space-y-4">
      {/* User Mini Hero */}
      <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs flex items-center gap-4">
        <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-rose-500 shrink-0 bg-stone-100">
          <img
            src={dataSaver.getOptimizedImageUrl(profile.profilePhoto, true)}
            alt={profile.displayName}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
          <label
            htmlFor="profile-photo-upload"
            className="absolute inset-0 bg-black/40 flex items-center justify-center cursor-pointer text-white hover:bg-black/50 transition"
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
            {myTrustEvaluation.identityScore >= 0.85 && (
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
              {myTrustEvaluation.badges.map((b, idx) => (
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
          <div className="p-3 bg-gradient-to-r from-amber-50 to-rose-50 rounded-xl border border-amber-200/70">
            <div className="flex items-center gap-2 mb-1 text-xs font-bold text-amber-950">
              <Wifi className="w-4 h-4 text-amber-600" />
              <span>Modo Economia de Dados (Conexão CPLP)</span>
            </div>
            <p className="text-[11px] text-stone-700 leading-relaxed">
              Otimizado para redes 2G/3G e consumo consciente de dados em Luanda, Maputo, Mindelo, Bissau e além.
            </p>
          </div>

          <div className="flex items-center justify-between pb-3 border-b border-stone-100">
            <div>
              <h4 className="text-xs font-bold text-stone-900">Ativar Economia de Dados</h4>
              <p className="text-[11px] text-stone-700">Carregar fotos comprimidas e reduzir consumo em até 70%</p>
            </div>
            <input
              type="checkbox"
              checked={dataSaverSettings.enabled}
              onChange={e => handleToggleDataSaver(e.target.checked)}
              className="w-5 h-5 accent-rose-600 cursor-pointer rounded"
            />
          </div>

          {dataSaverSettings.enabled && (
            <div className="space-y-3 pt-1">
              <div>
                <label className="text-xs font-bold text-stone-900 block mb-1">Nível de Compressão</label>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {(['ultra_low', 'balanced', 'high'] as const).map(lvl => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => handleChangeQualityLevel(lvl)}
                      className={`p-2 rounded-xl border text-center transition font-semibold ${
                        dataSaverSettings.qualityLevel === lvl
                          ? 'bg-rose-50 border-rose-500 text-rose-700'
                          : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
                      }`}
                    >
                      {lvl === 'ultra_low' ? 'Ultra Econômico' : lvl === 'balanced' ? 'Equilibrado' : 'Qualidade'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs text-stone-700 space-y-1">
            <span className="font-semibold text-stone-900 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-emerald-600" />
              <span>Sincronização Offline Automática</span>
            </span>
            <p className="text-[11px]">
              Seus likes, aproximações e mensagens são guardados localmente e sincronizados de forma transparente assim que o sinal voltar.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
