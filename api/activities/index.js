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

export default async function handler(req,res) {
  if (req.method==='OPTIONS') {json(res,204,{});return;}
  if (req.method!=='GET') return json(res,405,{error:'Not allowed'});
  
  const url = new URL(req.url, `http://${req.headers.host}`);
  const parts = url.pathname.split('/').filter(Boolean);
  
  try {
    const db = init().firestore();
    const COLL = 'galaxy_activities';
    
    // /api/activities/by-agent/:agentId
    if (parts.length === 4 && parts[2] === 'by-agent') {
      const snap = await db.collection(COLL).where('agentId','==',parts[3]).orderBy('createdAt','desc').get();
      const items=[]; snap.forEach(d=>items.push({id:d.id,...d.data()}));
      return json(res,200,items);
    }
    
    // /api/activities (all)
    const snap = await db.collection(COLL).orderBy('createdAt','desc').get();
    const items=[]; snap.forEach(d=>items.push({id:d.id,...d.data()}));
    return json(res,200,items);
  } catch(e) { console.error(e); return json(res,500,{error:e.message}); }
}
