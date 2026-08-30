import {
  auth,
  db,
  signInAnonymously,
  onAuthStateChanged,
  linkWithCredential,
  EmailAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updatePassword,
  updateEmail,
  reauthenticateWithCredential,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  linkWithPopup,
  sendEmailVerification,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  User
} from '../firebase/config';
import {
  AuthUser,
  UserSession,
  SensitiveOperationType,
  SecurityAuditEvent
} from '../types';

function parseDeviceInfo(): { deviceName: string; browser: string; os: string } {
  if (typeof window === 'undefined') {
    return { deviceName: 'Servidor/Ambiente', browser: 'Desconhecido', os: 'Linux' };
  }

  const ua = navigator.userAgent;
  let browser = 'Navegador Web';
  let os = 'Sistema Operacional';
  let deviceName = 'Dispositivo Web';

  // OS Detection
  if (/android/i.test(ua)) {
    os = 'Android';
    deviceName = 'Dispositivo Android';
  } else if (/iPad|iPhone|iPod/.test(ua)) {
    os = 'iOS';
    deviceName = 'Apple iPhone/iPad';
  } else if (/Macintosh|Mac OS X/.test(ua)) {
    os = 'macOS';
    deviceName = 'Apple Mac';
  } else if (/Windows NT/.test(ua)) {
    os = 'Windows';
    deviceName = 'PC Windows';
  } else if (/Linux/.test(ua)) {
    os = 'Linux';
    deviceName = 'Dispositivo Linux';
  }

  // Browser Detection
  if (/Edg/i.test(ua)) {
    browser = 'Microsoft Edge';
  } else if (/Chrome/i.test(ua) && !/Chromium|Edg/i.test(ua)) {
    browser = 'Google Chrome';
  } else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) {
    browser = 'Safari';
  } else if (/Firefox/i.test(ua)) {
    browser = 'Mozilla Firefox';
  }

  return { deviceName, browser, os };
}

function getOrCreateSessionId(): string {
  try {
    let sid = sessionStorage.getItem('enos_session_id');
    if (!sid) {
      sid = 'sess_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36);
      sessionStorage.setItem('enos_session_id', sid);
    }
    return sid;
  } catch {
    return 'sess_' + Math.random().toString(36).substring(2, 11);
  }
}

type AuthSubscriber = (user: AuthUser | null) => void;

export class AuthService {
  private static instance: AuthService;
  private currentUser: AuthUser | null = null;
  private currentFirebaseUser: User | null = null;
  private subscribers: Set<AuthSubscriber> = new Set();
  private currentSessionId: string = getOrCreateSessionId();
  private lastReauthTimestamp: number = 0;

  private constructor() {
    this.initAuthListener();
  }

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  private initAuthListener(): void {
    onAuthStateChanged(auth, async (fbUser) => {
      this.currentFirebaseUser = fbUser;
      if (fbUser) {
        const authUser: AuthUser = {
          uid: fbUser.uid,
          isAnonymous: fbUser.isAnonymous,
          email: fbUser.email,
          emailVerified: fbUser.emailVerified,
          phoneNumber: fbUser.phoneNumber,
          createdAt: fbUser.metadata.creationTime ? new Date(fbUser.metadata.creationTime).getTime() : Date.now(),
          lastLoginAt: fbUser.metadata.lastSignInTime ? new Date(fbUser.metadata.lastSignInTime).getTime() : Date.now(),
          linkedProviders: fbUser.providerData.map(p => p.providerId),
          lastReauthAt: this.lastReauthTimestamp
        };
        this.currentUser = authUser;

        // Register session in background
        this.registerSession(fbUser.uid).catch(err => console.info('Session registration note:', err));
        this.notifySubscribers();
      } else {
        this.currentUser = null;
        this.notifySubscribers();
      }
    });
  }

  public subscribe(cb: AuthSubscriber): () => void {
    this.subscribers.add(cb);
    cb(this.currentUser);
    return () => {
      this.subscribers.delete(cb);
    };
  }

  private notifySubscribers(): void {
    for (const sub of this.subscribers) {
      try {
        sub(this.currentUser);
      } catch (err) {
        console.error('Auth subscriber error:', err);
      }
    }
  }

  public getCurrentUser(): AuthUser | null {
    return this.currentUser;
  }

  public getFirebaseUser(): User | null {
    return this.currentFirebaseUser || auth.currentUser;
  }

  public getCurrentSessionId(): string {
    return this.currentSessionId;
  }

  public async getAuthHeaders(): Promise<Record<string, string>> {
    const user = this.currentFirebaseUser || auth.currentUser;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-session-id': this.currentSessionId
    };

    if (user) {
      try {
        const token = await user.getIdToken();
        headers['Authorization'] = `Bearer ${token}`;
      } catch {
        headers['Authorization'] = `Bearer ${user.uid}`;
      }
      headers['x-user-id'] = user.uid;
      if (user.email) headers['x-user-email'] = user.email;
    } else if (this.currentUser) {
      headers['Authorization'] = `Bearer ${this.currentUser.uid}`;
      headers['x-user-id'] = this.currentUser.uid;
      if (this.currentUser.email) headers['x-user-email'] = this.currentUser.email;
    } else {
      headers['Authorization'] = 'Bearer anonymous_guest';
    }

    return headers;
  }

  // 1. Permanent Account Registration (Email/Password)
  public async registerWithEmailPassword(
    email: string,
    pass: string,
    displayName?: string
  ): Promise<{ success: boolean; user?: AuthUser; error?: string }> {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), pass);
      if (cred.user) {
        // Send email verification
        try {
          await sendEmailVerification(cred.user);
        } catch (e) {
          console.info('Email verification note:', e);
        }

        // Audit Event
        await this.logSecurityEvent(cred.user.uid, 'ACCOUNT_CREATED', {
          email: cred.user.email,
          displayName
        });

        // Store account record
        await setDoc(doc(db, 'users', cred.user.uid), {
          uid: cred.user.uid,
          email: cred.user.email,
          displayName: displayName || null,
          isAnonymous: false,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }, { merge: true });

        return { success: true };
      }
      return { success: false, error: 'Não foi possível criar o utilizador.' };
    } catch (err: any) {
      console.error('Registration error:', err);
      return { success: false, error: this.mapAuthError(err) };
    }
  }

  // 2. Email & Password Login
  public async loginWithEmailPassword(
    email: string,
    pass: string
  ): Promise<{ success: boolean; user?: AuthUser; error?: string }> {
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), pass);
      if (cred.user) {
        this.lastReauthTimestamp = Date.now();
        await this.logSecurityEvent(cred.user.uid, 'EMAIL_PASSWORD_LOGIN', {
          email: cred.user.email
        });
        await this.registerSession(cred.user.uid);
        return { success: true };
      }
      return { success: false, error: 'Falha ao iniciar sessão.' };
    } catch (err: any) {
      console.error('Login error:', err);
      return { success: false, error: this.mapAuthError(err) };
    }
  }

  // 3. Password Reset & Account Recovery
  public async sendPasswordRecovery(
    email: string
  ): Promise<{ success: boolean; error?: string; message?: string }> {
    try {
      await sendPasswordResetEmail(auth, email.trim());
      await this.logSecurityEvent('anonymous_or_recovery', 'PASSWORD_RESET_REQUESTED', {
        email: email.trim()
      });
      return {
        success: true,
        message: 'Enviámos um link de recuperação para o seu e-mail. Verifique a sua caixa de entrada e spam.'
      };
    } catch (err: any) {
      console.error('Password reset error:', err);
      return { success: false, error: this.mapAuthError(err) };
    }
  }

  // 4. Link Anonymous Account to Permanent Email/Password (Preserving UID, Matches & Trust Score!)
  public async linkAnonymousToPermanentEmail(
    email: string,
    pass: string
  ): Promise<{ success: boolean; error?: string }> {
    const user = auth.currentUser;
    if (!user) {
      return { success: false, error: 'Nenhuma sessão ativa encontrada para vincular.' };
    }

    try {
      const credential = EmailAuthProvider.credential(email.trim(), pass);
      const linkResult = await linkWithCredential(user, credential);

      if (linkResult.user) {
        // Send email verification
        try {
          await sendEmailVerification(linkResult.user);
        } catch (e) {
          console.info('Email verification note:', e);
        }

        // Store permanent user doc
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          email: linkResult.user.email,
          isAnonymous: false,
          linkedAt: Date.now(),
          updatedAt: Date.now()
        }, { merge: true });

        // Update local flags
        try {
          localStorage.setItem('enos_linked_account', JSON.stringify({
            uid: user.uid,
            email: linkResult.user.email,
            linkedAt: Date.now()
          }));
        } catch {}

        await this.logSecurityEvent(user.uid, 'ACCOUNT_LINKED', {
          provider: 'password',
          email: linkResult.user.email
        });

        this.lastReauthTimestamp = Date.now();
        return { success: true };
      }
      return { success: false, error: 'Falha ao vincular conta permanente.' };
    } catch (err: any) {
      console.error('Linking error:', err);
      return { success: false, error: this.mapAuthError(err) };
    }
  }

  // 5. Link with Google OAuth Popup
  public async linkWithGoogle(): Promise<{ success: boolean; error?: string }> {
    const user = auth.currentUser;
    if (!user) {
      return { success: false, error: 'Nenhuma sessão ativa encontrada.' };
    }

    try {
      const provider = new GoogleAuthProvider();
      const result = await linkWithPopup(user, provider);
      if (result.user) {
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          email: result.user.email,
          isAnonymous: false,
          linkedAt: Date.now(),
          provider: 'google.com'
        }, { merge: true });

        await this.logSecurityEvent(user.uid, 'GOOGLE_LOGIN', {
          provider: 'google.com',
          email: result.user.email
        });

        return { success: true };
      }
      return { success: false, error: 'Falha na vinculação com Google.' };
    } catch (err: any) {
      console.error('Google linking error:', err);
      return { success: false, error: this.mapAuthError(err) };
    }
  }

  // 6. Device & Active Session Management
  public async registerSession(userId: string): Promise<UserSession> {
    const info = parseDeviceInfo();
    const session: UserSession = {
      sessionId: this.currentSessionId,
      userId,
      deviceName: info.deviceName,
      browser: info.browser,
      os: info.os,
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      isCurrent: true,
      status: 'active'
    };

    try {
      await setDoc(doc(db, 'user_sessions', this.currentSessionId), session, { merge: true });
    } catch (e) {
      console.info('Local session registration fallback:', e);
    }

    return session;
  }

  public async fetchUserSessions(userId: string): Promise<UserSession[]> {
    try {
      const q = query(
        collection(db, 'user_sessions'),
        where('userId', '==', userId)
      );
      const snap = await getDocs(q);
      const sessions: UserSession[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data() as UserSession;
        sessions.push({
          ...data,
          isCurrent: data.sessionId === this.currentSessionId
        });
      });

      // Sort by last active
      return sessions.sort((a, b) => b.lastActiveAt - a.lastActiveAt);
    } catch (err) {
      console.info('Session fetch fallback to current device:', err);
      const info = parseDeviceInfo();
      return [{
        sessionId: this.currentSessionId,
        userId,
        deviceName: `${info.deviceName} (${info.os})`,
        browser: info.browser,
        os: info.os,
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
        isCurrent: true,
        status: 'active'
      }];
    }
  }

  public async revokeSession(sessionId: string, userId: string): Promise<boolean> {
    try {
      await updateDoc(doc(db, 'user_sessions', sessionId), {
        status: 'revoked',
        revokedAt: Date.now()
      });

      await this.logSecurityEvent(userId, 'SESSION_REVOKED', {
        targetSessionId: sessionId
      });

      // If user revoked current session, sign out
      if (sessionId === this.currentSessionId) {
        await this.signOutUser();
      }

      return true;
    } catch (err) {
      console.error('Revoke session error:', err);
      return false;
    }
  }

  public async revokeAllOtherSessions(userId: string): Promise<boolean> {
    try {
      const sessions = await this.fetchUserSessions(userId);
      const otherSessions = sessions.filter(s => s.sessionId !== this.currentSessionId && s.status === 'active');

      for (const s of otherSessions) {
        await updateDoc(doc(db, 'user_sessions', s.sessionId), {
          status: 'revoked',
          revokedAt: Date.now()
        });
      }

      await this.logSecurityEvent(userId, 'SESSION_REVOKED', {
        action: 'REVOKE_ALL_OTHERS',
        revokedCount: otherSessions.length
      });

      return true;
    } catch (err) {
      console.error('Revoke all other sessions error:', err);
      return false;
    }
  }

  // 7. Strong Authentication & Step-Up Auth for Sensitive Operations
  public isRecentReauthValid(windowMinutes: number = 5): boolean {
    const elapsed = Date.now() - this.lastReauthTimestamp;
    return elapsed < windowMinutes * 60 * 1000;
  }

  public async reauthenticate(password: string): Promise<{ success: boolean; error?: string }> {
    const user = auth.currentUser;
    if (!user || !user.email) {
      return { success: false, error: 'Sessão inválida ou utilizador sem e-mail cadastrado.' };
    }

    try {
      const credential = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(user, credential);
      this.lastReauthTimestamp = Date.now();

      await this.logSecurityEvent(user.uid, 'SENSITIVE_REAUTH_SUCCESS', {
        timestamp: Date.now()
      });

      return { success: true };
    } catch (err: any) {
      console.error('Re-authentication failed:', err);
      await this.logSecurityEvent(user.uid, 'SENSITIVE_REAUTH_FAILED', {
        error: err?.message
      });
      return { success: false, error: this.mapAuthError(err) };
    }
  }

  public async changePassword(
    currentPass: string,
    newPass: string
  ): Promise<{ success: boolean; error?: string }> {
    const reauth = await this.reauthenticate(currentPass);
    if (!reauth.success) {
      return reauth;
    }

    const user = auth.currentUser;
    if (!user) return { success: false, error: 'Utilizador não autenticado.' };

    try {
      await updatePassword(user, newPass);
      await this.logSecurityEvent(user.uid, 'PASSWORD_CHANGED', {});
      return { success: true };
    } catch (err: any) {
      console.error('Change password error:', err);
      return { success: false, error: this.mapAuthError(err) };
    }
  }

  public async changeEmail(
    currentPass: string,
    newEmail: string
  ): Promise<{ success: boolean; error?: string }> {
    const reauth = await this.reauthenticate(currentPass);
    if (!reauth.success) {
      return reauth;
    }

    const user = auth.currentUser;
    if (!user) return { success: false, error: 'Utilizador não autenticado.' };

    try {
      await updateEmail(user, newEmail.trim());
      await setDoc(doc(db, 'users', user.uid), {
        email: newEmail.trim(),
        updatedAt: Date.now()
      }, { merge: true });

      await this.logSecurityEvent(user.uid, 'EMAIL_CHANGED', { newEmail: newEmail.trim() });
      return { success: true };
    } catch (err: any) {
      console.error('Change email error:', err);
      return { success: false, error: this.mapAuthError(err) };
    }
  }

  // 8. Delete Account (Right to be forgotten / GDPR / LGPD)
  public async deleteAccount(
    password?: string,
    onCleanupData?: () => Promise<void>
  ): Promise<{ success: boolean; error?: string }> {
    const user = auth.currentUser;
    if (!user) return { success: false, error: 'Nenhuma sessão ativa.' };

    if (!user.isAnonymous && user.email && password) {
      const reauth = await this.reauthenticate(password);
      if (!reauth.success) return reauth;
    }

    try {
      const uid = user.uid;

      if (onCleanupData) {
        await onCleanupData();
      }

      // Cleanup core Firestore docs
      try {
        await deleteDoc(doc(db, 'profiles', uid));
        await deleteDoc(doc(db, 'preferences', uid));
        await deleteDoc(doc(db, 'privacy', uid));
        await deleteDoc(doc(db, 'signals', uid));
        await deleteDoc(doc(db, 'users', uid));
      } catch (e) {
        console.info('Firestore cleanup note:', e);
      }

      await this.logSecurityEvent(uid, 'ACCOUNT_DELETED', {});

      // Delete Firebase Auth User
      await user.delete();

      // Clear local storage
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch {}

      return { success: true };
    } catch (err: any) {
      console.error('Delete account error:', err);
      return { success: false, error: this.mapAuthError(err) };
    }
  }

  // 9. Export All User Data Archive (Data Portability)
  public async exportUserDataArchive(userId: string): Promise<Record<string, unknown>> {
    const archive: Record<string, unknown> = {
      exportTimestamp: new Date().toISOString(),
      userId,
      disclaimer: 'Arquivo de portabilidade e soberania de dados do utilizador ÉNós CPLP.'
    };

    try {
      const profileSnap = await getDoc(doc(db, 'profiles', userId));
      if (profileSnap.exists()) archive.profile = profileSnap.data();

      const prefSnap = await getDoc(doc(db, 'preferences', userId));
      if (prefSnap.exists()) archive.preferences = prefSnap.data();

      const privSnap = await getDoc(doc(db, 'privacy', userId));
      if (privSnap.exists()) archive.privacy = privSnap.data();

      const sessionsSnap = await this.fetchUserSessions(userId);
      archive.sessions = sessionsSnap;

      const localConversations = localStorage.getItem('enos_conversations');
      if (localConversations) archive.conversations = JSON.parse(localConversations);

      const localMemory = localStorage.getItem('enos_relational_memory');
      if (localMemory) archive.relationalMemory = JSON.parse(localMemory);
    } catch (err) {
      console.info('Export archive partial fallback:', err);
    }

    return archive;
  }

  // 10. Sign Out
  public async signOutUser(): Promise<void> {
    try {
      if (this.currentFirebaseUser) {
        await updateDoc(doc(db, 'user_sessions', this.currentSessionId), {
          status: 'revoked',
          revokedAt: Date.now()
        }).catch(() => {});
      }
      await signOut(auth);
      this.currentUser = null;
      this.currentFirebaseUser = null;
      this.notifySubscribers();
    } catch (err) {
      console.error('Sign out error:', err);
    }
  }

  // Helper: Security Event Audit Logger
  public async logSecurityEvent(
    userId: string,
    eventType: SecurityAuditEvent['eventType'],
    details?: Record<string, unknown>
  ): Promise<void> {
    const event: SecurityAuditEvent = {
      id: 'sec_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36),
      userId,
      eventType,
      details,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      timestamp: Date.now()
    };

    try {
      await setDoc(doc(db, 'security_events', event.id), event);
    } catch (e) {
      console.info('Local security audit logging:', e);
    }
  }

  private mapAuthError(err: any): string {
    const code = err?.code || '';
    switch (code) {
      case 'auth/email-already-in-use':
        return 'Este endereço de e-mail já está associado a outra conta.';
      case 'auth/invalid-email':
        return 'Endereço de e-mail inválido.';
      case 'auth/weak-password':
        return 'A senha deve ter pelo menos 6 caracteres com boa complexidade.';
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'Senha ou credenciais incorretas.';
      case 'auth/user-not-found':
        return 'Nenhuma conta encontrada com este e-mail.';
      case 'auth/credential-already-in-use':
        return 'Estas credenciais já estão vinculadas a outra conta ativa.';
      case 'auth/requires-recent-login':
        return 'Esta operação sensível exige autenticação recente. Digite sua senha novamente.';
      case 'auth/too-many-requests':
        return 'Muitas tentativas falhadas. Aguarde alguns instantes antes de tentar novamente.';
      default:
        return err?.message || 'Ocorreu um erro na autenticação. Verifique os dados e tente novamente.';
    }
  }
}

export const authService = AuthService.getInstance();
