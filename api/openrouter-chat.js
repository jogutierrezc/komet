export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: { message: 'Method not allowed' } });
    return;
  }

  const body = req.body || {};
  const apiKey = String(body.apiKey || '').trim();
  const model = String(body.model || '').trim();
  const temperature = Number.isFinite(Number(body.temperature)) ? Number(body.temperature) : 0.7;
  const messages = Array.isArray(body.messages) ? body.messages : [];

  if (!apiKey) {
    res.status(400).json({ error: { message: 'missing_openrouter_api_key' } });
    return;
  }

  if (!model) {
    res.status(400).json({ error: { message: 'missing_model' } });
    return;
  }

  if (!messages.length) {
    res.status(400).json({ error: { message: 'missing_messages' } });
    return;
  }

  try {
    const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': req.headers.origin || req.headers.referer || 'https://komet.local',
        'X-Title': 'Komet'
      },
      body: JSON.stringify({
        model,
        temperature,
        messages
      })
    });

    const contentType = upstream.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const payload = await upstream.json();
      res.status(upstream.status).json(payload);
      return;
    }

    const text = await upstream.text();
    res.status(upstream.status).send(text);
  } catch (error) {
    res.status(500).json({ error: { message: error?.message || 'openrouter_proxy_failed' } });
  }
}
