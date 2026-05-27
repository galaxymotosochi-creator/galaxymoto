with open('assets/index-CguyBJZF.js', 'r') as f:
    content = f.read()

old = '{path:"/#calculator",label:"Бизнес-калькулятор",external:!0}'
new = '{label:"Бизнес-калькулятор",onClick:function(){try{document.getElementById(\"calculator\").scrollIntoView({behavior:\"smooth\"})}catch(e){}},external:!0}'

if old in content:
    content = content.replace(old, new)
    with open('assets/index-CguyBJZF.js', 'w') as f:
        f.write(content)
    print('✅ Menu calculator link fixed')
else:
    print('❌ Not found')
    idx = content.find('калькулятор",external:!0}')
    if idx > -1:
        print(f'Found at {idx}: {content[idx-30:idx+30]}')
