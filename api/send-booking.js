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
    const body = typeof req.body === 'object' ? req.body : JSON.parse(req.body);
    const { date, time, name, phone, model, notes } = body;
    
    // Формируем сообщение для Telegram
    let msg = `🛵 Новая запись на сервис!\n\n`;
    msg += `📅 Дата: ${date}\n`;
    msg += `⏰ Время: ${time}\n`;
    msg += `👤 Имя: ${name || '-'}\n`;
    msg += `📞 Телефон: ${phone || '-'}\n`;
    msg += `🛵 Модель: ${model || 'Не указана'}\n`;
    if (notes) msg += `📝 Описание: ${notes}\n`;
    
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    
    if (token && chatId) {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: parseInt(chatId), text: msg })
      });
    } else {
      console.log('[send-booking] TELEGRAM env vars not set, skipping notification');
      console.log('[send-booking] Booking data:', msg);
    }
    
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[send-booking] Error:', e);
    return res.status(500).json({ error: e.message });
  }
}
