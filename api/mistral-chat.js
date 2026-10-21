export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: { message: 'method_not_allowed' } });
  }

  const body = req.body || {};
  const apiKey = String(body.apiKey || process.env.MISTRAL_API_KEY || '').trim();
  const model = String(body.model || 'mistral-small-latest').trim();
  const temperature = Number(body.temperature ?? 0.7);
  const messages = Array.isArray(body.messages) ? body.messages : [];

  if (!apiKey) {
    return res.status(400).json({ error: { message: 'missing_mistral_api_key' } });
  }
  if (!messages.length) {
    return res.status(400).json({ error: { message: 'messages_required' } });
  }

  try {
    const upstream = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        temperature: Number.isFinite(temperature) ? temperature : 0.7,
        messages
      })
    });
    const payload = await upstream.json();
    return res.status(upstream.status).json(payload);
  } catch (error) {
    return res.status(500).json({ error: { message: error?.message || 'mistral_proxy_failed' } });
  }
}
