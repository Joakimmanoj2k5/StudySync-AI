import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// API Keys from environment variables
const API_KEYS = {
  gemini: process.env.GEMINI_API_KEY || '',
  groq: process.env.GROQ_API_KEY || ''
};

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from dist folder (production build)
app.use(express.static(path.join(__dirname, 'dist')));

// ============================================================================
// API Proxy Endpoints - Keep API keys secure on server
// ============================================================================

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Gemini API Proxy
app.post('/api/gemini/generate', async (req, res) => {
  try {
    const { prompt, model = 'gemini-2.0-flash' } = req.body;
    
    if (!API_KEYS.gemini) {
      return res.status(500).json({ error: 'Gemini API key not configured' });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEYS.gemini}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4096,
          responseMimeType: 'application/json'
        }
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return res.status(response.status).json({ 
        error: `Gemini API error: ${error.error?.message || response.statusText}` 
      });
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    res.json({ text });
    
  } catch (error) {
    console.error('[Gemini] Error:', error);
    res.status(500).json({ error: 'Failed to call Gemini API' });
  }
});

// Groq API Proxy
app.post('/api/groq/generate', async (req, res) => {
  try {
    const { prompt, model = 'llama-3.3-70b-versatile' } = req.body;
    
    if (!API_KEYS.groq) {
      return res.status(500).json({ error: 'Groq API key not configured' });
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEYS.groq}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert educator that generates study materials. Always respond with valid JSON only.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 4096,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return res.status(response.status).json({ 
        error: `Groq API error: ${error.error?.message || response.statusText}` 
      });
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';
    res.json({ text });
    
  } catch (error) {
    console.error('[Groq] Error:', error);
    res.status(500).json({ error: 'Failed to call Groq API' });
  }
});

// Check provider status
app.get('/api/status/:provider', async (req, res) => {
  const { provider } = req.params;
  
  try {
    if (provider === 'gemini') {
      if (!API_KEYS.gemini) {
        return res.json({ available: false, reason: 'API key not configured' });
      }
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEYS.gemini}`
      );
      res.json({ available: response.ok });
      
    } else if (provider === 'groq') {
      if (!API_KEYS.groq) {
        return res.json({ available: false, reason: 'API key not configured' });
      }
      const response = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { 'Authorization': `Bearer ${API_KEYS.groq}` }
      });
      res.json({ available: response.ok });
      
    } else if (provider === 'ollama') {
      // Ollama is local-only, not available in production
      res.json({ available: false, reason: 'Ollama is local-only' });
      
    } else {
      res.json({ available: false, reason: 'Unknown provider' });
    }
  } catch (error) {
    res.json({ available: false, reason: 'Connection failed' });
  }
});

// SPA fallback - serve index.html for all other routes
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ StudySync server running on port ${PORT}`);
  console.log(`   Gemini API: ${API_KEYS.gemini ? 'Configured' : 'Not configured'}`);
  console.log(`   Groq API: ${API_KEYS.groq ? 'Configured' : 'Not configured'}`);
});
