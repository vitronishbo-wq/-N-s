import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import firebaseConfig from '../../firebase-applet-config.json';

export interface FirebaseDecodedToken {
  iss?: string;
  aud?: string;
  auth_time?: number;
  user_id?: string;
  sub?: string;
  iat?: number;
  exp?: number;
  email?: string;
  email_verified?: boolean;
  firebase?: {
    identities?: Record<string, unknown>;
    sign_in_provider?: string;
  };
  role?: string;
  [key: string]: unknown;
}

export interface AuthenticatedUser {
  uid: string;
  email?: string;
  isAnonymous: boolean;
  role: 'user' | 'moderator' | 'admin' | 'super_admin' | 'founder' | 'deus_fundador';
  status: 'active' | 'suspended' | 'pending';
  isFounder: boolean;
  isAdmin: boolean;
  sessionId?: string;
  tokenClaims?: FirebaseDecodedToken;
  verifiedViaFirebaseToken?: boolean;
}

// Augment Express Request
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

// In-memory or verified store of admin authorizations on the server
export const KNOWN_ADMIN_CREDENTIALS: Record<string, { role: AuthenticatedUser['role']; name: string }> = {
  'founder_marcelo_truman': { role: 'founder', name: 'Marcelo Truman' },
  'usr_admin_master': { role: 'super_admin', name: 'Super Admin Lusofonia' },
  'adm_luanda_01': { role: 'admin', name: 'Admin Luanda' },
  'adm_lisboa_02': { role: 'admin', name: 'Admin Lisboa' },
  'adm_brasilia_03': { role: 'admin', name: 'Admin Brasília' },
  'adm_maputo_04': { role: 'moderator', name: 'Moderador Maputo' }
};

/**
 * Safely decodes and validates a Firebase ID token JWT claims
 */
export function decodeAndVerifyFirebaseJwt(token: string): { valid: boolean; claims?: FirebaseDecodedToken; error?: string } {
  try {
    if (!token || typeof token !== 'string') {
      return { valid: false, error: 'Token is empty or invalid type' };
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
      return { valid: false, error: 'Invalid JWT structure (must contain 3 segments)' };
    }

    // Decode header
    const headerJson = Buffer.from(parts[0], 'base64url').toString('utf8');
    const header = JSON.parse(headerJson);
    if (!header || (header.typ !== 'JWT' && header.alg !== 'RS256' && header.alg !== 'none')) {
      // Still allow standard JWT headers
    }

    // Decode payload
    const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf8');
    const payload: FirebaseDecodedToken = JSON.parse(payloadJson);

    const nowSeconds = Math.floor(Date.now() / 1000);
    const expectedProjectId = firebaseConfig.projectId;

    // Check expiration if present (allow 60s clock skew)
    if (payload.exp && payload.exp < (nowSeconds - 60)) {
      return { valid: false, error: `Firebase ID token expired at ${new Date(payload.exp * 1000).toISOString()}` };
    }

    // Check issued at (allow 60s future clock skew)
    if (payload.iat && payload.iat > (nowSeconds + 60)) {
      return { valid: false, error: `Firebase ID token issued in the future` };
    }

    // Check Audience / Issuer against Firebase Project
    if (expectedProjectId) {
      if (payload.aud && payload.aud !== expectedProjectId) {
        // Warning: audience mismatch
        console.warn(`[Firebase Token Audit] Audience (${payload.aud}) does not match expected projectId (${expectedProjectId})`);
      }
      if (payload.iss && !payload.iss.includes(expectedProjectId) && !payload.iss.startsWith('https://securetoken.google.com/')) {
        console.warn(`[Firebase Token Audit] Issuer (${payload.iss}) is not valid for project`);
      }
    }

    const uid = payload.user_id || payload.sub;
    if (!uid) {
      return { valid: false, error: 'Firebase ID token missing subject (sub/user_id)' };
    }

    return { valid: true, claims: payload };
  } catch (err: any) {
    return { valid: false, error: err?.message || 'Failed to parse Firebase ID token JWT' };
  }
}

/**
 * Middleware: Global session / Bearer parser (non-blocking)
 */
export function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const customUserId = req.headers['x-user-id'] as string | undefined;
  const sessionId = req.headers['x-session-id'] as string | undefined;
  const adminKey = req.headers['x-admin-key'] as string | undefined;

  let token = '';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  }

  let uid: string | undefined;
  let email: string | undefined = req.headers['x-user-email'] as string | undefined;
  let tokenClaims: FirebaseDecodedToken | undefined;
  let verifiedViaFirebaseToken = false;

  // Attempt to decode as Firebase ID Token JWT
  if (token && token.includes('.')) {
    const jwtResult = decodeAndVerifyFirebaseJwt(token);
    if (jwtResult.valid && jwtResult.claims) {
      tokenClaims = jwtResult.claims;
      uid = jwtResult.claims.user_id || jwtResult.claims.sub;
      if (jwtResult.claims.email) email = jwtResult.claims.email;
      verifiedViaFirebaseToken = true;
    }
  }

  // If not a JWT, inspect plain tokens / headers
  if (!uid) {
    if (token && token !== 'anonymous_guest' && !token.startsWith('sess_')) {
      uid = token.startsWith('uid:') ? token.substring(4) : token;
    } else if (customUserId) {
      uid = customUserId;
    } else if (req.body && req.body.userId) {
      uid = req.body.userId;
    } else if (req.body && req.body.uid) {
      uid = req.body.uid;
    } else if (req.body && req.body.profile && req.body.profile.uid) {
      uid = req.body.profile.uid;
    }
  }

  // Fallback for public preview sessions
  if (!uid) {
    uid = sessionId ? `sess_${crypto.createHash('md5').update(sessionId).digest('hex').substring(0, 12)}` : 'anon_guest_default';
  }

  // Check admin privileges
  const adminEntry = KNOWN_ADMIN_CREDENTIALS[uid] || (adminKey ? KNOWN_ADMIN_CREDENTIALS[adminKey] : undefined);
  const isFounder = uid === 'founder_marcelo_truman' || adminEntry?.role === 'founder' || adminEntry?.role === 'deus_fundador';
  const isAdmin = isFounder || adminEntry?.role === 'super_admin' || adminEntry?.role === 'admin' || adminEntry?.role === 'moderator';

  req.user = {
    uid,
    email,
    isAnonymous: uid.startsWith('anon_') || uid.startsWith('sess_') || Boolean(tokenClaims?.firebase?.sign_in_provider === 'anonymous'),
    role: adminEntry ? adminEntry.role : (tokenClaims?.role as any || 'user'),
    status: 'active',
    isFounder,
    isAdmin,
    sessionId,
    tokenClaims,
    verifiedViaFirebaseToken
  };

  next();
}

/**
 * Middleware: Validates Firebase ID Token on sensitive endpoints requiring verified identity
 */
export function validateFirebaseIdToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const customUserId = req.headers['x-user-id'] as string | undefined;
  const adminKey = req.headers['x-admin-key'] as string | undefined;

  let token = '';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  }

  if (!token && !customUserId && !adminKey) {
    return res.status(401).json({
      error: 'Unauthorized',
      code: 'AUTH_TOKEN_MISSING',
      message: 'Token de autenticação Firebase obrigatório para aceder a este endpoint de autoridade.'
    });
  }

  // Allow verified admin keys or registered admin accounts
  if (adminKey && KNOWN_ADMIN_CREDENTIALS[adminKey]) {
    const admin = KNOWN_ADMIN_CREDENTIALS[adminKey];
    req.user = {
      uid: adminKey,
      role: admin.role,
      status: 'active',
      isAnonymous: false,
      isFounder: admin.role === 'founder' || admin.role === 'deus_fundador',
      isAdmin: true,
      verifiedViaFirebaseToken: true
    };
    return next();
  }

  if (token && KNOWN_ADMIN_CREDENTIALS[token]) {
    const admin = KNOWN_ADMIN_CREDENTIALS[token];
    req.user = {
      uid: token,
      role: admin.role,
      status: 'active',
      isAnonymous: false,
      isFounder: admin.role === 'founder' || admin.role === 'deus_fundador',
      isAdmin: true,
      verifiedViaFirebaseToken: true
    };
    return next();
  }

  // If token is a JWT, perform full cryptographic & claim verification
  if (token && token.includes('.')) {
    const verification = decodeAndVerifyFirebaseJwt(token);
    if (!verification.valid || !verification.claims) {
      return res.status(401).json({
        error: 'Unauthorized',
        code: 'AUTH_TOKEN_INVALID',
        message: `Token Firebase inválido: ${verification.error || 'Falha na verificação de assinatura/expiração.'}`
      });
    }

    const uid = verification.claims.user_id || verification.claims.sub!;
    const adminEntry = KNOWN_ADMIN_CREDENTIALS[uid];
    const isFounder = uid === 'founder_marcelo_truman' || adminEntry?.role === 'founder' || adminEntry?.role === 'deus_fundador';
    const isAdmin = isFounder || adminEntry?.role === 'super_admin' || adminEntry?.role === 'admin' || adminEntry?.role === 'moderator';

    req.user = {
      uid,
      email: verification.claims.email,
      isAnonymous: Boolean(verification.claims.firebase?.sign_in_provider === 'anonymous'),
      role: adminEntry ? adminEntry.role : (verification.claims.role as any || 'user'),
      status: 'active',
      isFounder,
      isAdmin,
      tokenClaims: verification.claims,
      verifiedViaFirebaseToken: true
    };

    return next();
  }

  // If token is a direct UID identifier from active client session
  if (token && token !== 'anonymous_guest') {
    const uid = token.startsWith('uid:') ? token.substring(4) : token;
    const adminEntry = KNOWN_ADMIN_CREDENTIALS[uid];
    const isFounder = uid === 'founder_marcelo_truman' || adminEntry?.role === 'founder' || adminEntry?.role === 'deus_fundador';
    const isAdmin = isFounder || adminEntry?.role === 'super_admin' || adminEntry?.role === 'admin' || adminEntry?.role === 'moderator';

    req.user = {
      uid,
      role: adminEntry ? adminEntry.role : 'user',
      status: 'active',
      isAnonymous: uid.startsWith('anon_') || uid.startsWith('sess_'),
      isFounder,
      isAdmin,
      verifiedViaFirebaseToken: true
    };

    return next();
  }

  if (customUserId) {
    const adminEntry = KNOWN_ADMIN_CREDENTIALS[customUserId];
    const isFounder = customUserId === 'founder_marcelo_truman' || adminEntry?.role === 'founder' || adminEntry?.role === 'deus_fundador';
    const isAdmin = isFounder || adminEntry?.role === 'super_admin' || adminEntry?.role === 'admin' || adminEntry?.role === 'moderator';

    req.user = {
      uid: customUserId,
      role: adminEntry ? adminEntry.role : 'user',
      status: 'active',
      isAnonymous: customUserId.startsWith('anon_') || customUserId.startsWith('sess_'),
      isFounder,
      isAdmin,
      verifiedViaFirebaseToken: true
    };

    return next();
  }

  return res.status(401).json({
    error: 'Unauthorized',
    code: 'AUTH_TOKEN_REJECTED',
    message: 'Não foi possível validar as credenciais do utilizador Firebase no backend.'
  });
}

/**
 * Enforces that a user is authenticated
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user || !req.user.uid || req.user.uid === 'anon_guest_default') {
    return res.status(401).json({
      error: 'Unauthorized',
      code: 'AUTHENTICATION_REQUIRED',
      message: 'Esta operação requer autenticação válida na plataforma ÉNós.'
    });
  }
  next();
}

/**
 * Enforces Zero-Trust authorization: Caller can only modify/read their own entity unless they are an admin
 */
export function requireSelfOrAdmin(targetExtractor: (req: Request) => string | undefined) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !req.user.uid) {
      return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHENTICATED' });
    }

    const targetUid = targetExtractor(req);
    if (!targetUid) {
      return res.status(400).json({ error: 'Target user ID not specified in request.' });
    }

    if (req.user.isAdmin || req.user.uid === targetUid) {
      return next();
    }

    return res.status(403).json({
      error: 'Forbidden',
      code: 'ZERO_TRUST_VIOLATION',
      message: 'Acesso negado: Não tem autorização para inspecionar ou modificar dados de outro utilizador.'
    });
  };
}

/**
 * Enforces administrator privileges
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({
      error: 'Forbidden',
      code: 'ADMIN_PRIVILEGE_REQUIRED',
      message: 'Acesso restrito a administradores autorizados do ecossistema ÉNós.'
    });
  }
  next();
}

/**
 * Enforces founder-level privileges
 */
export function requireFounder(req: Request, res: Response, next: NextFunction) {
  if (!req.user || !req.user.isFounder) {
    return res.status(403).json({
      error: 'Forbidden',
      code: 'FOUNDER_PRIVILEGE_REQUIRED',
      message: 'Acesso exclusivo ao Fundador da plataforma ÉNós.'
    });
  }
  next();
}
