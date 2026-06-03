// Webhook Telegram — ответ менеджера сохраняем в Firestore
const BOT_TOKEN = '8925596177:AAFUVMJH2I2X6BIAA1KTcRuEUrOGB9ILGQY';
const REPLY_API = 'https://galaxymoto.vercel.app/api/chat/reply';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const update = req.body;
    if (!update.message) return res.json({ ok: true });

    const msg = update.message;
    const text = msg.text;
    const replyTo = msg.reply_to_message;

    // Если менеджер ответил реплаем на сообщение от клиента
    if (replyTo && replyTo.text && replyTo.text.includes('VisitorID:')) {
      const lines = replyTo.text.split('\n');
      let visitorId = '';
      for (const line of lines) {
        if (line.startsWith('VisitorID:')) {
          visitorId = line.replace('VisitorID:', '').trim();
          break;
        }
      }

      if (visitorId && text) {
        // Сохраняем ответ через API
        await fetch(REPLY_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            visitorId: visitorId,
            text: text,
            managerName: msg.from?.first_name || 'Менеджер',
          }),
        }).catch(e => console.error('Reply API error:', e));
      }
    }

    res.json({ ok: true });
  } catch (e) {
    console.error('Webhook error:', e);
    res.status(500).json({ error: 'Webhook error' });
  }
}
