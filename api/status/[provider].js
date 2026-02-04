// Provider status check
export default async function handler(req, res) {
  const { provider } = req.query;

  try {
    if (provider === 'gemini') {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.json({ available: false, reason: 'API key not configured' });
      }
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
      );
      return res.json({ available: response.ok });

    } else if (provider === 'groq') {
      const apiKey = process.env.GROQ_API_KEY;
      if (!apiKey) {
        return res.json({ available: false, reason: 'API key not configured' });
      }
      const response = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      return res.json({ available: response.ok });

    } else if (provider === 'ollama') {
      // Ollama is local-only, not available in production
      return res.json({ available: false, reason: 'Ollama is local-only' });

    } else {
      return res.json({ available: false, reason: 'Unknown provider' });
    }
  } catch (error) {
    res.json({ available: false, reason: 'Connection failed' });
  }
}
