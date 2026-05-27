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
  const {id} = req.query;
  try {
    const db = init().firestore();
    if (req.method==='PUT') {
      const body = typeof req.body === 'object' ? req.body : JSON.parse(req.body);
      if (!body.type||!body.agentId) return json(res,400,{ok:false,error:'type+agentId required'});
      await db.collection('galaxy_activities').doc(id).set({...body,createdAt:body.createdAt||new Date().toISOString()},{merge:true});
      return json(res,200,{ok:true,id});
    }
    return json(res,405,{error:'Not allowed'});
  } catch(e) { console.error(e); return json(res,500,{ok:false,error:e.message}); }
}
