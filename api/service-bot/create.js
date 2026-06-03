// Создание заявки — мастер пишет поля построчно
const API_KEY = 'AIzaSyAY_1e66dxHKq46HhUVRo8x1yB7ZbyPJzc';
const PROJECT_ID = 'capsulehouse-1c0c9';
const FIRESTORE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

function toFirestoreValue(val) {
  return { stringValue: String(val) };
}

function toFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null && v !== '') fields[k] = toFirestoreValue(v);
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

  // Простой кэш для защиты от дубликатов
  var dedupCache = global.__dedupCache || {};
  global.__dedupCache = dedupCache;

  try {
    const { text, masterName } = req.body;
    if (!text) return res.status(400).json({ error: 'Text required' });
    
    // Если такой же текст был менее 30 секунд назад — пропускаем
    var textHash = text.trim().substring(0, 50);
    var now = Date.now();
    if (dedupCache[textHash] && now - dedupCache[textHash] < 30000) {
      console.log('Dedup: skipping duplicate request');
      return res.json({ ok: true, dedup: true });
    }
    dedupCache[textHash] = now;

    // Разбиваем по строкам
    const lines = text.split('\n').map(s => s.trim()).filter(Boolean);
    
    // Формат:
    // Строка 1: дата время (напр. "3 июня 15:00" или "завтра 14:00")
    // Строка 2: имя клиента
    // Строка 3: телефон (или пусто, можно пропустить)
    // Строка 4: что сделать
    // Строка 5: комментарий (опционально)

    let dateTimeStr = lines[0] || '';
    let name = lines[1] || '—';
    
    // Определяем телефон по наличию 7+ цифр
    function isPhone(s) { return (s.match(/\d/g) || []).length >= 7; }
    
    let phone = '';
    let service = '';
    let comment = '';
    
    // lines[2] может быть телефоном или услугой
    if (lines[2]) {
      if (isPhone(lines[2])) {
        phone = lines[2];
        service = lines[3] || '';
        comment = lines[4] || '';
      } else {
        phone = '';
        service = lines[2];
        comment = lines[3] || '';
      }
    }

    // Преобразуем дату
    let date = '', time = '';
    const ruMonths = {
      'января': 0, 'февраля': 1, 'марта': 2, 'апреля': 3, 'мая': 4, 'июня': 5,
      'июля': 6, 'августа': 7, 'сентября': 8, 'октября': 9, 'ноября': 10, 'декабря': 11
    };
    
    if (dateTimeStr) {
      const dt = dateTimeStr.toLowerCase().trim();
      
      // Проверяем "сегодня" / "завтра"
      const now = new Date();
      if (dt.includes('сегодня')) {
        date = now.toISOString().slice(0, 10);
        // Время после слова
        const tMatch = dt.match(/(\d{1,2}):(\d{2})/);
        if (tMatch) time = tMatch[1].padStart(2,'0') + ':' + tMatch[2];
      } else if (dt.includes('завтра')) {
        const tom = new Date(now);
        tom.setDate(tom.getDate() + 1);
        date = tom.toISOString().slice(0, 10);
        const tMatch = dt.match(/(\d{1,2}):(\d{2})/);
        if (tMatch) time = tMatch[1].padStart(2,'0') + ':' + tMatch[2];
      } else {
        // Парсим "3 июня 15:00" или "03.06 15:00"
        const ruMatch = dt.match(/(\d{1,2})\s+(\S+)\s+(\d{1,2}):(\d{2})/);
        if (ruMatch) {
          const day = ruMatch[1].padStart(2, '0');
          const monthName = ruMatch[2];
          const month = ruMonths[monthName];
          if (month !== undefined) {
            const year = now.getFullYear();
            date = `${year}-${String(month + 1).padStart(2, '0')}-${day}`;
            time = ruMatch[3].padStart(2, '0') + ':' + ruMatch[4];
          }
        } else {
          // Попробуем через Date
          const dMatch = dt.match(/(\d{1,2}[\.\/]\d{1,2}[\.\/]?\d{0,4})\s*(\d{1,2}):(\d{2})/);
          if (dMatch) {
            time = dMatch[2].padStart(2,'0') + ':' + dMatch[3];
            const parts = dMatch[1].split(/[\.\/]/);
            if (parts.length >= 2) {
              date = parts[2] ? `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}` 
                             : `${now.getFullYear()}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
            }
          } else {
            // Только время
            const tMatch = dt.match(/(\d{1,2}):(\d{2})/);
            if (tMatch) {
              date = now.toISOString().slice(0, 10);
              time = tMatch[1].padStart(2,'0') + ':' + tMatch[2];
            }
          }
        }
      }
    }

    if (!date) date = new Date().toISOString().slice(0, 10);

    const now = new Date();
    const ticketId = 'S' + Date.now().toString(36).toUpperCase();

    // Получаем следующий порядковый номер
    let orderNumber = 1;
    try {
      const countUrl = `${FIRESTORE_URL}/galaxymoto_bookings?key=${API_KEY}&pageSize=1&orderBy=orderNumber%20desc`;
      const countResp = await fetch(countUrl);
      if (countResp.ok) {
        const countData = await countResp.json();
        if (countData.documents && countData.documents.length > 0) {
          const lastOrder = parseInt(countData.documents[0].fields?.orderNumber?.integerValue || 0);
          orderNumber = lastOrder + 1;
        }
      }
    } catch(e) {}
    
    const ticketData = {
      id: ticketId,
      orderNumber: orderNumber,
      name: name,
      phone: phone,
      model: service || '',
      notes: comment || '',
      date: date,
      time: time,
      status: 'new',
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
      orderNumber,
      name: ticketData.name,
      phone: ticketData.phone,
      model: ticketData.model,
      notes: ticketData.notes,
      date: ticketData.date,
      time: ticketData.time,
    });

  } catch (e) {
    console.error('Create ticket error:', e);
    res.status(500).json({ error: e.message });
  }
}