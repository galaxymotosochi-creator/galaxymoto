// Создание заявки через AI-парсинг сообщения мастера
import { createHash } from 'crypto';

const API_KEY = 'AIzaSyAY_1e66dxHKq46HhUVRo8x1yB7ZbyPJzc';
const PROJECT_ID = 'capsulehouse-1c0c9';
const FIRESTORE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

function toFirestoreValue(val) {
  if (typeof val === 'number') return { integerValue: String(Math.round(val)) };
  if (typeof val === 'boolean') return { booleanValue: val };
  return { stringValue: String(val) };
}

function toFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null) fields[k] = toFirestoreValue(v);
  }
  return { fields };
}

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
    const { text, masterName, chatId } = req.body;
    if (!text) return res.status(400).json({ error: 'Text required' });

    // AI-парсинг через DeepSeek
    let client = '', work = '', date = '', time = '';
    
    const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || 'sk-6490952906544f3b85771c4ee1dccbaa';
    
    try {
      const aiResp = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DEEPSEEK_KEY}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{
            role: 'system',
            content: `Извлеки из сообщения мастера: клиент, работа, дата, время. 
Ответь ТОЛЬКО JSON: {"client":"","work":"","date":"","time":""}
Если дата не указана — поставь пустую строку. Если "завтра" — вычисли дату.
Если "сегодня" или нет даты — тоже пустая строка.
Сегодняшняя дата: ${new Date().toISOString().slice(0,10)}`,
          }, {
            role: 'user',
            content: text,
          }],
          temperature: 0,
        }),
      });
      const aiData = await aiResp.json();
      const aiText = aiData.choices?.[0]?.message?.content || '';
      try {
        const parsed = JSON.parse(aiText.replace(/```json|```/g, '').trim());
        client = parsed.client || '';
        work = parsed.work || '';
        date = parsed.date || '';
        time = parsed.time || '';
      } catch(e) {
        console.error('AI parse error:', aiText);
      }
    } catch(e) {
      console.error('AI call error:', e);
    }

    // Fallback: простой разбор
    if (!client && !work) {
      const parts = text.split(/[,;]/).map(s => s.trim()).filter(Boolean);
      client = parts[0] || '—';
      work = parts.slice(1).join(', ') || text;
    }

    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const ticketId = 'S' + Date.now().toString(36).toUpperCase();

    const ticketData = {
      id: ticketId,
      client: client || '—',
      work: work || text,
      date: date || today,
      time: time || now.toLocaleTimeString('ru-RU', {hour:'2-digit',minute:'2-digit'}),
      status: 'Новая',
      masterName: masterName || 'Мастер',
      source: 'telegram_bot',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      originalText: text,
    };

    // Сохраняем в Firestore через REST API
    const docUrl = `${FIRESTORE_URL}/galaxymoto_bookings?documentId=${ticketId}&key=${API_KEY}`;
    
    const fireResp = await fetch(docUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toFields(ticketData)),
    });

    const fireResult = await fireResp.json();
    
    if (!fireResp.ok) {
      console.error('Firestore error:', fireResult);
      return res.status(500).json({ error: 'Firestore write failed' });
    }

    res.json({
      ok: true,
      ticketId,
      client: ticketData.client,
      work: ticketData.work,
      date: ticketData.date,
      time: ticketData.time,
    });

  } catch (e) {
    console.error('Create ticket error:', e);
    res.status(500).json({ error: e.message });
  }
}
