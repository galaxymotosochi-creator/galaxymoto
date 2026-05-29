import subprocess

with open('admin.html', 'r') as f:
    c = f.read()

# 1. Date-Time row
# Find date block start and time block end
d_start = c.find('margin-bottom:10px\\">";\n    h+="<label style=\\"font-size:12px;color:#888;display:block;margin-bottom:3px\\">Дата</label>"')
if d_start >= 0:
    # Go back to find the h+=
    h_start = c.rfind('h+=', 0, d_start)
    # Find the closing of the time if block - look for '}\n  ' after the time if
    t_close = c.find('}\n  ', d_start + 200)
    if t_close > 0:
        block = c[h_start:t_close+4]
        
        # Build new date-time combined block
        new_block = (
            'h+="<div style=\\"display:flex;gap:10px;margin-bottom:10px\\">";\n'
            '    h+="<div style=\\"flex:1\\"><label style=\\"font-size:12px;color:#888;display:block;margin-bottom:3px\\">Дата</label>'
            '<div style=\\"width:100%;padding:10px 12px;font-size:14px;font-family:Inter,sans-serif;border:1.5px solid #ddd;'
            'border-radius:8px;background:#f9f9f9;color:#333\\">"+b.date.split("-").reverse().join(".")+"</div></div>";\n'
            '    if(b.time){h+="<div style=\\"flex:1\\"><label style=\\"font-size:12px;color:#888;display:block;margin-bottom:3px\\">Время</label>'
            '<div style=\\"width:100%;padding:10px 12px;font-size:14px;font-family:Inter,sans-serif;border:1.5px solid #ddd;'
            'border-radius:8px;background:#f9f9f9;color:#333\\">"+b.time+"</div></div>";}else{h+="<div style=\\"flex:1\\"></div>";}\n'
            '    h+="</div>";\n'
            '  '
        )
        c = c.replace(block, new_block)
        print('1. Date-Time: OK')
    else:
        print('1. Time closing not found')
else:
    print('1. Date not found')

# 2. Name-Phone row
n_start = c.find('margin-bottom:10px\\">";\n    h+="<label style=\\"font-size:12px;color:#888;display:block;margin-bottom:3px\\">Имя</label>"')
if n_start >= 0:
    h_start = c.rfind('h+=', 0, n_start)
    # Find the end of phone block - h+="</div>"; after Телефон
    ph_end = c.find('h+="</div>";', c.find('Телефон</label>', n_start)) + len('h+="</div>";')
    if ph_end > h_start:
        block = c[h_start:ph_end]
        
        new_block = (
            'h+="<div style=\\"display:flex;gap:10px;margin-bottom:10px\\">";\n'
            '    h+="<div style=\\"flex:1\\"><label style=\\"font-size:12px;color:#888;display:block;margin-bottom:3px\\">Имя</label>'
            '<div style=\\"width:100%;padding:10px 12px;font-size:14px;font-family:Inter,sans-serif;border:1.5px solid #ddd;'
            'border-radius:8px;background:#f9f9f9;color:#333\\">"+esc(b.name)+"</div></div>";\n'
            '    h+="<div style=\\"flex:1\\"><label style=\\"font-size:12px;color:#888;display:block;margin-bottom:3px\\">Телефон</label>'
            '<div style=\\"width:100%;padding:10px 12px;font-size:14px;font-family:Inter,sans-serif;border:1.5px solid #ddd;'
            'border-radius:8px;background:#f9f9f9;color:#333\\">"+(b.phone||"-")+"</div></div>";\n'
            '    h+="</div>";'
        )
        c = c.replace(block, new_block)
        print('2. Name-Phone: OK')
    else:
        print('2. Phone end not found')
else:
    print('2. Name not found')

# 3. Model-Status row
m_start = c.find('if(b.model){\n    h+="<div style=\\"margin-bottom:10px\\">";\n    h+="<label style=\\"font-size:12px;color:#888;display:block;margin-bottom:3px\\">Модель</label>"')
m_close = c.find('}\n  ', m_start) + 4 if m_start >= 0 else -1
s_start = c.find('margin-bottom:6px\\">";\n  h+="<label style=\\"font-size:12px;color:#888;display:block;margin-bottom:3px\\">Статус</label>"', m_start)
if m_start >= 0 and s_start >= 0:
    h_s = c.rfind('h+=', 0, s_start)
    # Find where status block ends (before workDone, phone, or detBody)
    s_end_marker = len(c)
    for marker in ['if(b.workDone', 'if(b.phone)', 'document.getElementById("detBody")']:
        idx_marker = c.find(marker, h_s)
        if idx_marker > 0 and idx_marker < s_end_marker:
            s_end_marker = idx_marker
    status_block = c[h_s:s_end_marker].rstrip()
    model_block = c[m_start:m_close]
    combined = model_block + '\n  ' + status_block
    
    # The new block is complex because it has JS template strings.
    # Let me build it by reading the actual content from the file
    # Model block: if(b.model){...}
    # Status block: h+=...Статус...
    
    # New code when model exists:
    new_when_model = (
        'if(b.model){\n'
        '    h+="<div style=\\"display:flex;gap:10px;margin-bottom:10px\\">";\n'
        '    h+="<div style=\\"flex:1\\"><label style=\\"font-size:12px;color:#888;display:block;margin-bottom:3px\\">Модель</label>'
        '<div style=\\"width:100%;padding:10px 12px;font-size:14px;font-family:Inter,sans-serif;border:1.5px solid #ddd;'
        'border-radius:8px;background:#f9f9f9;color:#333\\">"+esc(b.model)+"</div></div>";\n'
        '    h+="<div style=\\"flex:1\\"><label style=\\"font-size:12px;color:#888;display:block;margin-bottom:3px\\">Статус</label>'
        '<div style=\\"width:100%;padding:10px 12px;font-size:14px;font-family:Inter,sans-serif;border:1.5px solid #ddd;'
        'border-radius:8px;background:#f9f9f9\\"><span class=\\"booking-status status-"+st+"\\">'+SL[st]+'</span></div></div>";\n'
        '    h+="</div>";\n'
        '  }else{\n'
        '    ' + status_block + '\n'
        '  }'
    )
    
    # But the SL[st] issue remains... Let me use a raw string approach
    # Actually the JS has '+SL[st]+' which IS valid JS.
    # The problem is Python interprets it as concatenation.
    # Solution: Use repr() to escape the proper way
    
    # Let me just directly construct the string with proper JS content
    # I'll read the status_block from the file which already has the correct syntax
    status_content = status_block
    
    new_code = ('if(b.model){\n'
        '    h+="<div style=\\"display:flex;gap:10px;margin-bottom:10px\\">";\n'
        '    h+="<div style=\\"flex:1\\"><label style=\\"font-size:12px;color:#888;display:block;margin-bottom:3px\\">Модель</label>'
        '<div style=\\"width:100%;padding:10px 12px;font-size:14px;font-family:Inter,sans-serif;border:1.5px solid #ddd;'
        'border-radius:8px;background:#f9f9f9;color:#333\\">"+esc(b.model)+"</div></div>";\n'
        '    h+="<div style=\\"flex:1\\"><label style=\\"font-size:12px;color:#888;display:block;margin-bottom:3px\\">Статус</label>'
        '<div style=\\"width:100%;padding:10px 12px;font-size:14px;font-family:Inter,sans-serif;border:1.5px solid #ddd;'
        'border-radius:8px;background:#f9f9f9\\"><span class=\\"booking-status status-"+st+"\\">' + 
        "'+SL[st]+'" + 
        '</span></div></div>";\n'
        '    h+="</div>";\n'
        '  }else{\n'
        '    ' + status_block + '\n'
        '  }'
    )
    
    c = c.replace(combined, new_code)
    print('3. Model-Status: OK')
else:
    print('3. Not found')

with open('admin.html', 'w') as f:
    f.write(c)

r = subprocess.run(['node', '-e', 'try{new Function(' + repr(c.split('<script>')[-1].split('</script>')[0]) + ');console.log("OK")}catch(e){console.log(e.message.replace(chr(10)," "))}'], capture_output=True, text=True)
print(f'JS: {r.stdout.strip()}')
