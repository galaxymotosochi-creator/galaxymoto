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
  if (req.method!=='PUT'&&req.method!=='POST') return json(res,405,{error:'Use PUT'});
  
  try {
    const body = typeof req.body === 'object' ? req.body : JSON.parse(req.body);
    if (!body.email) return json(res,400,{ok:false,error:'Email required'});
    
    const db = init().firestore();
    const AGENTS = 'galaxy_agents';
    
    // Check if agent already exists by email
    const existing = await db.collection(AGENTS).where('email','==',body.email).get();
    
    if (!existing.empty) {
      // Update existing
      await db.collection(AGENTS).doc(existing.docs[0].id).set(body,{merge:true});
      return json(res,200,{ok:true,action:'updated',id:existing.docs[0].id});
    } else {
      // Create new
      const ref = db.collection(AGENTS).doc();
      await ref.set({...body,id:ref.id,createdAt:new Date().toISOString()});
      return json(res,200,{ok:true,action:'created',id:ref.id});
    }
  } catch(e) {
    console.error(e);
    return json(res,500,{ok:false,error:e.message});
  }
}
