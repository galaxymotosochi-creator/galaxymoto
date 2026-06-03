// Сохранение ответа менеджера в Firestore при получении webhook от Telegram
const BOT_TOKEN = '8925596177:AAFUVMJH2I2X6BIAA1KTcRuEUrOGB9ILGQY';
const FIREBASE_PROJECT = 'capsulehouse-1c0c9';

let admin;
try { admin = require('firebase-admin'); } catch(e) {}

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
    const { visitorId, text, managerName } = req.body;
    
    if (!visitorId || !text) {
      return res.status(400).json({ error: 'visitorId and text required' });
    }

    let result;
    
    // Попытка через Firebase Admin SDK
    if (admin && admin.apps.length === 0) {
      try {
        admin.initializeApp({ projectId: FIREBASE_PROJECT });
      } catch(e) {}
    }
    
    if (admin && admin.apps.length > 0) {
      const db = admin.firestore();
      const msg = {
        role: 'manager',
        text: text,
        managerName: managerName || 'Менеджер',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      await db.collection('chat_messages').doc(visitorId).collection('messages').add(msg);
      result = 'written via admin';
    } else {
      // Fallback: без авторизации не получится
      result = 'admin not available';
    }

    // Подтверждаем Telegram, что обработали
    res.json({ ok: true, result });
  } catch (e) {
    console.error('Chat reply error:', e);
    res.status(500).json({ error: e.message });
  }
}
