import admin from 'firebase-admin';

let fb = null;
function init() {
  if (fb) return fb;
  const key = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!key) throw Error('FB key missing');
  fb = admin.initializeApp({credential:admin.credential.cert(JSON.parse(key))});
  return fb;
}

function json(res,s,d) {
  ['Access-Control-Allow-Origin','Access-Control-Allow-Methods','Access-Control-Allow-Headers'].forEach(h=>res.setHeader(h,'*'));
  res.setHeader('Content-Type','application/json');
  return res.status(s).json(d);
}

async function tg(lead, agent) {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return;
    let t = `🆕 Новая заявка с сайта!\nИмя: ${lead.name||'-'}\nТелефон: ${lead.phone||'-'}\nГород: ${lead.city||'-'}\nДом: ${lead.houseName||'Не указан'}\nКоличество: ${lead.houseCount||'1'} шт\nБюджет на 1 дом: ${lead.budgetPerHouse||'-'} ₽\n\n`;
    if (agent) t += `👤 Агент: ${agent.fullName}\n📞 Телефон: ${agent.phone||'-'}\n✉️ Почта: ${agent.email||'-'}\n🔗 Код: ${agent.referralCode||'-'}`;
    else if (lead.agentId) t += `👤 Агент: ID ${lead.agentId}`;
    else t += `👤 Агент: не указан`;
    const chatIds = [5368408796, 321245864];
    await Promise.all(chatIds.map(cid =>
      fetch(`https://api.telegram.org/bot${token}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:cid,text:t})}).catch(()=>{})
    ));
  } catch(e) { console.error('TG:',e); }
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { json(res,204,{}); return; }
  const { id } = req.query;
  
  try {
    // LOG THE FULL REQUEST FOR DEBUGGING
    const bodyStr = JSON.stringify(req.body || {});
    console.log('[LEAD] PUT id=' + id + ' body=' + bodyStr);
    
    const db = init().firestore();
    if (req.method === 'PUT') {
      const body = typeof req.body === 'object' ? req.body : JSON.parse(req.body);
      
      // Log agentId specifically
      console.log('[LEAD] agentId=' + JSON.stringify(body.agentId));
      
      if (!body.name||!body.phone) return json(res,400,{ok:false,error:'Name+phone required'});
      
      // Save lead + more fields to help debug
      await db.collection('galaxy_leads').doc(id).set(body,{merge:true});
      
      // Find agent
      let a = null;
      if (body.agentId) { 
        const s = await db.collection('galaxy_agents').where('id','==',body.agentId).get(); 
        if (!s.empty) a = s.docs[0].data();
        else console.log('[LEAD] Agent not found for id=' + body.agentId);
      } else {
        console.log('[LEAD] No agentId in body');
      }
      
      tg(body,a).catch(()=>{});
      return json(res,200,{ok:true,id,agentIdReceived:body.agentId||null});
    }
    if (req.method === 'DELETE') { await db.collection('galaxy_leads').doc(id).delete(); return json(res,200,{ok:true}); }
    return json(res,405,{error:'Not allowed'});
  } catch(e) { console.error(e); return json(res,500,{ok:false,error:e.message}); }
}
