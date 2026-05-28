with open('admin.html', 'r', encoding='utf-8') as f:
    c = f.read()

# Find saveNewRecord function and add Telegram notification
idx = c.find('function saveNewRecord')
end = c.find('\n\n', idx) if '\n\n' in c[idx:] else c.find('}\n', idx) + 2

old_fn = c[idx:end]
print(f'Found function: {len(old_fn)} chars')

# Build new function with Telegram notification
new_fn = '''function saveNewRecord(){
  var dt=document.getElementById('addDate').value;
  var tm=document.getElementById('addTime').value;
  var nm=document.getElementById('addName').value.trim();
  var ph=document.getElementById('addPhone').value.trim();
  var md=document.getElementById('addModel').value.trim();
  var nt=document.getElementById('addNotes').value.trim();
  if(!dt||!nm){alert('\u0417\u0430\u043f\u043e\u043b\u043d\u0438\u0442\u0435 \u0434\u0430\u0442\u0443 \u0438 \u0438\u043c\u044f');return}
  var id=dt+'_'+(tm?tm.replace(':','-'):'00-00');
  var data={date:dt,time:tm||'',name:nm,phone:ph||'',model:md||'',notes:nt||'',status:'new',createdAt:new Date().toISOString()};
  var d=firebase.firestore();
  d.collection('galaxymoto_bookings').doc(id).set(data).then(function(){closeAddForm();sendAdminTG(nm,ph,dt,tm,md)}).catch(function(e){alert('\u041e\u0448\u0438\u0431\u043a\u0430')})
}
function sendAdminTG(nm,ph,dt,tm,md){
  var msg='\u041d\u043e\u0432\u0430\u044f \u0437\u0430\u043f\u0438\u0441\u044c \u043d\u0430 \u0441\u0435\u0440\u0432\u0438\u0441 \u0447\u0435\u0440\u0435\u0437 \u0430\u0434\u043c\u0438\u043d \u043f\u0430\u043d\u0435\u043b\u044c!\n\n\u2705 '+nm+'\n\uD83D\uDCDE '+ph+'\n\uD83D\uDCC5 '+dt+'\n\u23F0 '+tm+'\n\uD83D\uDEB2 '+(md||'-');
  fetch('https://api.telegram.org/bot7471473926:AAE_kyz1Qtb1J8Dddqk1aaxzBGfMQ73lSMM/sendMessage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:5368408796,text:msg})}).catch(function(){})
}
'''

c = c.replace(old_fn, new_fn)

with open('admin.html', 'w', encoding='utf-8') as f:
    f.write(c)

# Verify
import subprocess
r = subprocess.run(['node', '-e', "try{new Function(" + repr(c.split('<script>')[-1].split('</script>')[0]) + ");console.log('JS OK')}catch(e){console.log(e.message)}"], capture_output=True, text=True, shell=False)
print(f'JS: {r.stdout.strip()}')
print(f'sendAdminTG defined: {\"sendAdminTG\" in c}')
print(f'Size: {len(c)} bytes')
