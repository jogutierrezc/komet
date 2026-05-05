export default async function handler(req, res) {
  res.status(200).json({
    ok: true,
    service: 'komet-api',
    timestamp: new Date().toISOString()
  });
}
