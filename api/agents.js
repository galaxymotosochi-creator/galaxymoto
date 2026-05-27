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
  try {
    const snap = await init().firestore().collection('galaxy_agents').get();
    const a=[]; snap.forEach(d=>a.push({id:d.id,...d.data()}));
    return json(res,200,a);
  } catch(e) { console.error(e); return json(res,500,{error:e.message}); }
}
