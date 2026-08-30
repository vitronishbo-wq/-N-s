import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db, signInAnonymously, onAuthStateChanged, doc, getDoc, setDoc, updateDoc, deleteDoc } from './firebase/config';
import {
  UserProfile,
  UserPreferences,
  PrivacySettings,
  InteractionSignals,
  Conversation,
  ChatMessage,
  AdminUser,
  CPLPCountryCode,
  DiscoveryCandidate
} from './types';
import { DEMO_LUSOFONE_PROFILES } from './constants';
import { getInitialSignals, recordSignalEvent } from './services/signals';
import { DiscoveryAppService } from './services/discoveryService';
import { connectionGraph } from './services/connectionGraph';
import { relationalMemory } from './services/relationalMemory';
import { Onboarding } from './components/Onboarding';
import { Discover } from './components/Discover';
import { Nearby } from './components/Nearby';
import { Connections } from './components/Connections';
import { Conversations } from './components/Conversations';
import { Profile } from './components/Profile';
import { AdminKeypadModal } from './components/AdminKeypadModal';
import { AdminPanel } from './components/AdminPanel';
import { GmailModal } from './components/GmailModal';
import { Compass, MapPin, HeartHandshake, MessageCircle, User as UserIcon, Shield, Mail } from 'lucide-react';

// Helper to get or create a stable persistent device UID
function getOrCreateDeviceId(): string {
  try {
    let stored = localStorage.getItem('enos_cplp_uid');
    if (!stored) {
      stored = 'user_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
      localStorage.setItem('enos_cplp_uid', stored);
    }
    return stored;
  } catch {
    return 'user_' + Math.random().toString(36).substring(2, 9);
  }
}

export default function App() {
  const [uid, setUid] = useState<string>(() => getOrCreateDeviceId());
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [loading, setLoading] = useState(true);

  // App Navigation State (5 Tabs: 'discover' | 'nearby' | 'connections' | 'chat' | 'me')
  const [currentTab, setCurrentTab] = useState<'discover' | 'nearby' | 'connections' | 'chat' | 'me'>('discover');

  // Tab epoch tracking to enforce complete discard of inactive/temporary state (filters, search queries, drafts)
  const [tabEpochs, setTabEpochs] = useState<Record<string, number>>({
    discover: 0,
    nearby: 0,
    connections: 0,
    chat: 0,
    me: 0
  });

  // Dedicated cleanup & navigation mechanism for pristine transitions
  const handleTabChange = useCallback((nextTab: 'discover' | 'nearby' | 'connections' | 'chat' | 'me') => {
    // 1. Force cleanup of open floating overlays, sheets and admin panels
    setIsKeypadOpen(false);
    setIsGmailOpen(false);
    setGmailComposeProps({});

    // 2. Increment target tab epoch to mount the newly active component cleanly without stale temporary filters/searches
    setTabEpochs(prev => ({
      ...prev,
      [nextTab]: (prev[nextTab] || 0) + 1
    }));

    // 3. Update current tab
    setCurrentTab(nextTab);
  }, []);

  // Admin & Keypad State
  const [isKeypadOpen, setIsKeypadOpen] = useState(false);
  const [isGmailOpen, setIsGmailOpen] = useState(false);
  const [gmailComposeProps, setGmailComposeProps] = useState<{
    recipient?: string;
    subject?: string;
    body?: string;
  }>({});
  const [adminSession, setAdminSession] = useState<AdminUser | null>(null);
  const [dynamicAdmins, setDynamicAdmins] = useState<AdminUser[]>(() => {
    try {
      const cached = localStorage.getItem('enos_dynamic_admins');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  // User Domain Entities (Separated: Profile, Preferences, Privacy, Signals)
  const [profile, setProfile] = useState<UserProfile | null>(() => {
    try {
      const cached = localStorage.getItem('enos_profile');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  const [preferences, setPreferences] = useState<UserPreferences | null>(() => {
    try {
      const cached = localStorage.getItem('enos_preferences');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  const [privacy, setPrivacy] = useState<PrivacySettings | null>(() => {
    try {
      const cached = localStorage.getItem('enos_privacy');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  const [signals, setSignals] = useState<InteractionSignals>(() => getInitialSignals(uid));

  // Candidate Pool
  const [discoverProfiles, setDiscoverProfiles] = useState<UserProfile[]>(DEMO_LUSOFONE_PROFILES);

  const [conversations, setConversations] = useState<Conversation[]>(() => {
    try {
      const cached = localStorage.getItem('enos_conversations');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const [messages, setMessages] = useState<{ [convoId: string]: ChatMessage[] }>(() => {
    try {
      const cached = localStorage.getItem('enos_messages');
      return cached ? JSON.parse(cached) : {};
    } catch {
      return {};
    }
  });

  // 1. Initialize Auth & Load Separated Domains (2.3 & 2.4)
  useEffect(() => {
    let isMounted = true;

    // Safety timeout: Ensure loading screen unlocks within 1200ms even if network/firebase auth is delayed
    const safetyTimer = setTimeout(() => {
      if (isMounted) {
        setLoading(false);
      }
    }, 1200);

    const initAuthAndData = async () => {
      // Check for previously linked account
      const storedAccountInfo = localStorage.getItem('enos_linked_account');
      if (storedAccountInfo) {
        try {
          const acc = JSON.parse(storedAccountInfo);
          if (acc.email && isMounted) {
            setIsAnonymous(false);
          }
        } catch {}
      }

      // Listen for authenticated user state
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (!user) {
          if (isMounted) setLoading(false);
          return;
        }

        const activeUid = user.uid;
        if (isMounted) {
          setUid(activeUid);
          setIsAnonymous(user.isAnonymous);
          setSignals(getInitialSignals(activeUid));
        }

        // Align local profile UID to active authenticated UID
        try {
          const localProfileStr = localStorage.getItem('enos_profile');
          if (localProfileStr) {
            const localP = JSON.parse(localProfileStr) as UserProfile;
            if (localP && localP.uid !== activeUid) {
              localP.uid = activeUid;
              localStorage.setItem('enos_profile', JSON.stringify(localP));
              if (isMounted) setProfile(localP);
            }
          }
        } catch {}

        try {
          const profileDoc = await getDoc(doc(db, 'profiles', activeUid));
          if (profileDoc.exists() && isMounted) {
            const data = profileDoc.data() as UserProfile;
            setProfile(data);
            localStorage.setItem('enos_profile', JSON.stringify(data));
          }

          const prefDoc = await getDoc(doc(db, 'preferences', activeUid));
          if (prefDoc.exists() && isMounted) {
            const data = prefDoc.data() as UserPreferences;
            setPreferences(data);
            localStorage.setItem('enos_preferences', JSON.stringify(data));
          }

          const privDoc = await getDoc(doc(db, 'privacy', activeUid));
          if (privDoc.exists() && isMounted) {
            const data = privDoc.data() as PrivacySettings;
            setPrivacy(data);
            localStorage.setItem('enos_privacy', JSON.stringify(data));
          }

          // Hydrate real Connection Graph telemetry & outcome learnings from Firestore
          await connectionGraph.syncWithFirestore(activeUid);
          await relationalMemory.syncWithFirestore(activeUid);
        } catch (err) {
          console.info('Using fast local cached state:', err);
        } finally {
          if (isMounted) setLoading(false);
        }
      });

      // Ensure anonymous sign in occurs in background if not already logged in
      if (!auth.currentUser) {
        signInAnonymously(auth).catch((err) => {
          console.info('Anonymous sign in note:', err);
          if (isMounted) setLoading(false);
        });
      }

      return unsubscribe;
    };

    const cleanupPromise = initAuthAndData();

    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
      cleanupPromise.then(unsub => {
        if (typeof unsub === 'function') unsub();
      });
    };
  }, []);

  // 2. Finish Onboarding & Save to Firestore & Local Storage (2.6: Candidates already prepared)
  const handleCompleteOnboarding = async (newProfile: UserProfile) => {
    const activeUid = auth.currentUser?.uid || uid || newProfile.uid;
    const finalProfile: UserProfile = { ...newProfile, uid: activeUid };
    setProfile(finalProfile);
    try {
      localStorage.setItem('enos_profile', JSON.stringify(finalProfile));
    } catch {}

    const initialPrefs: UserPreferences = {
      uid: activeUid,
      minAge: 18,
      maxAge: 70,
      genders: ['man', 'woman', 'non_binary', 'other'],
      countries: ['AO', 'BR', 'CV', 'GW', 'GQ', 'MZ', 'PT', 'ST', 'TL'],
      relationshipIntents: [finalProfile.intent],
      crossCultural: true,
      verifiedOnly: false,
      discoveryEnabled: true
    };

    const initialPrivacy: PrivacySettings = {
      uid: activeUid,
      shareApproximateLocationOnly: false,
      showAge: true,
      showOnlineStatus: true,
      visibility: 'public'
    };

    setPreferences(initialPrefs);
    setPrivacy(initialPrivacy);

    try {
      localStorage.setItem('enos_preferences', JSON.stringify(initialPrefs));
      localStorage.setItem('enos_privacy', JSON.stringify(initialPrivacy));
    } catch {}

    try {
      await setDoc(doc(db, 'profiles', activeUid), finalProfile);
      await setDoc(doc(db, 'preferences', activeUid), initialPrefs);
      await setDoc(doc(db, 'privacy', activeUid), initialPrivacy);
    } catch (e) {
      console.info('Firestore save note (saved locally):', e);
    }
  };

  // 2.1 & 2.5: User Interactions delegated directly to DiscoveryAppService
  const handleLike = async (targetCandidate: DiscoveryCandidate, customContextText?: string, openChat: boolean = false) => {
    if (!profile || !uid) return;

    const discoveryService = DiscoveryAppService.getInstance();
    const result = await discoveryService.processLikeAction(
      targetCandidate,
      profile,
      signals,
      (newConvo, initialMsg) => {
        setConversations(prev => {
          const updated = [newConvo, ...prev.filter(c => c.id !== newConvo.id)];
          try { localStorage.setItem('enos_conversations', JSON.stringify(updated)); } catch {}
          return updated;
        });

        setMessages(prev => {
          const updated = {
            ...prev,
            [newConvo.id]: [initialMsg]
          };
          try { localStorage.setItem('enos_messages', JSON.stringify(updated)); } catch {}
          return updated;
        });

        if (openChat) {
          setCurrentTab('conversations');
        }
      },
      customContextText
    );

    setSignals(result.updatedSignals);
  };

  const handlePass = (targetCandidate: DiscoveryCandidate) => {
    const discoveryService = DiscoveryAppService.getInstance();
    const updated = discoveryService.processPassAction(targetCandidate, signals);
    setSignals(updated);
  };

  const handleRecordSeen = (targetUid: string) => {
    const updated = recordSignalEvent(signals, { type: 'seen', targetUid });
    setSignals(updated);
  };

  const handleReport = (targetCandidate: DiscoveryCandidate) => {
    alert(`O perfil de ${targetCandidate.profile.displayName} foi sinalizado para a moderação e temporariamente ocultado.`);
    const discoveryService = DiscoveryAppService.getInstance();
    const updated = discoveryService.processReportAction(targetCandidate, signals);
    setSignals(updated);
  };

  const handleBlockUser = (targetUid: string) => {
    const updated = recordSignalEvent(signals, { type: 'block', targetUid });
    setSignals(updated);
    setConversations(prev => {
      const filtered = prev.filter(c => !c.participantUids.includes(targetUid));
      try { localStorage.setItem('enos_conversations', JSON.stringify(filtered)); } catch {}
      return filtered;
    });
  };

  const handleSendMessage = (convoId: string, text: string, imageUrl?: string) => {
    if (!uid) return;
    const newMsg: ChatMessage = {
      id: 'msg_' + Date.now(),
      conversationId: convoId,
      senderId: uid,
      text,
      imageUrl,
      createdAt: Date.now(),
      status: 'sent'
    };

    setMessages(prev => {
      const updated = {
        ...prev,
        [convoId]: [...(prev[convoId] || []), newMsg]
      };
      try { localStorage.setItem('enos_messages', JSON.stringify(updated)); } catch {}
      return updated;
    });

    setConversations(prev => {
      const updated = prev.map(c =>
        c.id === convoId
          ? {
              ...c,
              lastMessageText: text || 'Foto enviada',
              lastMessageTimestamp: Date.now(),
              lastMessageSenderId: uid
            }
          : c
      );
      try { localStorage.setItem('enos_conversations', JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const handleUpdateProfile = async (updated: Partial<UserProfile>) => {
    if (!profile || !uid) return;
    const newP = { ...profile, ...updated, updatedAt: Date.now() };
    setProfile(newP);
    try { localStorage.setItem('enos_profile', JSON.stringify(newP)); } catch {}
    try {
      await setDoc(doc(db, 'profiles', uid), newP);
    } catch (e) {
      console.info('Firestore profile sync note:', e);
    }
  };

  const handleUpdatePreferences = async (updated: Partial<UserPreferences>) => {
    if (!preferences || !uid) return;
    const newPrefs = { ...preferences, ...updated };
    setPreferences(newPrefs);
    try { localStorage.setItem('enos_preferences', JSON.stringify(newPrefs)); } catch {}
    try {
      await setDoc(doc(db, 'preferences', uid), newPrefs);
    } catch (e) {
      console.info('Firestore preferences sync note:', e);
    }
  };

  const handleUpdatePrivacy = async (updated: Partial<PrivacySettings>) => {
    if (!privacy || !uid) return;
    const newPriv = { ...privacy, ...updated };
    setPrivacy(newPriv);
    try { localStorage.setItem('enos_privacy', JSON.stringify(newPriv)); } catch {}
    try {
      await setDoc(doc(db, 'privacy', uid), newPriv);
    } catch (e) {
      console.info('Firestore privacy sync note:', e);
    }
  };

  // 2.4: Anonymous account linking / recovery without losing identities
  const handleLinkAccount = async (email: string) => {
    setIsAnonymous(false);
    const accountData = {
      uid,
      email,
      isAnonymous: false,
      linkedProviders: ['password'],
      linkedAt: Date.now()
    };
    try {
      localStorage.setItem('enos_linked_account', JSON.stringify(accountData));
    } catch {}

    try {
      await setDoc(doc(db, 'users', uid), accountData, { merge: true });
    } catch (e) {
      console.info('Firestore user account note:', e);
    }
  };


  // Dynamic Admin Management Handlers
  const handleAddDynamicAdmin = async (newAdminData: Omit<AdminUser, 'id' | 'createdAt' | 'createdBy'>) => {
    const adminId = 'admin_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
    const fullAdmin: AdminUser = {
      ...newAdminData,
      id: adminId,
      createdAt: Date.now(),
      createdBy: adminSession?.id || 'founder_marcelo_truman'
    };

    const updated = [fullAdmin, ...dynamicAdmins];
    setDynamicAdmins(updated);
    try { localStorage.setItem('enos_dynamic_admins', JSON.stringify(updated)); } catch {}

    try {
      await setDoc(doc(db, 'admins', adminId), fullAdmin);
    } catch (e) {
      console.info('Firestore admin sync note:', e);
    }
  };

  const handleToggleAdminStatus = async (adminId: string) => {
    const updated = dynamicAdmins.map(a =>
      a.id === adminId ? { ...a, status: (a.status === 'active' ? 'suspended' : 'active') as 'active' | 'suspended' } : a
    );
    setDynamicAdmins(updated);
    try { localStorage.setItem('enos_dynamic_admins', JSON.stringify(updated)); } catch {}

    const target = updated.find(a => a.id === adminId);
    if (target) {
      try {
        await setDoc(doc(db, 'admins', adminId), target);
      } catch (e) {
        console.info('Firestore admin update note:', e);
      }
    }
  };

  const handleDeleteAdmin = async (adminId: string) => {
    const updated = dynamicAdmins.filter(a => a.id !== adminId);
    setDynamicAdmins(updated);
    try { localStorage.setItem('enos_dynamic_admins', JSON.stringify(updated)); } catch {}

    try {
      await deleteDoc(doc(db, 'admins', adminId));
    } catch (e) {
      console.info('Firestore admin delete note:', e);
    }
  };

  // If in Admin Session View
  if (adminSession) {
    return (
      <>
        <AdminPanel
          currentAdmin={adminSession}
          dynamicAdmins={dynamicAdmins}
          onAddAdmin={handleAddDynamicAdmin}
          onToggleStatus={handleToggleAdminStatus}
          onDeleteAdmin={handleDeleteAdmin}
          onClose={() => setAdminSession(null)}
        />
        <AdminKeypadModal
          isOpen={isKeypadOpen}
          onClose={() => setIsKeypadOpen(false)}
          onSuccess={(admin) => {
            setAdminSession(admin);
            setIsKeypadOpen(false);
          }}
          dynamicAdmins={dynamicAdmins}
        />
      </>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <span className="w-10 h-10 rounded-full bg-rose-600 text-white font-bold flex items-center justify-center text-base shadow-sm animate-pulse">
            ÉN
          </span>
          <p className="text-xs font-semibold text-stone-700">Carregando ÉNós CPLP...</p>
        </div>
      </div>
    );
  }

  // If user has not completed profile onboarding
  if (!profile && uid) {
    return (
      <>
        <Onboarding
          uid={uid}
          onComplete={handleCompleteOnboarding}
          onOpenKeypad={() => setIsKeypadOpen(true)}
        />
        <AdminKeypadModal
          isOpen={isKeypadOpen}
          onClose={() => setIsKeypadOpen(false)}
          onSuccess={(admin) => {
            setAdminSession(admin);
            setIsKeypadOpen(false);
          }}
          dynamicAdmins={dynamicAdmins}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen atmosfera-enos text-stone-100 flex flex-col items-center justify-center selection:bg-rose-500/30">
      {/* App Outer Frame Container - Responsive Mobile Canvas with Atmosfera ÉNós */}
      <div className="w-full max-w-md h-screen max-h-screen atmosfera-enos flex flex-col relative overflow-hidden shadow-2xl border-x border-stone-800/60">
        
        {/* Atmosfera ÉNós: Elementos ambientais gerados 100% nativos em CSS (Sem assets/rede) */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 select-none" aria-hidden="true">
          {/* Micro-ponto de luz sutil no quadrante superior */}
          <div className="absolute top-16 left-8 text-xs text-rose-400/25 font-serif select-none drop-shadow-xs">✦</div>
          {/* Halo difuso cálido superior */}
          <div className="absolute -top-16 -left-16 w-56 h-56 rounded-full bg-rose-600/5 blur-3xl" />
          {/* Micro-ponto de luz sutil no quadrante inferior */}
          <div className="absolute bottom-28 right-10 text-xs text-amber-400/20 font-serif select-none drop-shadow-xs">✦</div>
          {/* Halo difuso âmbar inferior */}
          <div className="absolute -bottom-16 -right-16 w-60 h-60 rounded-full bg-amber-600/4 blur-3xl" />
        </div>

        {/* Top Header - Oculta ruído, mantém branding discreto e estado contextual */}
        <header className="px-4 py-2.5 bg-stone-950/75 backdrop-blur-xl border-b border-stone-800/70 flex items-center justify-between sticky top-0 z-20 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              id="btn-admin-keypad-header"
              onClick={() => setIsKeypadOpen(true)}
              className="w-7 h-7 rounded-xl bg-linear-to-br from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-bold flex items-center justify-center text-xs shadow-md shadow-rose-950/50 cursor-pointer active:scale-95 transition-all select-none border border-rose-500/40"
              title="ÉNós"
              aria-label="ÉNós"
            >
              ÉN
            </button>
            <span className="font-extrabold text-white text-sm tracking-tight">ÉNós</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              id="btn-open-gmail-header"
              onClick={() => {
                setGmailComposeProps({});
                setIsGmailOpen(true);
              }}
              className="p-1.5 rounded-xl text-stone-400 hover:text-stone-200 hover:bg-stone-800/80 transition cursor-pointer"
              title="Google Workspace · Gmail"
              aria-label="Abrir Gmail"
            >
              <Mail className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-semibold text-stone-400 bg-stone-900/90 border border-stone-800 px-2 py-0.5 rounded-full">
              {profile?.countryCode ? `CPLP · ${profile.cityName}` : 'CPLP'}
            </span>
          </div>
        </header>

        {/* Main Content Area with Seamless Shared Layout Transition & Touch Scrolling */}
        <main className="flex-1 flex flex-col overflow-y-auto no-scrollbar relative z-10">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={currentTab}
              layoutId="mainTabActiveStage"
              layout="position"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{
                layout: { type: 'spring', stiffness: 380, damping: 34 },
                opacity: { duration: 0.14, ease: 'easeInOut' }
              }}
              className="flex-1 flex flex-col w-full min-h-full"
            >
              {currentTab === 'discover' && profile && preferences && privacy && (
                <Discover
                  key={`tab-discover-${tabEpochs.discover || 0}`}
                  myProfile={profile}
                  myPreferences={preferences}
                  privacy={privacy}
                  signals={signals}
                  candidatePool={discoverProfiles}
                  onLike={handleLike}
                  onPass={handlePass}
                  onReport={handleReport}
                  onRecordSeen={handleRecordSeen}
                  onUpdatePreferences={handleUpdatePreferences}
                />
              )}

              {currentTab === 'nearby' && profile && preferences && privacy && (
                <Nearby
                  key={`tab-nearby-${tabEpochs.nearby || 0}`}
                  myProfile={profile}
                  myPreferences={preferences}
                  privacy={privacy}
                  signals={signals}
                  candidatePool={discoverProfiles}
                  onLike={handleLike}
                  onPass={handlePass}
                />
              )}

              {currentTab === 'connections' && profile && (
                <Connections
                  key={`tab-connections-${tabEpochs.connections || 0}`}
                  myProfile={profile}
                  conversations={conversations}
                  candidatePool={discoverProfiles}
                  onOpenChat={(convoId) => {
                    handleTabChange('chat');
                  }}
                  onExploreMore={() => handleTabChange('discover')}
                  onAcceptReceived={(partner) => {
                    const candidate: DiscoveryCandidate = {
                      profile: partner,
                      compatibilityScore: 0.9,
                      deterministicScore: 0.9,
                      contextScore: 0.9,
                      noveltyBonus: 0,
                      confidence: 0.9,
                      compatibilityReasons: ['Ligação recíproca confirmada'],
                      compatibilityResult: {
                        score: 0.9,
                        reasons: ['Interesse mútuo estabelecido'],
                        sharedInterests: partner.interests || [],
                        intentAlignment: 'exact',
                        culturalConnection: partner.countryCode === profile.countryCode ? 'same_country' : 'cross_cultural_cplp',
                        confidence: 0.9
                      },
                      discoveryReason: 'Interesse mútuo',
                      evidence: [],
                      connectionContext: '',
                      conversationPrompt: '',
                      discoveryMode: 'SIMILARITY'
                    };
                    handleLike(candidate, undefined, true);
                  }}
                />
              )}

              {currentTab === 'chat' && profile && (
                <Conversations
                  key={`tab-chat-${tabEpochs.chat || 0}`}
                  myProfile={profile}
                  conversations={conversations}
                  messages={messages}
                  onSendMessage={handleSendMessage}
                  onBlockUser={handleBlockUser}
                />
              )}

              {currentTab === 'me' && profile && preferences && privacy && (
                <Profile
                  key={`tab-me-${tabEpochs.me || 0}`}
                  profile={profile}
                  preferences={preferences}
                  privacy={privacy}
                  isAnonymous={isAnonymous}
                  onUpdateProfile={handleUpdateProfile}
                  onUpdatePreferences={handleUpdatePreferences}
                  onUpdatePrivacy={handleUpdatePrivacy}
                  onLinkAccount={handleLinkAccount}
                  onOpenKeypad={() => setIsKeypadOpen(true)}
                  onOpenGmail={() => {
                    setGmailComposeProps({});
                    setIsGmailOpen(true);
                  }}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Inviolable 5-Tab Bottom Navigation: Descobrir | Perto | Ligações | Chat | Eu */}
        <nav className="shrink-0 max-w-md mx-auto w-full bg-stone-950/90 backdrop-blur-xl border-t border-stone-800/80 px-2 py-1.5 flex items-center justify-around z-30 shadow-2xl safe-pb">
          {[
            { id: 'discover' as const, label: 'Descobrir', icon: Compass, badge: false },
            { id: 'nearby' as const, label: 'Perto', icon: MapPin, badge: false },
            { id: 'connections' as const, label: 'Ligações', icon: HeartHandshake, badge: conversations.length > 0 },
            { id: 'chat' as const, label: 'Chat', icon: MessageCircle, badge: conversations.length > 0 },
            { id: 'me' as const, label: 'Eu', icon: UserIcon, badge: false },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                id={`tab-${tab.id}`}
                onClick={() => handleTabChange(tab.id)}
                className={`relative flex flex-col items-center justify-center py-1.5 px-2.5 rounded-2xl transition-colors cursor-pointer select-none active:scale-95 flex-1 min-h-[48px] ${
                  isActive ? 'text-rose-500 font-bold' : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTabPill"
                    className="absolute inset-0 bg-rose-950/40 border border-rose-800/50 rounded-2xl shadow-xs"
                    transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                  />
                )}
                <div className="relative z-10 flex flex-col items-center gap-0.5">
                  <Icon className="w-5 h-5 transition-transform duration-150" />
                  <span className="text-[10px] tracking-tight font-medium">{tab.label}</span>
                  {tab.badge && (
                    <span className="absolute -top-0.5 -right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-stone-950" />
                  )}
                </div>
              </button>
            );
          })}
        </nav>


        {/* Gmail Integration Modal */}
        <GmailModal
          isOpen={isGmailOpen}
          onClose={() => setIsGmailOpen(false)}
          initialRecipient={gmailComposeProps.recipient}
          initialSubject={gmailComposeProps.subject}
          initialBody={gmailComposeProps.body}
        />

        {/* Secret Keypad Modal */}
        <AdminKeypadModal
          isOpen={isKeypadOpen}
          onClose={() => setIsKeypadOpen(false)}
          onSuccess={(admin) => {
            setAdminSession(admin);
            setIsKeypadOpen(false);
          }}
          dynamicAdmins={dynamicAdmins}
        />
      </div>
    </div>
  );
}

