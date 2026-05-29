with open('admin.html', 'rb') as f:
    raw = f.read()

# 1. Add master modal before detail modal
master_modal = b'\n<!-- Master select modal -->\n<div class="modal-overlay" id="masterModal">\n  <div class="modal-box" style="max-width:360px">\n    <button class="modal-close" onclick="closeMasterModal()">&times;</button>\n    <h3 style="margin-bottom:12px">\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u043c\u0430\u0441\u0442\u0435\u0440\u0430</h3>\n    <div style="display:flex;flex-direction:column;gap:8px" id="masterList"></div>\n  </div>\n</div>\n'

idx = raw.find(b'<div class="modal-overlay" id="detailModal">')
if idx >= 0:
    raw = raw[:idx] + master_modal + raw[idx:]
    print('1. Master modal added')
else:
    print('1. Detail modal not found')

# 2. Add master JS functions
js_fn = b'''
var MASTERS = ["\u0410\u043b\u0435\u043a\u0441\u0430\u043d\u0434\u0440","\u0414\u043c\u0438\u0442\u0440\u0438\u0439","\u0421\u0435\u0440\u0433\u0435\u0439"];
var pendingConfirmId = "";
function openMasterSelect(id){
  pendingConfirmId = id;
  var list = document.getElementById("masterList");
  var h = "";
  for(var i=0;i<MASTERS.length;i++){
    h+="<div onclick=\\"selectMaster("+i+")\\" style=\\"cursor:pointer;padding:12px 14px;border:1.5px solid #ddd;border-radius:8px;font-size:14px;font-weight:500;color:#333\\" onmouseover=\\"this.style.borderColor='#111'\\" onmouseout=\\"this.style.borderColor='#ddd'\\">"+MASTERS[i]+"</div>";
  }
  list.innerHTML = h;
  document.getElementById("masterModal").classList.add("active");
}
function closeMasterModal(){
  document.getElementById("masterModal").classList.remove("active");
}
function selectMaster(idx){
  setStat(pendingConfirmId, "confirmed", MASTERS[idx]);
  closeMasterModal();
  closeDet();
}
'''

idx2 = raw.find(b'function openWorkForm')
if idx2 >= 0:
    raw = raw[:idx2] + js_fn + raw[idx2:]
    print('2. Master JS functions added')
else:
    print('2. openWorkForm not found')

# 3. Update confirm button to openMasterSelect
old = b'onclick="setStat(\u0027"+b.id+"\u0027,\u0027confirmed\u0027);closeDet()"'
new = b'onclick="openMasterSelect(\u0027"+b.id+"\u0027)"'
if old in raw:
    raw = raw.replace(old, new, 1)
    print('3. Confirm button updated')
else:
    print('3. Confirm button not found')

# 4. Update setStat with master param
old_s = b'function setStat(id,st){try{var d=firebase.firestore();d.collection(\'leads\').doc(id).update({status:st,updatedAt:new Date().toISOString()}).catch(function(){});d.collection(\'galaxymoto_bookings\').doc(id).update({status:st,updatedAt:new Date().toISOString()}).catch(function(){})}catch(e){}}'
new_s = b'function setStat(id,st,master){try{var d=firebase.firestore();var upd={status:st,updatedAt:new Date().toISOString()};if(master)upd.master=master;d.collection(\'leads\').doc(id).update(upd).catch(function(){});d.collection(\'galaxymoto_bookings\').doc(id).update(upd).catch(function(){})}catch(e){}}'
if old_s in raw:
    raw = raw.replace(old_s, new_s)
    print('4. setStat updated')
else:
    print('4. setStat not found')

# 5. Add master to listeners (both)
for pat in [b",master:x.master||''"]:
    # Skip - will add manually
    pass

# Find both occurrences of workDone in listeners
count = 0
for target in [b",workDone:x.workDone||null"]:
    idx = raw.find(target)
    if idx >= 0:
        raw = raw[:idx] + b",master:x.master||''" + raw[idx:]
        count += 1
print(f'5. Added master to {count} listeners')

# 6. Show master in table
old_th = b'<td>\u0414\u0430\u0442\u0430</td><td>\u0418\u043c\u044f</td><td>\u0422\u0435\u043b\u0435\u0444\u043e\u043d</td><td>\u041c\u043e\u0434\u0435\u043b\u044c</td><td style="text-align:right">\u0421\u0442\u0430\u0442\u0443\u0441</td>'
new_th = b'<td>\u0414\u0430\u0442\u0430</td><td>\u0418\u043c\u044f</td><td>\u0422\u0435\u043b\u0435\u0444\u043e\u043d</td><td>\u041c\u043e\u0434\u0435\u043b\u044c</td><td>\u041c\u0430\u0441\u0442\u0435\u0440</td><td style="text-align:right">\u0421\u0442\u0430\u0442\u0443\u0441</td>'
if old_th in raw:
    raw = raw.replace(old_th, new_th)
    print('6. Master column added to header')
else:
    print('6. Header not found')

# Add master cell to rows
old_cell = b'<td style="text-align:right"><span class="booking-status '+SC[st]+'">'+SL[st]+'</span></td>'
new_cell = b'<td>'+(b.master||'-')+'</td><td style="text-align:right"><span class="booking-status '+SC[st]+'">'+SL[st]+'</span></td>'
if old_cell in raw:
    raw = raw.replace(old_cell, new_cell)
    print('7. Master cell added to rows')
else:
    print('7. Cell not found')

# 8. Show master in detail modal after notes
notes_block = b'if(b.notes){\n    h+="<div style=\\"margin-bottom:10px\\">";\n    h+="<label style=\\"font-size:12px;color:#888;display:block;margin-bottom:3px\\">\\u041e\\u043f\\u0438\\u0441\\u0430\\u043d\\u0438\\u0435</label>";\n    h+="<div style=\\"width:100%;padding:10px 12px;font-size:14px;font-family:Inter,sans-serif;border:1.5px solid #ddd;border-radius:8px;background:#f9f9f9;color:#333\\">"+esc(b.notes)+"</div>";\n    h+="</div>";\n  }'
master_block = b'if(b.master){\n    h+="<div style=\\"margin-bottom:10px\\">";\n    h+="<label style=\\"font-size:12px;color:#888;display:block;margin-bottom:3px\\">\\u041c\\u0430\\u0441\\u0442\\u0435\\u0440</label>";\n    h+="<div style=\\"width:100%;padding:10px 12px;font-size:14px;font-family:Inter,sans-serif;border:1.5px solid #ddd;border-radius:8px;background:#f9f9f9;color:#333\\">"+b.master+"</div>";\n    h+="</div>";\n  }'
idx = raw.find(notes_block)
if idx >= 0:
    after = idx + len(notes_block)
    raw = raw[:after] + b'\n  ' + master_block + raw[after:]
    print('8. Master in detail modal')
else:
    print('8. Notes block not found')

with open('admin.html', 'wb') as f:
    f.write(raw)

import subprocess
r = subprocess.run(['node', '-e', 'try{new Function(' + repr(raw.decode().split('<script>')[-1].split('</script>')[0]) + ');console.log("OK")}catch(e){console.log(e.message.replace(chr(10)," "))}'], capture_output=True, text=True)
print(f'JS: {r.stdout.strip()}')

text = raw.decode('utf-8', errors='replace')
for item in ['masterModal', 'openMasterSelect', 'MASTERS', 'selectMaster', 'pendingConfirmId']:
    print(f'  {"OK" if item in text else "MISS"} {item}')
