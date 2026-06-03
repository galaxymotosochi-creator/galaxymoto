// Сервис-бот для мастеров — создание заявок через Telegram
const BOT_TOKEN = '8809897288:AAGnmKbQ4Ii2SYp8M_v0PZFPYwN7wHjHecY';

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
    const update = req.body;
    if (!update.message) return res.json({ ok: true });

    const msg = update.message;
    const chatId = msg.chat.id;
    const text = (msg.text || '').trim();
    const replyTo = msg.reply_to_message;

    if (!text) return res.json({ ok: true });

    let responseText = '';

    // Если ответ на существующую заявку — меняем статус
    if (replyTo && replyTo.text) {
      const replyText = replyTo.text;
      // Ищем номер заявки в исходном сообщении
      const idMatch = replyText.match(/№(\d+)/);
      if (idMatch) {
        const ticketId = idMatch[1];
        const status = parseStatus(text);
        if (status) {
          // Имя мастера из сообщения (после "взял")
          const masterName = extractMasterName(text);
          // Обновляем статус через API
          await fetch('https://galaxymoto.vercel.app/api/service-bot/update-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ticketId, status, masterName: masterName || msg.from?.first_name || 'Мастер' }),
          }).catch(() => {});
          var statusLabels = {'new':'НОВАЯ','in_progress':'В РАБОТЕ','completed':'ВЫПОЛНЕНА','cancelled':'ОТМЕНЕНА'};
          var replyLabel = statusLabels[status] || status;
          if (masterName) replyLabel += ' — ' + masterName;
          responseText = `✅ Заявка №${ticketId}: ${replyLabel}`;
        } else {
          responseText = '❓ Не понял статус. Напиши: "беру", "готово", "жду запчасти"';
        }
      } else {
        // Нет номера — это новая заявка
        responseText = await createTicket(text, chatId, msg.from);
      }
    } else {
      // Нет реплая — создаём новую заявку
      responseText = await createTicket(text, chatId, msg.from);
    }

    // Отвечаем мастеру
    if (responseText) {
      await sendMessage(chatId, responseText);
    }

    res.json({ ok: true });
  } catch (e) {
    console.error('Service bot error:', e);
    res.status(500).json({ error: e.message });
  }
}

function parseStatus(text) {
  const lower = text.toLowerCase().trim();
  if (lower.startsWith('взял')) return 'in_progress';
  if (lower.includes('готов') || lower.includes('сделал') || lower.includes('выполнил')) return 'completed';
  if (lower.includes('жду') || lower.includes('запчасти') || lower.includes('ожид')) return 'in_progress';
  if (lower.includes('отмен') || lower.includes('не надо')) return 'cancelled';
  return null;
}

function extractMasterName(text) {
  const lower = text.toLowerCase().trim();
  if (lower.startsWith('взял')) {
    const name = text.trim().substring(4).trim(); // всё после "взял"
    return name || '';
  }
  return '';
}

async function createTicket(text, chatId, from) {
  try {
    const resp = await fetch('https://galaxymoto.vercel.app/api/service-bot/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, masterName: from?.first_name || 'Мастер', chatId }),
    });
    const data = await resp.json();
    if (data.ok) {
      let reply = `✅ Заявка №${data.orderNumber || data.ticketId} создана!\n`;
      reply += `\n📅 ${data.date}`;
      if (data.time) reply += ` ${data.time}`;
      reply += `\n👤 ${data.name}`;
      if (data.phone) reply += `\n📞 ${data.phone}`;
      if (data.model) reply += `\n🔧 ${data.model}`;
      if (data.notes) reply += `\n💬 ${data.notes}`;
      reply += `\n\nСтатус: НОВАЯ`;
      return reply;
    }
    return '❌ Ошибка создания заявки. Попробуй ещё раз.';
  } catch (e) {
    return '❌ Ошибка. Попробуй позже.';
  }
}

async function sendMessage(chatId, text) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  }).catch(() => {});
}
