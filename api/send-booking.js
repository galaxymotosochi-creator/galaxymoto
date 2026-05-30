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
    
    const token = process.env.TELEGRAM_BOT_TOKEN || '7471473926:AAE_kyz1Qtb1J8Dddqk1aaxzBGfMQ73lSMM';
    const chatIds = [5368408796, 321245864];
    
    // Отправляем текст на оба телефона
    await Promise.all(chatIds.map(cid =>
      fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: cid, text: msg })
      }).catch(() => {})
    ));
    
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[send-booking] Error:', e);
    return res.status(500).json({ error: e.message });
  }
}
