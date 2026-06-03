const BOT_TOKEN = '8925596177:AAFUVMJH2I2X6BIAA1KTcRuEUrOGB9ILGQY';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const update = req.body;

    if (!update.message) {
      return res.json({ ok: true });
    }

    const msg = update.message;
    const text = msg.text;
    const replyTo = msg.reply_to_message;

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
        const firebaseUrl = `https://capsulehouse-1c0c9.firebaseio.com/chat_messages/${visitorId}.json`;
        const payload = {
          role: 'manager',
          text: text,
          createdAt: new Date().toISOString(),
        };
        
        await fetch(firebaseUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }).catch(() => {});
      }
    }

    res.json({ ok: true });
  } catch (e) {
    console.error('Webhook error:', e);
    res.status(500).json({ error: 'Webhook error' });
  }
}
