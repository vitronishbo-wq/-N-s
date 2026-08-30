import express, { Request, Response } from 'express';
import path from 'path';
import dotenv from 'dotenv';
import {
  explainCompatibility,
  assistBioCreation,
  assistConversationIcebreaker
} from './src/services/ai';
import {
  authenticate,
  validateFirebaseIdToken,
  requireAuth,
  requireSelfOrAdmin,
  requireAdmin,
  requireFounder
} from './src/server/authMiddleware';
import { trustAuthority, SERVER_TRUST_POLICIES } from './src/server/trustAuthority';
import { mcrAuthority } from './src/server/mcrAuthority';
import { moderationAuthority } from './src/server/moderationAuthority';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Global Authentication Middleware (Extracts Bearer Token, Session, and User Identity)
app.use(authenticate);

// ============================================================================
// 1. HEALTH & OBSERVABILITY ENDPOINT (Public)
// ============================================================================
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    app: 'ÉNós - CPLP Relacionamentos',
    version: '2.0.0',
    backendAuthority: 'ACTIVE_ZERO_TRUST_BOUNDARY',
    timestamp: Date.now(),
    authenticatedUser: req.user ? {
      uid: req.user.uid,
      role: req.user.role,
      isAdmin: req.user.isAdmin,
      verifiedViaFirebaseToken: Boolean(req.user.verifiedViaFirebaseToken)
    } : null
  });
});

// ============================================================================
// 2. TRUST GRAPH BACKEND AUTHORITY ENDPOINTS (Zero-Trust + Firebase Token Auth)
// ============================================================================

// Formal Public Eligibility Policies
app.get('/api/trust/policies', (req: Request, res: Response) => {
  res.json({ policies: SERVER_TRUST_POLICIES });
});

// Submit Evidence to Independent Verification Pipeline (Sensitive: Validates Firebase ID Token + Self/Admin)
app.post(
  '/api/trust/evidences/submit',
  validateFirebaseIdToken,
  requireAuth,
  requireSelfOrAdmin(req => req.body?.userId),
  (req: Request, res: Response) => {
    try {
      const payload = req.body;
      if (!payload || !payload.userId || !payload.evidenceType) {
        return res.status(400).json({ error: 'Missing userId or evidenceType in payload' });
      }

      const result = trustAuthority.submitAndVerifyEvidence(payload);
      if (!result.success) {
        return res.status(422).json({
          error: 'Evidence verification failed',
          message: result.error || 'Submissão de evidência rejeitada pela autoridade independente.'
        });
      }

      res.status(201).json({
        success: true,
        evidence: result.evidenceRecord
      });
    } catch (error) {
      console.error('Trust evidence submission error:', error);
      res.status(500).json({ error: 'Failed to process evidence verification submission' });
    }
  }
);

// Retrieve Verified Immutable Evidences for User (Sensitive: Validates Firebase Token + Self/Admin)
app.get(
  '/api/trust/evidences/:userId',
  validateFirebaseIdToken,
  requireAuth,
  requireSelfOrAdmin(req => req.params.userId),
  (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const evidences = trustAuthority.getImmutableEvidences(userId);
      res.json({
        userId,
        count: evidences.length,
        evidences
      });
    } catch (error) {
      console.error('Get immutable evidences error:', error);
      res.status(500).json({ error: 'Failed to retrieve verified immutable evidences' });
    }
  }
);

// Admin Manual Evidence Verification / Clearance (Sensitive: Firebase Token + Admin Role)
app.post(
  '/api/trust/evidences/verify-admin',
  validateFirebaseIdToken,
  requireAuth,
  requireAdmin,
  (req: Request, res: Response) => {
    try {
      const { requestId, approved, justification } = req.body;
      if (!requestId) {
        return res.status(400).json({ error: 'Missing requestId' });
      }

      const result = trustAuthority.adminVerifyRequest({
        requestId,
        adminUid: req.user!.uid,
        approved: Boolean(approved),
        justification: justification || 'Auditado pela moderação CPLP'
      });

      if (!result.success) {
        return res.status(404).json({ error: result.error || 'Request not found' });
      }

      res.json({
        success: true,
        evidence: result.evidence
      });
    } catch (error) {
      console.error('Admin verification error:', error);
      res.status(500).json({ error: 'Failed to process admin verification request' });
    }
  }
);

// Fetch Pending Verification Requests (Admin Role)
app.get(
  '/api/trust/verification-requests',
  validateFirebaseIdToken,
  requireAuth,
  requireAdmin,
  (req: Request, res: Response) => {
    try {
      const requests = trustAuthority.getPendingVerificationRequests();
      res.json({ requests });
    } catch (error) {
      res.status(500).json({ error: 'Failed to retrieve verification requests' });
    }
  }
);

// Formal Server-Side Trust Evaluation
// Evaluates ONLY against verified immutable evidence ledger, server MCR interaction logs, and safety records.
app.post(
  '/api/trust/evaluate',
  validateFirebaseIdToken,
  requireAuth,
  requireSelfOrAdmin(req => req.body?.userId || req.body?.profile?.uid || req.user?.uid),
  (req: Request, res: Response) => {
    try {
      const targetUserId = req.body?.userId || req.body?.profile?.uid || req.user!.uid;
      if (!targetUserId) {
        return res.status(400).json({ error: 'Missing target userId' });
      }

      // If client supplied profile info, sync server-side canonical profile representation
      if (req.body?.profile && req.body.profile.uid) {
        trustAuthority.registerCanonicalProfile(req.body.profile);
      }

      // Execute evaluation entirely from server-authoritative state
      const evaluation = trustAuthority.evaluate(targetUserId);

      res.json(evaluation);
    } catch (error) {
      console.error('Trust authority evaluation error:', error);
      res.status(500).json({ error: 'Failed to evaluate trust graph authority' });
    }
  }
);

// Public Verified Badges Endpoint for Profile Cards & Discovery
app.get('/api/trust/profile/:uid/badges', (req: Request, res: Response) => {
  try {
    const { uid } = req.params;
    const evaluation = trustAuthority.evaluate(uid);
    res.json({
      userId: uid,
      badges: evaluation.badges,
      evaluatedAt: evaluation.evaluatedAt,
      evaluatorAuthority: evaluation.evaluatorAuthority,
      signature: evaluation.signature,
      signalsSummary: {
        identityLevel: evaluation.signalsSummary.identityLevel,
        authenticityLevel: evaluation.signalsSummary.authenticityLevel,
        safetyTenureDays: evaluation.signalsSummary.safetyTenureDays
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch public trust badges' });
  }
});

// ============================================================================
// 3. MCR FUNNEL & AUDIT TRAIL ENDPOINTS (Sensitive: Validates Firebase ID Token)
// ============================================================================

// Ingest Audited Funnel Transition Event (Protected: Validates Firebase token + User can only log events for self)
app.post(
  '/api/mcr/events',
  validateFirebaseIdToken,
  requireAuth,
  requireSelfOrAdmin(req => req.body?.userId),
  (req: Request, res: Response) => {
    try {
      const payload = req.body;
      if (!payload || !payload.userId || !payload.targetUid || !payload.stage) {
        return res.status(400).json({
          error: 'Missing required fields: userId, targetUid, and stage are mandatory'
        });
      }

      const context = {
        ipOrOrigin: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1',
        userAgent: req.headers['user-agent'] || 'unknown',
        environment: process.env.NODE_ENV || 'production',
        sessionId: req.user?.sessionId
      };

      const auditedEvent = mcrAuthority.validateAndLogEvent(payload, context);
      res.status(201).json({
        success: true,
        event: auditedEvent
      });
    } catch (error: any) {
      console.error('MCR Event Log Error:', error);
      res.status(400).json({
        error: 'Failed to record audited MCR transition event',
        message: error?.message || String(error)
      });
    }
  }
);

// Batch Funnel Events Ingestion (Sensitive: Validates Firebase ID Token)
app.post(
  '/api/mcr/batch',
  validateFirebaseIdToken,
  requireAuth,
  (req: Request, res: Response) => {
    try {
      const { events } = req.body;
      if (!Array.isArray(events)) {
        return res.status(400).json({ error: 'Payload must contain an "events" array' });
      }

      const callerUid = req.user!.uid;
      const isCallerAdmin = req.user!.isAdmin;

      const context = {
        ipOrOrigin: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1',
        userAgent: req.headers['user-agent'] || 'unknown',
        environment: process.env.NODE_ENV || 'production',
        sessionId: req.user?.sessionId
      };

      const processed = [];
      for (const ev of events) {
        // Enforce that regular user cannot spoof events for other users
        if (!isCallerAdmin && ev.userId !== callerUid) {
          continue;
        }
        try {
          const audited = mcrAuthority.validateAndLogEvent(ev, context);
          processed.push(audited);
        } catch {}
      }

      res.status(201).json({
        success: true,
        count: processed.length,
        events: processed
      });
    } catch (error) {
      console.error('MCR Batch Log Error:', error);
      res.status(500).json({ error: 'Failed to record batch MCR transition events' });
    }
  }
);

// Query Audited MCR Events (Sensitive: Validates Firebase ID Token)
app.get(
  '/api/mcr/audit',
  validateFirebaseIdToken,
  requireAuth,
  (req: Request, res: Response) => {
    try {
      const { userId, targetUid, stage, origin, timeframe, limit: limitParam } = req.query;
      const callerUid = req.user!.uid;
      const isCallerAdmin = req.user!.isAdmin;

      const events = mcrAuthority.queryAuditLogs({
        userId: userId as string | undefined,
        targetUid: targetUid as string | undefined,
        stage: stage as any,
        origin: origin as string | undefined,
        timeframe: (timeframe as '7d' | '30d' | 'all') || '7d',
        limitCount: limitParam ? parseInt(limitParam as string, 10) : 100
      }, callerUid, isCallerAdmin);

      res.json({
        success: true,
        count: events.length,
        events
      });
    } catch (error) {
      console.error('MCR Audit Query Error:', error);
      res.status(500).json({ error: 'Failed to query audited MCR events' });
    }
  }
);

// MCR Metrics Calculation (Sensitive: Validates Firebase ID Token + Admin Authority required)
app.get(
  '/api/mcr/metrics',
  validateFirebaseIdToken,
  requireAuth,
  requireAdmin,
  (req: Request, res: Response) => {
    try {
      const { timeframe, origin } = req.query;
      const metrics = mcrAuthority.calculateMetrics(
        (timeframe as '7d' | '30d' | 'all') || '7d',
        origin as string | undefined
      );
      res.json({
        success: true,
        metrics
      });
    } catch (error) {
      console.error('MCR Metrics Error:', error);
      res.status(500).json({ error: 'Failed to calculate MCR audit metrics' });
    }
  }
);

// ============================================================================
// 4. AI & CONTENT MODERATION AUTHORITY ENDPOINTS (Sensitive: Firebase Token)
// ============================================================================

// AI Match Insights (Sensitive: Validates Firebase ID Token)
app.post(
  '/api/ai/compatibility',
  validateFirebaseIdToken,
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { myProfile, targetProfile } = req.body;
      if (!myProfile || !targetProfile) {
        return res.status(400).json({ error: 'Missing profile objects' });
      }
      const explanation = await explainCompatibility(myProfile, targetProfile);
      res.json({ explanation });
    } catch (error) {
      res.status(500).json({ error: 'Failed to generate compatibility insights' });
    }
  }
);

// AI Bio Assist (Sensitive: Validates Firebase ID Token)
app.post(
  '/api/ai/bio-assist',
  validateFirebaseIdToken,
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { interests, intent, countryName, cityName } = req.body;
      const bio = await assistBioCreation(interests || [], intent || '', countryName || '', cityName || '');
      res.json({ bio });
    } catch (error) {
      res.status(500).json({ error: 'Failed to generate bio assist' });
    }
  }
);

// AI Conversation Icebreakers (Sensitive: Validates Firebase ID Token)
app.post(
  '/api/ai/icebreakers',
  validateFirebaseIdToken,
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { sharedInterests, userACity, userBCity } = req.body;
      const icebreakers = await assistConversationIcebreaker(
        sharedInterests || [],
        userACity || 'Comunidade',
        userBCity || 'Lusofonia'
      );
      res.json({ icebreakers });
    } catch (error) {
      res.status(500).json({ error: 'Failed to generate icebreakers' });
    }
  }
);

// Content & Safety Moderation Check (Sensitive: Validates Firebase ID Token)
app.post(
  '/api/moderation/check',
  validateFirebaseIdToken,
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { text, field } = req.body;
      const result = await moderationAuthority.evaluateText(text || '', {
        userId: req.user?.uid,
        field
      });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Failed to check moderation authority' });
    }
  }
);

// ============================================================================
// 5. ADMIN & GOVERNANCE AUTHORITY ENDPOINTS (Sensitive: Firebase Token + RBAC)
// ============================================================================

app.get(
  '/api/admin/me',
  validateFirebaseIdToken,
  requireAuth,
  (req: Request, res: Response) => {
    res.json({
      user: req.user
    });
  }
);

// Founder-exclusive configuration
app.get(
  '/api/admin/founder-audit',
  validateFirebaseIdToken,
  requireAuth,
  requireFounder,
  (req: Request, res: Response) => {
    res.json({
      status: 'AUTHENTICATED_FOUNDER_PRIVILEGE',
      founderUid: req.user?.uid,
      timestamp: Date.now()
    });
  }
);

// ============================================================================
// 6. SPA & FRONTEND ASSET SERVING
// ============================================================================
async function initServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[ÉNÓS BACKEND AUTHORITY] Server running on http://0.0.0.0:${PORT}`);
  });
}

initServer();
