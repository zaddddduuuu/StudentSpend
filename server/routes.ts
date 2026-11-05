import { Router, Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import {
  connectDB,
  getDbStatus,
  findUserById,
  findUserByIdv,
  saveUser,
  deleteUser,
  getUserData,
  saveUserData,
  UserDoc,
} from './db.js';

export const apiRouter = Router();

let aiClient: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI | null {
  if (aiClient) return aiClient;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') return null;
  aiClient = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
  return aiClient;
}

// Health & Database status endpoint
apiRouter.get('/status', async (_req: Request, res: Response) => {
  const status = getDbStatus();
  res.json({
    ok: true,
    app: 'StudentSpend Backend API',
    database: status,
    hasAiKey: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'),
    timestamp: new Date().toISOString(),
  });
});

// Trigger database reconnection (useful after updating MONGODB_URI in Render)
apiRouter.post('/status/reconnect', async (_req: Request, res: Response) => {
  const connected = await connectDB();
  const status = getDbStatus();
  res.json({
    ok: true,
    connected,
    database: status,
  });
});

// Authentication - Sign Up
apiRouter.post('/auth/signup', async (req: Request, res: Response) => {
  try {
    const { id, name, idt, idv, salt, hash, rs, rh, at } = req.body;
    if (!id || !name || !idv || !hash || !salt) {
      return res.status(400).json({ ok: false, error: 'Missing required user fields' });
    }

    const existing = await findUserByIdv(idv);
    if (existing) {
      return res.status(409).json({ ok: false, error: 'An account with this email, number or user ID already exists.' });
    }

    const userDoc: UserDoc = {
      id,
      name,
      idt,
      idv,
      salt,
      hash,
      rs,
      rh,
      at: at || Date.now(),
    };

    await saveUser(userDoc);
    res.json({ ok: true, user: { id, name, idt, idv } });
  } catch (error: any) {
    console.error('[API] Signup error:', error);
    res.status(500).json({ ok: false, error: error.message || 'Server error' });
  }
});

// Authentication - Check/Sign In
apiRouter.post('/auth/signin', async (req: Request, res: Response) => {
  try {
    const { idv } = req.body;
    if (!idv) {
      return res.status(400).json({ ok: false, error: 'User identifier required' });
    }

    const user = await findUserByIdv(idv);
    if (!user) {
      return res.status(404).json({ ok: false, error: 'User not found' });
    }

    // Return the user salt and hash so client can verify PBKDF2 securely
    res.json({
      ok: true,
      user: {
        id: user.id,
        name: user.name,
        idt: user.idt,
        idv: user.idv,
        salt: user.salt,
        hash: user.hash,
        rh: user.rh,
        rs: user.rs,
      },
    });
  } catch (error: any) {
    console.error('[API] Signin error:', error);
    res.status(500).json({ ok: false, error: error.message || 'Server error' });
  }
});

// Authentication - Update Recovery Code or Reset Password
apiRouter.post('/auth/update-auth', async (req: Request, res: Response) => {
  try {
    const { id, hash, salt, rs, rh } = req.body;
    if (!id) return res.status(400).json({ ok: false, error: 'User ID required' });

    const user = await findUserById(id);
    if (!user) return res.status(404).json({ ok: false, error: 'User not found' });

    if (hash) user.hash = hash;
    if (salt) user.salt = salt;
    if (rs) user.rs = rs;
    if (rh) user.rh = rh;

    await saveUser(user);
    res.json({ ok: true });
  } catch (error: any) {
    console.error('[API] Update auth error:', error);
    res.status(500).json({ ok: false, error: error.message || 'Server error' });
  }
});

// Authentication - Erase Account
apiRouter.post('/auth/erase', async (req: Request, res: Response) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ ok: false, error: 'User ID required' });

    await deleteUser(id);
    res.json({ ok: true, message: 'Account and data erased from database' });
  } catch (error: any) {
    console.error('[API] Erase error:', error);
    res.status(500).json({ ok: false, error: error.message || 'Server error' });
  }
});

// Get Financial Data for a user
apiRouter.get('/data', async (req: Request, res: Response) => {
  try {
    const userId = (req.query.userId as string) || (req.headers['x-user-id'] as string);
    if (!userId) {
      return res.status(400).json({ ok: false, error: 'userId query or X-User-Id header required' });
    }

    const data = await getUserData(userId);
    res.json({ ok: true, data: data || null });
  } catch (error: any) {
    console.error('[API] Get data error:', error);
    res.status(500).json({ ok: false, error: error.message || 'Server error' });
  }
});

// Save / Sync Financial Data for a user
apiRouter.post('/data', async (req: Request, res: Response) => {
  try {
    const { userId, data } = req.body;
    if (!userId || !data) {
      return res.status(400).json({ ok: false, error: 'userId and data are required' });
    }

    await saveUserData(userId, data);
    res.json({ ok: true, updatedAt: Date.now() });
  } catch (error: any) {
    console.error('[API] Save data error:', error);
    res.status(500).json({ ok: false, error: error.message || 'Server error' });
  }
});

// AI Financial Advice Endpoint (Gemini 3.8 Flash)
apiRouter.post('/ai/ask', async (req: Request, res: Response) => {
  try {
    const { question, context } = req.body;
    if (!question) {
      return res.status(400).json({ ok: false, error: 'Question is required' });
    }

    const ai = getAiClient();
    if (!ai) {
      return res.json({
        ok: true,
        source: 'local_fallback',
        text: null,
      });
    }

    const contextStr = typeof context === 'object' ? JSON.stringify(context, null, 2) : String(context || '');
    const prompt = `You are a supportive, practical financial coach for a college or university student.
Use ONLY the financial context provided below. Never invent arbitrary numbers. If data is missing or incomplete, mention it honestly.
Answer in under 150 words in plain, encouraging language. Use the Indian Rupee symbol (₹) for currency amounts. Provide practical actions the student can take.

FINANCIAL CONTEXT:
${contextStr}

QUESTION FROM STUDENT:
"${question}"`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
    });

    res.json({
      ok: true,
      source: 'gemini',
      text: response.text || '',
    });
  } catch (error: any) {
    console.error('[API] AI ask error:', error?.message || error);
    res.json({
      ok: true,
      source: 'local_fallback',
      text: null,
      error: error?.message,
    });
  }
});

// AI Categorization Endpoint
apiRouter.post('/ai/categorize', async (req: Request, res: Response) => {
  try {
    const { desc, categories } = req.body;
    if (!desc) {
      return res.status(400).json({ ok: false, error: 'Description is required' });
    }

    const ai = getAiClient();
    if (!ai) {
      return res.json({ ok: true, source: 'keywords', category: null });
    }

    const cats = Array.isArray(categories) && categories.length ? categories.join(', ') : 'Food, Education, Transport, Bills, Shopping, Entertainment, Health, Other';
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `Pick the single best category for this transaction description: "${desc}". Allowed categories: [${cats}]. Return ONLY the exact category name and nothing else.`,
    });

    const category = (response.text || '').trim().replace(/[.\s]+$/, '');
    res.json({
      ok: true,
      source: 'gemini',
      category: category || null,
    });
  } catch (error: any) {
    console.error('[API] AI categorize error:', error?.message || error);
    res.json({ ok: true, source: 'keywords', category: null });
  }
});
