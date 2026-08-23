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
