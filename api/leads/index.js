import admin from 'firebase-admin';

let fb = null;
function init() {
  if (fb) return fb;
  const key = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!key) throw new Error('FIREBASE_SERVICE_ACCOUNT not set');
  const sa = JSON.parse(key);
  fb = admin.initializeApp({ credential: admin.credential.cert(sa) });
  return fb;
}

function json(res, s, d) {
  ['Access-Control-Allow-Origin','Access-Control-Allow-Methods','Access-Control-Allow-Headers'].forEach(h => res.setHeader(h,'*'));
  res.setHeader('Content-Type','application/json');
  return res.status(s).json(d);
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { json(res,204,{}); return; }
  if (req.method !== 'GET') return json(res,405,{error:'Method not allowed'});
  try {
    const snap = await init().firestore().collection('galaxy_leads').get();
    const data = [];
    snap.forEach(d => data.push({id:d.id,...d.data()}));
    return json(res,200,data);
  } catch(e) { console.error(e); return json(res,500,{error:e.message}); }
}
