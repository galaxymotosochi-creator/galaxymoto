// Удаление всех тестовых заявок
const API_KEY = 'AIzaSyAY_1e66dxHKq46HhUVRo8x1yB7ZbyPJzc';
const PROJECT_ID = 'capsulehouse-1c0c9';
const FIRESTORE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    return res.status(204).end();
  }

  try {
    // Получаем все документы
    const listUrl = `${FIRESTORE_URL}/galaxymoto_bookings?key=${API_KEY}&pageSize=100`;
    const listResp = await fetch(listUrl);
    
    if (listResp.status === 429) {
      return res.json({ error: 'Quota exceeded. Try again in 1 minute.' });
    }
    
    if (!listResp.ok) {
      return res.json({ error: 'Failed to list', status: listResp.status });
    }

    const listData = await listResp.json();
    const docs = listData.documents || [];
    
    let deleted = 0;
    for (const doc of docs) {
      const docId = doc.name.split('/').pop();
      const delUrl = `${FIRESTORE_URL}/galaxymoto_bookings/${docId}?key=${API_KEY}`;
      const delResp = await fetch(delUrl, { method: 'DELETE' });
      if (delResp.ok) deleted++;
      await new Promise(r => setTimeout(r, 50)); // маленькая пауза
    }

    res.json({ ok: true, deleted, total: docs.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
