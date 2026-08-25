import React, { useState } from 'react';
import { UserProfile, UserPreferences, PrivacySettings, CPLPCountryCode, RelationshipIntent } from '../types';
import { CPLP_COUNTRY_LIST, RELATIONSHIP_INTENTS_CONFIG, NORMALIZED_INTERESTS, CPLP_COUNTRIES } from '../constants';
import { compressImage } from '../utils/imageCompression';
import { Camera, Shield, Globe, Heart, Lock, UserCheck, Sparkles, Check, Link, Mail } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState<'profile' | 'preferences' | 'safety'>('profile');
  const [emailInput, setEmailInput] = useState('');
  const [linking, setLinking] = useState(false);
  const [linkedSuccess, setLinkedSuccess] = useState(false);
  const [editingBio, setEditingBio] = useState(profile.bio);

  const country = CPLP_COUNTRIES[profile.countryCode];

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

  return (
    <div className="flex-1 max-w-md mx-auto w-full p-4 pb-24 sm:pb-8">
      {/* User Mini Hero */}
      <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs mb-4 flex items-center gap-4">
        <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-rose-500 shrink-0 bg-stone-100">
          <img
            src={profile.profilePhoto}
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
          </div>
          <p className="text-xs text-stone-700 flex items-center gap-1 mt-0.5">
            <span>{country?.flag}</span>
            <span>{profile.cityName}, {country?.name}</span>
          </p>
        </div>
      </div>

      {/* Anonymous Account Link Prompt Banner */}
      {isAnonymous && !linkedSuccess && (
        <div className="bg-gradient-to-r from-rose-50 to-amber-50 border border-rose-200/80 rounded-2xl p-4 mb-4 shadow-2xs">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-rose-600 text-white shrink-0">
              <Lock className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <h4 className="text-xs font-bold text-stone-900">Salvar Conta Permanente</h4>
              <p className="text-[11px] text-stone-700 mt-0.5">
                Você entrou com acesso rápido. Vincule seu e-mail para não perder suas conversas e perfil.
              </p>
              <form onSubmit={handleLinkSubmit} className="mt-2.5 flex gap-2">
                <input
                  type="email"
                  value={emailInput}
                  onChange={e => setEmailInput(e.target.value)}
                  placeholder="Seu melhor e-mail..."
                  className="flex-1 px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-xs text-stone-900 focus:outline-none focus:ring-1 focus:ring-rose-500"
                />
                <button
                  type="submit"
                  disabled={linking || !emailInput.trim()}
                  className="px-3 py-1.5 bg-rose-600 text-white text-xs font-semibold rounded-lg hover:bg-rose-700 transition disabled:opacity-50 flex items-center gap-1"
                >
                  <Link className="w-3 h-3" />
                  {linking ? 'Salvando...' : 'Salvar'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {linkedSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-4 flex items-center gap-2 text-emerald-800 text-xs font-medium">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>Conta vinculada com sucesso! Seus dados estão salvos.</span>
        </div>
      )}

      {/* Sub-Tabs: Perfil, Preferências, Segurança */}
      <div className="grid grid-cols-3 gap-1 bg-stone-100 p-1 rounded-xl mb-4 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className={`py-2 rounded-lg transition ${
            activeTab === 'profile' ? 'bg-white text-stone-900 shadow-2xs' : 'text-stone-700 hover:text-stone-900'
          }`}
        >
          Meu Perfil
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('preferences')}
          className={`py-2 rounded-lg transition ${
            activeTab === 'preferences' ? 'bg-white text-stone-900 shadow-2xs' : 'text-stone-700 hover:text-stone-900'
          }`}
        >
          Preferências
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('safety')}
          className={`py-2 rounded-lg transition ${
            activeTab === 'safety' ? 'bg-white text-stone-900 shadow-2xs' : 'text-stone-700 hover:text-stone-900'
          }`}
        >
          Segurança
        </button>
      </div>

      {/* Tab: MEU PERFIL */}
      {activeTab === 'profile' && (
        <div className="space-y-4 bg-white p-4 rounded-2xl border border-stone-200 shadow-2xs">
          <div>
            <label className="block text-xs font-medium text-stone-700 uppercase tracking-wider mb-1">
              Biografia
            </label>
            <textarea
              rows={3}
              value={editingBio}
              onChange={e => setEditingBio(e.target.value)}
              onBlur={() => onUpdateProfile({ bio: editingBio })}
              className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:bg-white focus:ring-2 focus:ring-rose-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-700 uppercase tracking-wider mb-1.5">
              Intenção de Relacionamento
            </label>
            <div className="grid grid-cols-1 gap-1.5">
              {RELATIONSHIP_INTENTS_CONFIG.map(intent => (
                <button
                  key={intent.id}
                  type="button"
                  onClick={() => onUpdateProfile({ intent: intent.id })}
                  className={`p-2.5 rounded-xl border text-left text-xs flex items-center justify-between transition ${
                    profile.intent === intent.id
                      ? 'border-rose-600 bg-rose-50/70 text-stone-900 font-semibold'
                      : 'border-stone-200 bg-stone-50 text-stone-700'
                  }`}
                >
                  <span>{intent.label}</span>
                  {profile.intent === intent.id && <Check className="w-4 h-4 text-rose-600" />}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-700 uppercase tracking-wider mb-1.5">
              Meus Interesses ({profile.interests.length})
            </label>
            <div className="flex flex-wrap gap-1">
              {NORMALIZED_INTERESTS.map(int => {
                const isSelected = profile.interests.includes(int);
                return (
                  <button
                    key={int}
                    type="button"
                    onClick={() => {
                      const updated = isSelected
                        ? profile.interests.filter(i => i !== int)
                        : [...profile.interests, int];
                      onUpdateProfile({ interests: updated });
                    }}
                    className={`text-[11px] px-2.5 py-1 rounded-full border transition ${
                      isSelected
                        ? 'border-rose-600 bg-rose-600 text-white'
                        : 'border-stone-200 bg-stone-50 text-stone-700 hover:border-stone-300'
                    }`}
                  >
                    {int}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tab: PREFERÊNCIAS */}
      {activeTab === 'preferences' && (
        <div className="space-y-4 bg-white p-4 rounded-2xl border border-stone-200 shadow-2xs">
          <div className="flex items-center justify-between pb-3 border-b border-stone-100">
            <div>
              <h4 className="text-xs font-bold text-stone-900">Conexão Intercultural Lusófona</h4>
              <p className="text-[11px] text-stone-700">Ver pessoas de outros países da CPLP</p>
            </div>
            <input
              type="checkbox"
              checked={preferences.crossCultural}
              onChange={e => onUpdatePreferences({ crossCultural: e.target.checked })}
              className="w-5 h-5 accent-rose-600 cursor-pointer rounded"
            />
          </div>

          <div className="flex items-center justify-between pb-3 border-b border-stone-100">
            <div>
              <h4 className="text-xs font-bold text-stone-900">Descoberta Ativada</h4>
              <p className="text-[11px] text-stone-700">Permitir que outros encontrem seu perfil</p>
            </div>
            <input
              type="checkbox"
              checked={preferences.discoveryEnabled}
              onChange={e => onUpdatePreferences({ discoveryEnabled: e.target.checked })}
              className="w-5 h-5 accent-rose-600 cursor-pointer rounded"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-700 uppercase tracking-wider mb-2">
              Países Lusófonos de Preferência
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {CPLP_COUNTRY_LIST.map(c => {
                const isSelected = preferences.countries.includes(c.code);
                return (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => {
                      const updated = isSelected
                        ? preferences.countries.filter(code => code !== c.code)
                        : [...preferences.countries, c.code];
                      onUpdatePreferences({ countries: updated });
                    }}
                    className={`p-2 rounded-xl border text-center transition flex flex-col items-center ${
                      isSelected
                        ? 'border-rose-600 bg-rose-50 text-rose-900 font-semibold'
                        : 'border-stone-200 bg-stone-50 text-stone-700'
                    }`}
                  >
                    <span className="text-lg">{c.flag}</span>
                    <span className="text-[10px] truncate w-full">{c.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tab: SEGURANÇA */}
      {activeTab === 'safety' && (
        <div className="space-y-4 bg-white p-4 rounded-2xl border border-stone-200 shadow-2xs">
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

          <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs text-stone-700">
            <h5 className="font-semibold text-stone-900 mb-1 flex items-center gap-1">
              <Shield className="w-3.5 h-3.5 text-rose-600" />
              Diretrizes de Segurança CPLP
            </h5>
            <p className="text-[11px] leading-relaxed">
              Respeito mútuo é o pilar da comunidade ÉNós. Bloqueios e denúncias são processados instantaneamente.
            </p>
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
    </div>
  );
};
