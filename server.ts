import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import {
  explainCompatibility,
  assistBioCreation,
  assistConversationIcebreaker,
  moderateContent
} from './src/services/ai';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Health check endpoint (Observabilidade - 4.38)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'ÉNós - CPLP Relacionamentos',
    version: '1.0.0',
    timestamp: Date.now()
  });
});

// AI Match Insights Endpoint (4.25.1)
app.post('/api/ai/compatibility', async (req, res) => {
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
});

// AI Bio Assist Endpoint (4.25.2)
app.post('/api/ai/bio-assist', async (req, res) => {
  try {
    const { interests, intent, countryName, cityName } = req.body;
    const bio = await assistBioCreation(interests || [], intent || '', countryName || '', cityName || '');
    res.json({ bio });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate bio assist' });
  }
});

// AI Conversation Icebreaker Endpoint (4.25.3)
app.post('/api/ai/icebreakers', async (req, res) => {
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
});

// AI Moderation Endpoint (4.25.4)
app.post('/api/moderation/check', async (req, res) => {
  try {
    const { text } = req.body;
    const result = await moderateContent(text || '');
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to check moderation' });
  }
});

// PONTO 3: Backend Trust Graph Policies & Evaluation Endpoints
app.get('/api/trust/policies', (req, res) => {
  const policies = {
    identity_verified: {
      badgeType: 'identity_verified',
      title: 'Identidade Verificada',
      criteriaSummary: 'Prova oficial de documento governamental ou biometria liveness; 0 violações.',
      dignityGuaranteed: true
    },
    authentic_profile: {
      badgeType: 'authentic_profile',
      title: 'Perfil Autêntico',
      criteriaSummary: 'Bio expressiva (>30 chars), múltiplas fotos genuínas e transparência cultural.',
      dignityGuaranteed: true
    },
    trusted_member: {
      badgeType: 'trusted_member',
      title: 'Membro Confiável',
      criteriaSummary: 'Permanência ativa ≥ 7 dias, histórico limpo e zero incidentes de segurança.',
      dignityGuaranteed: true
    },
    respectful_dialogue: {
      badgeType: 'respectful_dialogue',
      title: 'Diálogo Respeitoso',
      criteriaSummary: 'Múltiplas conversas com reciprocidade comprovada e zero denúncias aceites.',
      dignityGuaranteed: true
    },
    active_presence: {
      badgeType: 'active_presence',
      title: 'Presença Ativa',
      criteriaSummary: 'Atividade e prontidão recente na comunidade CPLP.',
      dignityGuaranteed: true
    }
  };
  res.json({ policies });
});

app.post('/api/trust/evaluate', (req, res) => {
  try {
    const { profile, evidences, signals, confirmedSafetyViolations, activeDisputes } = req.body;
    if (!profile || !profile.uid) {
      return res.status(400).json({ error: 'Missing profile object or uid' });
    }

    const violations = confirmedSafetyViolations || 0;
    const disputes = activeDisputes || 0;
    const validEvidences = Array.isArray(evidences) ? evidences : [];

    const hasVerifiedId = profile.verificationStatus === 'verified' || validEvidences.some((e: any) => e.type === 'national_id_verification' || e.type === 'passport_verification');
    const isAuthentic = Boolean(profile.bio && profile.bio.trim().length >= 30 && profile.photos && profile.photos.length >= 2);
    const accountAgeDays = Math.max(1, Math.floor((Date.now() - (profile.createdAt || Date.now() - 86400000 * 14)) / (1000 * 60 * 60 * 24)));
    const hasTenure = accountAgeDays >= 7 && violations === 0 && disputes === 0;
    const hasDialogue = (signals?.conversations || 0) >= 1 && violations === 0 && disputes === 0;

    const badges = [];

    if (hasVerifiedId && violations === 0) {
      badges.push({
        type: 'identity_verified',
        label: 'Identidade Verificada',
        description: 'Identidade e titularidade do perfil validadas de forma segura',
        iconName: 'ShieldCheck',
        issuedByAuthority: 'Autoridade de Verificação CPLP',
        grantedAt: profile.createdAt || Date.now()
      });
    }

    if (isAuthentic && violations === 0) {
      badges.push({
        type: 'authentic_profile',
        label: 'Perfil Autêntico',
        description: 'Apresentação genuína, transparente e contextualizada na comunidade',
        iconName: 'Sparkles',
        issuedByAuthority: 'Motor de Autenticidade ÉNós',
        grantedAt: profile.createdAt || Date.now()
      });
    }

    if (hasTenure) {
      badges.push({
        type: 'trusted_member',
        label: 'Membro Confiável',
        description: 'Histórico consistente de respeito e integridade na comunidade CPLP',
        iconName: 'UserCheck',
        issuedByAuthority: 'Conselho de Confiabilidade CPLP',
        grantedAt: profile.createdAt || Date.now()
      });
    }

    if (hasDialogue) {
      badges.push({
        type: 'respectful_dialogue',
        label: 'Diálogo Respeitoso',
        description: 'Reconhecido por conduta respeitosa, acolhedora e recíproca',
        iconName: 'HeartHandshake',
        issuedByAuthority: 'Observatório de Diálogo ÉNós',
        grantedAt: profile.createdAt || Date.now()
      });
    }

    if (profile.online && violations === 0) {
      badges.push({
        type: 'active_presence',
        label: 'Presença Ativa',
        description: 'Membro com prontidão e participação recente na comunidade',
        iconName: 'Zap',
        issuedByAuthority: 'Presença Ativa Lusofonia',
        grantedAt: Date.now()
      });
    }

    res.json({
      userId: profile.uid,
      badges,
      evaluatedAt: Date.now(),
      evaluatorAuthority: 'enos_backend_trust_engine'
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to evaluate trust graph' });
  }
});

// Serve frontend in dev (via vite middleware) or static in production
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
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ÉNós CPLP Server running on http://0.0.0.0:${PORT}`);
  });
}

initServer();
