import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CPLP_COUNTRY_LIST, RELATIONSHIP_INTENTS_CONFIG, NORMALIZED_INTERESTS, CPLP_COUNTRIES, DEMO_LUSOFONE_PROFILES } from '../constants';
import { CPLPCountryCode, RelationshipIntent, UserProfile } from '../types';
import { processProfileMedia } from '../services/media';
import { ClientAiAdapter } from '../services/aiAdapter';
import { ColdStartEngine } from '../services/coldStart';
import { Sparkles, MapPin, HeartHandshake, Heart, Users, Globe, ArrowRight, ArrowLeft, Camera, Check, Shield } from 'lucide-react';

interface OnboardingProps {
  uid: string;
  onComplete: (profile: UserProfile) => void;
  onOpenKeypad?: () => void;
}

export const Onboarding: React.FC<OnboardingProps> = ({ uid, onComplete, onOpenKeypad }) => {
  const [step, setStep] = useState<number>(1);
  const [displayName, setDisplayName] = useState('');
  const [age, setAge] = useState<number>(24);
  const [countryCode, setCountryCode] = useState<CPLPCountryCode>('AO');
  const [cityName, setCityName] = useState('Luanda');
  const [intent, setIntent] = useState<RelationshipIntent>('serious');
  const [interests, setInterests] = useState<string[]>([]);
  const [bio, setBio] = useState('');
  const [profilePhoto, setProfilePhoto] = useState(
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=700&auto=format&fit=crop&q=80'
  );
  const [isGeneratingBio, setIsGeneratingBio] = useState(false);

  const selectedCountry = CPLP_COUNTRIES[countryCode];
  const aiAdapter = ClientAiAdapter.getInstance();
  const coldStart = ColdStartEngine.getInstance();

  // Pre-calculate candidate state in memory during onboarding without downloading media
  useEffect(() => {
    if (step >= 2) {
      const tempProfile: UserProfile = {
        uid,
        displayName: displayName || 'Amigo',
        age,
        gender: 'man',
        countryCode,
        countryName: selectedCountry.name,
        cityName,
        intent,
        interests,
        bio,
        profilePhoto,
        visibility: 'public',
        verificationStatus: 'verified',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastActive: Date.now(),
        online: true
      };
      coldStart.prepareColdStartFeed(DEMO_LUSOFONE_PROFILES, tempProfile);
    }
  }, [step, countryCode, intent, age]);

  const handleCountryChange = (code: CPLPCountryCode) => {
    setCountryCode(code);
    const country = CPLP_COUNTRIES[code];
    if (country && country.defaultCities.length > 0) {
      setCityName(country.defaultCities[0]);
    }
  };

  const toggleInterest = (interest: string) => {
    if (interests.includes(interest)) {
      setInterests(interests.filter((i) => i !== interest));
    } else {
      if (interests.length < 6) {
        setInterests([...interests, interest]);
      }
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const { dataUrl } = await processProfileMedia(file);
        setProfilePhoto(dataUrl);
      } catch (err) {
        console.error('Error processing media:', err);
      }
    }
  };

  // 4.15 & 4.16: AIProfileAssistant contract call
  const generateAIBio = async () => {
    setIsGeneratingBio(true);
    try {
      const generated = await aiAdapter.generateBio({
        interests,
        intent,
        countryName: selectedCountry.name,
        cityName
      });
      if (generated) {
        setBio(generated.trim());
      }
    } catch {
      setBio(`Natural de ${cityName}, ${selectedCountry.name}. Gosto de conexões verdadeiras e conversas com alma.`);
    } finally {
      setIsGeneratingBio(false);
    }
  };

  const handleFinish = () => {
    const profile: UserProfile = {
      uid,
      displayName: displayName.trim() || 'Amigo Lusófono',
      age: Number(age) || 24,
      gender: 'man',
      countryCode,
      countryName: selectedCountry.name,
      cityName: cityName.trim() || selectedCountry.capital,
      intent,
      interests: interests.length >= 1 ? interests : [NORMALIZED_INTERESTS[0], NORMALIZED_INTERESTS[1]],
      bio: bio.trim() || `Olá! Sou de ${cityName}, ${selectedCountry.name}. Aberto a novas conexões sinceras na nossa comunidade lusófona.`,
      profilePhoto,
      visibility: 'public',
      verificationStatus: 'verified',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastActive: Date.now(),
      online: true,
    };
    onComplete(profile);
  };

  const intentIcons: Record<RelationshipIntent, React.ReactNode> = {
    serious: <HeartHandshake className="w-5 h-5 text-rose-500" />,
    dating: <Heart className="w-5 h-5 text-pink-500" />,
    marriage: <Sparkles className="w-5 h-5 text-amber-500" />,
    friendship: <Users className="w-5 h-5 text-emerald-500" />,
    meet_people: <Globe className="w-5 h-5 text-blue-500" />,
  };

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col justify-between p-4 sm:p-6 max-w-lg mx-auto">
      {/* Header / Progress */}
      <div>
        <div className="flex items-center justify-between pt-2 pb-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              id="btn-disguised-founder-onboarding"
              onClick={onOpenKeypad}
              className="w-8 h-8 rounded-full bg-rose-600 text-white font-bold flex items-center justify-center text-sm shadow-sm cursor-pointer active:scale-95 transition"
              title="ÉNós"
            >
              ÉN
            </button>
            <div>
              <h1 className="font-semibold text-stone-900 text-base leading-tight">ÉNós</h1>
              <p className="text-xs text-stone-700">CPLP Relacionamentos</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onOpenKeypad && (
              <button
                type="button"
                id="btn-admin-keypad-onboarding"
                onClick={onOpenKeypad}
                className="flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium text-stone-600 bg-stone-100 hover:bg-stone-200 hover:text-stone-900 border border-stone-200 transition cursor-pointer active:scale-95"
                title="Acesso Admin"
              >
                <Shield className="w-3.5 h-3.5 text-stone-500" />
                <span>Admin</span>
              </button>
            )}
            <span className="text-xs font-medium px-2.5 py-1 bg-stone-200 text-stone-700 rounded-full">
              Etapa {step} de 4
            </span>
          </div>
        </div>

        {/* Step indicator bar */}
        <div className="w-full bg-stone-200 h-1.5 rounded-full overflow-hidden mb-6">
          <motion.div
            className="h-full bg-rose-600"
            animate={{ width: `${(step / 4) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Dynamic Content */}
      <div className="flex-1 flex flex-col justify-center my-auto">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div>
                <h2 className="text-2xl font-bold text-stone-900 tracking-tight">Como podemos chamar você?</h2>
                <p className="text-sm text-stone-700 mt-1">Seu primeiro nome é suficiente para começar.</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-stone-700 uppercase tracking-wider mb-1.5">
                    Seu Nome
                  </label>
                  <input
                    id="input-display-name"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Ex: Marta, Tiago, Camila..."
                    className="w-full px-4 py-3 bg-white border border-stone-300 rounded-xl text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 text-lg shadow-xs"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-700 uppercase tracking-wider mb-1.5">
                    Sua Idade: <span className="text-rose-600 font-bold">{age} anos</span>
                  </label>
                  <input
                    id="input-age-range"
                    type="range"
                    min="18"
                    max="75"
                    value={age}
                    onChange={(e) => setAge(Number(e.target.value))}
                    className="w-full accent-rose-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-stone-700 mt-1">
                    <span>18</span>
                    <span>45</span>
                    <span>75+</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div>
                <h2 className="text-2xl font-bold text-stone-900 tracking-tight">Onde você está localizado?</h2>
                <p className="text-sm text-stone-700 mt-1">Selecione seu país e cidade na comunidade lusófona.</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-stone-700 uppercase tracking-wider mb-1.5">
                    País CPLP
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {CPLP_COUNTRY_LIST.map((c) => (
                      <button
                        key={c.code}
                        type="button"
                        id={`country-select-${c.code}`}
                        onClick={() => handleCountryChange(c.code)}
                        className={`p-3 rounded-xl border text-left transition flex flex-col items-center justify-center gap-1 ${
                          countryCode === c.code
                            ? 'border-rose-600 bg-rose-50 text-rose-900 ring-1 ring-rose-600'
                            : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300'
                        }`}
                      >
                        <span className="text-2xl">{c.flag}</span>
                        <span className="text-xs font-semibold text-center truncate w-full">{c.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-700 uppercase tracking-wider mb-1.5">
                    Cidade
                  </label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 text-stone-400 absolute left-3 top-3.5" />
                    <input
                      id="input-city-name"
                      type="text"
                      list="cplp-cities-list"
                      value={cityName}
                      onChange={(e) => setCityName(e.target.value)}
                      placeholder="Nome da sua cidade..."
                      className="w-full pl-9 pr-4 py-3 bg-white border border-stone-300 rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm shadow-xs"
                    />
                    <datalist id="cplp-cities-list">
                      {selectedCountry.defaultCities.map((city) => (
                        <option key={city} value={city} />
                      ))}
                    </datalist>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-5"
            >
              <div>
                <h2 className="text-2xl font-bold text-stone-900 tracking-tight">Qual é a sua intenção principal?</h2>
                <p className="text-sm text-stone-700 mt-1">Conecte-se com quem procura o mesmo objetivo.</p>
              </div>

              <div className="space-y-2.5">
                {RELATIONSHIP_INTENTS_CONFIG.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    id={`intent-select-${item.id}`}
                    onClick={() => setIntent(item.id)}
                    className={`w-full p-4 rounded-xl border text-left transition flex items-center gap-3.5 ${
                      intent === item.id
                        ? 'border-rose-600 bg-rose-50/70 text-stone-900 ring-1 ring-rose-600 shadow-xs'
                        : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300'
                    }`}
                  >
                    <div className="p-2.5 rounded-lg bg-stone-100/80">{intentIcons[item.id]}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-stone-900 text-sm">{item.label}</div>
                      <div className="text-xs text-stone-700 mt-0.5">{item.description}</div>
                    </div>
                    {intent === item.id && <Check className="w-5 h-5 text-rose-600 shrink-0" />}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-5"
            >
              <div>
                <h2 className="text-2xl font-bold text-stone-900 tracking-tight">Interesses e Foto</h2>
                <p className="text-sm text-stone-700 mt-1">
                  Escolha pelo menos 3 interesses e adicione sua foto para destaque.
                </p>
              </div>

              {/* Photo selector */}
              <div className="flex items-center gap-4 bg-white p-3.5 rounded-xl border border-stone-200">
                <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-rose-500 shrink-0 bg-stone-100">
                  <img
                    src={profilePhoto}
                    alt="Prévia de perfil"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <label
                    htmlFor="photo-upload-input"
                    className="absolute inset-0 bg-black/40 flex items-center justify-center cursor-pointer text-white hover:bg-black/50 transition"
                  >
                    <Camera className="w-5 h-5" />
                  </label>
                  <input
                    id="photo-upload-input"
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </div>
                <div className="flex-1">
                  <label
                    htmlFor="photo-upload-input"
                    className="text-xs font-semibold text-rose-600 hover:text-rose-700 cursor-pointer block"
                  >
                    Trocar Foto de Perfil
                  </label>
                  <p className="text-[11px] text-stone-700 mt-0.5">
                    Compressão ultraleve automática (WebP otimizado).
                  </p>
                </div>
              </div>

              {/* Interests chips */}
              <div>
                <label className="block text-xs font-medium text-stone-700 uppercase tracking-wider mb-2">
                  Selecione seus Interesses ({interests.length}/6 selecionados)
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto pr-1">
                  {NORMALIZED_INTERESTS.map((int) => {
                    const isSelected = interests.includes(int);
                    return (
                      <button
                        key={int}
                        type="button"
                        onClick={() => toggleInterest(int)}
                        className={`text-xs font-medium px-3 py-1.5 rounded-full border transition whitespace-nowrap ${
                          isSelected
                            ? 'border-rose-600 bg-rose-600 text-white'
                            : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300'
                        }`}
                      >
                        {int}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Bio & AI Assist */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-stone-700 uppercase tracking-wider">
                    Bio Curta (Opcional)
                  </label>
                  <button
                    type="button"
                    onClick={generateAIBio}
                    disabled={isGeneratingBio}
                    className="text-xs text-rose-600 font-semibold hover:text-rose-700 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {isGeneratingBio ? 'Gerando...' : 'Sugerir com IA'}
                  </button>
                </div>
                <textarea
                  id="input-bio"
                  rows={2}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Escreva algumas palavras sobre você ou use a sugestão..."
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-stone-900 placeholder-stone-400 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500 shadow-xs"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation Buttons */}
      <div className="pt-6 flex items-center gap-3">
        {step > 1 && (
          <button
            type="button"
            id="btn-onboarding-back"
            onClick={() => setStep(step - 1)}
            className="px-4 py-3.5 rounded-xl border border-stone-200 bg-white text-stone-700 font-medium hover:bg-stone-50 transition flex items-center gap-1.5 text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </button>
        )}

        {step < 4 ? (
          <button
            type="button"
            id="btn-onboarding-next"
            onClick={() => {
              if (step === 1 && !displayName.trim()) {
                setDisplayName('Amigo Lusófono');
              }
              setStep(step + 1);
            }}
            className="flex-1 py-3.5 px-6 rounded-xl bg-rose-600 text-white font-semibold hover:bg-rose-700 transition flex items-center justify-center gap-2 text-sm shadow-sm"
          >
            Continuar
            <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            id="btn-onboarding-finish"
            onClick={handleFinish}
            className="flex-1 py-3.5 px-6 rounded-xl bg-rose-600 text-white font-semibold hover:bg-rose-700 transition flex items-center justify-center gap-2 text-sm shadow-sm"
          >
            Entrar no ÉNós
            <Check className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
