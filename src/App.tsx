import React, { useState, useEffect } from 'react';
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
import { Onboarding } from './components/Onboarding';
import { Discover } from './components/Discover';
import { Conversations } from './components/Conversations';
import { Profile } from './components/Profile';
import { AdminKeypadModal } from './components/AdminKeypadModal';
import { AdminPanel } from './components/AdminPanel';
import { GmailModal } from './components/GmailModal';
import { Compass, MessageCircle, User as UserIcon, Shield, Mail } from 'lucide-react';

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

  // App Navigation State: 'discover' | 'conversations' | 'profile'
  const [currentTab, setCurrentTab] = useState<'discover' | 'conversations' | 'profile'>('discover');

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

    const initAuthAndData = async () => {
      const stableUid = getOrCreateDeviceId();
      if (isMounted) {
        setUid(stableUid);
        setSignals(getInitialSignals(stableUid));
      }

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

      // Attempt Firebase auth state listener
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        const activeUid = user?.uid || stableUid;
        if (isMounted) {
          setUid(activeUid);
          setIsAnonymous(user ? user.isAnonymous : true);
        }

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
        } catch (err) {
          console.info('Using fast local cached state:', err);
        } finally {
          if (isMounted) setLoading(false);
        }
      });

      if (!auth.currentUser) {
        try {
          await signInAnonymously(auth);
        } catch (err) {
          console.info('Running in device guest mode with full local and firestore sync:', err);
          if (isMounted) setLoading(false);
        }
      }

      return unsubscribe;
    };

    const cleanupPromise = initAuthAndData();

    return () => {
      isMounted = false;
      cleanupPromise.then(unsub => {
        if (typeof unsub === 'function') unsub();
      });
    };
  }, []);

  // 2. Finish Onboarding & Save to Firestore & Local Storage (2.6: Candidates already prepared)
  const handleCompleteOnboarding = async (newProfile: UserProfile) => {
    setProfile(newProfile);
    try {
      localStorage.setItem('enos_profile', JSON.stringify(newProfile));
    } catch {}

    const initialPrefs: UserPreferences = {
      uid: newProfile.uid,
      minAge: 18,
      maxAge: 70,
      genders: ['man', 'woman', 'non_binary', 'other'],
      countries: ['AO', 'BR', 'CV', 'GW', 'GQ', 'MZ', 'PT', 'ST', 'TL'],
      relationshipIntents: [newProfile.intent],
      crossCultural: true,
      verifiedOnly: false,
      discoveryEnabled: true
    };

    const initialPrivacy: PrivacySettings = {
      uid: newProfile.uid,
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
      await setDoc(doc(db, 'profiles', newProfile.uid), newProfile);
      await setDoc(doc(db, 'preferences', newProfile.uid), initialPrefs);
      await setDoc(doc(db, 'privacy', newProfile.uid), initialPrivacy);
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
  const handleLinkAccount = (email: string) => {
    setIsAnonymous(false);
    const accountData = {
      uid,
      email,
      linkedProviders: ['email_recovery'],
      linkedAt: Date.now()
    };
    try {
      localStorage.setItem('enos_linked_account', JSON.stringify(accountData));
    } catch {}
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
    <div className="min-h-screen bg-stone-100 flex flex-col items-center">
      {/* App Outer Frame Container */}
      <div className="w-full max-w-md min-h-screen bg-stone-50 flex flex-col relative shadow-md">
        {/* Top Minimal Branding Header with Discreet Admin Trigger inside ÉN Logo */}
        <header className="px-4 py-3 bg-white border-b border-stone-200 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-2">
            <button
              type="button"
              id="btn-admin-keypad-header"
              onClick={() => setIsKeypadOpen(true)}
              className="w-8 h-8 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-bold flex items-center justify-center text-xs shadow-2xs cursor-pointer active:scale-95 transition select-none"
              title="ÉNós"
              aria-label="ÉNós"
            >
              ÉN
            </button>
            <span className="font-bold text-stone-900 text-sm tracking-tight">ÉNós</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              id="btn-open-gmail-header"
              onClick={() => {
                setGmailComposeProps({});
                setIsGmailOpen(true);
              }}
              className="p-1.5 rounded-full text-stone-600 hover:text-red-600 hover:bg-stone-100 transition cursor-pointer"
              title="Google Workspace · Gmail"
              aria-label="Abrir Gmail"
            >
              <Mail className="w-4 h-4" />
            </button>
            <span className="text-xs font-medium text-stone-600">
              {profile?.countryCode ? `CPLP · ${profile.cityName}` : 'CPLP'}
            </span>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col">
          {currentTab === 'discover' && profile && preferences && privacy && (
            <Discover
              myProfile={profile}
              myPreferences={preferences}
              privacy={privacy}
              signals={signals}
              candidatePool={discoverProfiles}
              onLike={handleLike}
              onPass={handlePass}
              onReport={handleReport}
              onRecordSeen={handleRecordSeen}
              onOpenPreferences={() => setCurrentTab('profile')}
            />
          )}

          {currentTab === 'conversations' && profile && (
            <Conversations
              myProfile={profile}
              conversations={conversations}
              messages={messages}
              onSendMessage={handleSendMessage}
              onBlockUser={handleBlockUser}
            />
          )}

          {currentTab === 'profile' && profile && preferences && privacy && (
            <Profile
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
        </main>

        {/* Inviolable 3-Tab Bottom Navigation: DESCUBRIR, CONVERSAS, PERFIL */}
        <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white/95 backdrop-blur-md border-t border-stone-200 px-6 py-2 flex items-center justify-around z-30 shadow-lg">
          <button
            type="button"
            id="tab-discover"
            onClick={() => setCurrentTab('discover')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition ${
              currentTab === 'discover' ? 'text-rose-600 font-semibold' : 'text-stone-700 hover:text-stone-900'
            }`}
          >
            <Compass className="w-5 h-5" />
            <span className="text-[10px] tracking-wider uppercase">O teu Agora</span>
          </button>

          <button
            type="button"
            id="tab-conversations"
            onClick={() => setCurrentTab('conversations')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition relative ${
              currentTab === 'conversations' ? 'text-rose-600 font-semibold' : 'text-stone-700 hover:text-stone-900'
            }`}
          >
            <MessageCircle className="w-5 h-5" />
            <span className="text-[10px] tracking-wider uppercase">Conversas</span>
            {conversations.length > 0 && (
              <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-rose-600" />
            )}
          </button>

          <button
            type="button"
            id="tab-profile"
            onClick={() => setCurrentTab('profile')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition ${
              currentTab === 'profile' ? 'text-rose-600 font-semibold' : 'text-stone-700 hover:text-stone-900'
            }`}
          >
            <UserIcon className="w-5 h-5" />
            <span className="text-[10px] tracking-wider uppercase">Perfil</span>
          </button>
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

