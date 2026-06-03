// Создание заявки через AI-парсинг сообщения мастера
const API_KEY = 'AIzaSyAY_1e66dxHKq46HhUVRo8x1yB7ZbyPJzc';
const PROJECT_ID = 'capsulehouse-1c0c9';
const FIRESTORE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

function toFirestoreValue(val) {
  if (typeof val === 'number') return { integerValue: String(Math.round(val)) };
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
    const { text, masterName } = req.body;
    if (!text) return res.status(400).json({ error: 'Text required' });

    // AI-парсинг через DeepSeek
    let name = '', phone = '', comment = '', date = '', time = '';
    
    const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || 'sk-6490952906544f3b85771c4ee1dccbaa';
    
    const todayStr = new Date().toISOString().slice(0, 10);

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
            content: `Ты — парсер заявок для сервиса мототехники.
Из сообщения мастера извлеки данные и верни ТОЛЬКО JSON:
{"name":"","phone":"","comment":"","date":"","time":""}

Правила:
- name — имя клиента (всегда заполнено)
- phone — номер телефона (если есть, может быть без +)
- comment — что нужно сделать (адв, замена масла, ремонт и т.д.)
- date — дата в формате ГГГГ-ММ-ДД. "завтра" = ${(() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0,10); })()}. "сегодня" или без даты = пустая строка. "15 мая" преобразуй в дату.
- time — время в формате ЧЧ:ММ (если есть)

Примеры:
"Игорь адв 15 мая 16:00" → {"name":"Игорь","phone":"","comment":"адв","date":"${new Date(new Date().getFullYear(), 4, 15).toISOString().slice(0,10)}","time":"16:00"}
"Петров +79001234567 замена цепи завтра 11:30" → {"name":"Петров","phone":"+79001234567","comment":"замена цепи","date":"${(() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0,10); })()}","time":"11:30"}
"Сергей 15:00" → {"name":"Сергей","phone":"","comment":"","date":"","time":"15:00"}
"Анна замена масла" → {"name":"Анна","phone":"","comment":"замена масла","date":"","time":""}

Сегодня: ${todayStr}
Верни ТОЛЬКО JSON, без пояснений.`,
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
        name = parsed.name || '';
        phone = parsed.phone || '';
        comment = parsed.comment || '';
        date = parsed.date || '';
        time = parsed.time || '';
      } catch(e) {
        console.error('AI parse error:', aiText);
      }
    } catch(e) {
      console.error('AI call error:', e);
    }

    // Fallback: если AI не сработал
    if (!name) {
      const parts = text.split(/[,;]/).map(s => s.trim()).filter(Boolean);
      name = parts[0] || '—';
      comment = parts.slice(1).join(', ') || text;
    }

    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const ticketId = 'S' + Date.now().toString(36).toUpperCase();

    const ticketData = {
      id: ticketId,
      name: name || '—',
      phone: phone || '',
      comment: comment || '',
      date: date || today,
      time: time || '',
      status: 'Новая',
      master: masterName || 'Из Telegram',
      source: 'telegram',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    // Сохраняем в Firestore
    const docUrl = `${FIRESTORE_URL}/galaxymoto_bookings?documentId=${ticketId}&key=${API_KEY}`;
    
    const fireResp = await fetch(docUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toFields(ticketData)),
    });

    if (!fireResp.ok) {
      const err = await fireResp.json();
      console.error('Firestore error:', err);
      return res.status(500).json({ error: 'Firestore write failed' });
    }

    res.json({
      ok: true,
      ticketId,
      name: ticketData.name,
      phone: ticketData.phone,
      comment: ticketData.comment,
      date: ticketData.date,
      time: ticketData.time,
    });

  } catch (e) {
    console.error('Create ticket error:', e);
    res.status(500).json({ error: e.message });
  }
}
