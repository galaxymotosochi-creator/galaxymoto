// Обновление статуса заявки
const API_KEY = 'AIzaSyAY_1e66dxHKq46HhUVRo8x1yB7ZbyPJzc';
const PROJECT_ID = 'capsulehouse-1c0c9';
const FIRESTORE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { ticketId, status, masterName } = req.body;
    if (!ticketId || !status) {
      return res.status(400).json({ error: 'ticketId and status required' });
    }

    const updateUrl = `${FIRESTORE_URL}/galaxymoto_bookings/${ticketId}?key=${API_KEY}`;
    
    // Читаем текущий документ
    const getResp = await fetch(updateUrl);
    if (!getResp.ok) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const existing = await getResp.json();
    const currentStatus = existing.fields?.status?.stringValue || '';
    
    // Обновляем только статус
    const updateResp = await fetch(updateUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          status: { stringValue: status },
          updatedAt: { stringValue: new Date().toISOString() },
          masterName: { stringValue: masterName || currentStatus },
        }
      }),
    });

    if (!updateResp.ok) {
      const err = await updateResp.json();
      return res.status(500).json({ error: 'Failed to update' });
    }

    res.json({ ok: true, ticketId, status });
  } catch (e) {
    console.error('Update status error:', e);
    res.status(500).json({ error: e.message });
  }
}
