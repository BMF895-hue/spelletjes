import sys
from playwright.sync_api import sync_playwright
fouten=[]
with sync_playwright() as p:
    b=p.chromium.launch()
    for naam,vp in [('telefoon',{'width':390,'height':844}),('liggend',{'width':844,'height':390})]:
        pg=b.new_page(viewport=vp,device_scale_factor=2)
        pg.on('pageerror',lambda e:fouten.append(str(e)))
        pg.on('console',lambda m:m.type=='error' and fouten.append(m.text))
        pg.goto('http://localhost:8765/topografie/'); pg.wait_for_timeout(500)
        if naam=='telefoon': pg.screenshot(path=f'/tmp/{naam}-start.png')
        pg.click('[data-modus=ontdek]'); pg.click('path.gebied[data-id=EU]', force=True); pg.wait_for_timeout(400)
        pg.screenshot(path=f'/tmp/{naam}-ontdek.png')
        pg.click('#terug'); pg.click('[data-modus=waar]'); pg.wait_for_timeout(300)
        # eerste vraag één keer fout, daarna alles goed
        eerste=True
        for _ in range(20):
            if pg.is_visible('#einde'): break
            doel=pg.evaluate('spel.doel')
            if eerste:
                fout=[i for i in ['EU','AS','AF','NA','SA','OC','AN'] if i!=doel][0]
                pg.evaluate(f"spel.opTik('{fout}')"); pg.wait_for_timeout(200)
                pg.screenshot(path=f'/tmp/{naam}-fout.png'); eerste=False
            pg.evaluate(f"spel.opTik('{doel}')"); pg.wait_for_timeout(1450)
        print(naam,'waar: rij',pg.evaluate('spel.rij.length'),'goed in een keer',pg.evaluate('spel.goedInEens.size'), pg.inner_text('#einde-tekst'))
        pg.screenshot(path=f'/tmp/{naam}-einde.png')
        pg.click('#einde-menu'); pg.click('[data-modus=welk]'); pg.wait_for_timeout(300)
        pg.screenshot(path=f'/tmp/{naam}-welk.png')
        for _ in range(20):
            if pg.is_visible('#einde'): break
            doel=pg.evaluate('spel.doel'); pg.click(f'#knoppen button[data-id={doel}]'); pg.wait_for_timeout(1450)
        print(naam,'welk:',pg.inner_text('#einde-tekst'), 'best', pg.inner_text('#einde-sterren'))
        pg.click('#einde-menu'); print('beste:',pg.inner_text('#best-waar'),pg.inner_text('#best-welk'))
    b.close()
print('fouten:',fouten); sys.exit(1 if fouten else 0)
