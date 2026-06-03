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
          // Обновляем статус через API
          await fetch('https://galaxymoto.vercel.app/api/service-bot/update-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ticketId, status, masterName: msg.from?.first_name || 'Мастер' }),
          }).catch(() => {});
          responseText = `✅ Заявка №${ticketId}: статус изменён на «${status}»`;
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
  const lower = text.toLowerCase();
  if (lower.includes('беру') || lower.includes('в работу')) return 'В работе';
  if (lower.includes('готов') || lower.includes('сделал') || lower.includes('выполнил')) return 'Выполнено';
  if (lower.includes('жду') || lower.includes('запчасти') || lower.includes('ожид')) return 'Ожидание запчастей';
  if (lower.includes('отмен') || lower.includes('не надо')) return 'Отменено';
  return null;
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
      let reply = `✅ Заявка №${data.ticketId} создана!\n`;
      reply += `\n👤 Имя: ${data.name}`;
      if (data.phone) reply += `\n📞 Телефон: ${data.phone}`;
      if (data.comment) reply += `\n📝 Комментарий: ${data.comment}`;
      reply += `\n📅 Дата: ${data.date}`;
      if (data.time) reply += `\n⏰ Время: ${data.time}`;
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
