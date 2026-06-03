const BOT_TOKEN = '8925596177:AAFUVMJH2I2X6BIAA1KTcRuEUrOGB9ILGQY';
const MANAGER_CHAT_ID = '5368408796';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message, name, phone, visitorId } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  const text = [
    `💬 Новое сообщение в чате!`,
    ``,
    `От: ${name || 'Не представился'}`,
    `Телефон: ${phone || 'Не указан'}`,
    `VisitorID: ${visitorId || '-'}`,
    ``,
    `Текст:`,
    message,
  ].join('\n');

  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: MANAGER_CHAT_ID,
        text: text,
        parse_mode: 'HTML',
      }),
    });

    const data = await resp.json();
    
    if (!data.ok) {
      throw new Error(data.description || 'Telegram API error');
    }

    res.json({ ok: true });
  } catch (e) {
    console.error('Chat send error:', e);
    res.status(500).json({ error: 'Failed to send message' });
  }
}
