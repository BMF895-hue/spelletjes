"""Speelt de app in een headless browser: alle spelvormen, op telefoon- en liggend formaat."""
import sys
from playwright.sync_api import sync_playwright
IDS = ['EU', 'AS', 'AF', 'NA', 'SA', 'OC', 'AN']
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765/topografie/'
fouten = []
def check(ok, wat):
    print(('  ok   ' if ok else '  FOUT ') + wat)
    if not ok: fouten.append(wat)
def typ(pg, tekst):
    pg.fill('#invoer', tekst); pg.press('#invoer', 'Enter'); pg.wait_for_timeout(150)

with sync_playwright() as p:
    b = p.chromium.launch()
    for naam, vp in [('telefoon', {'width': 390, 'height': 844}), ('liggend', {'width': 844, 'height': 390})]:
        print(naam)
        pg = b.new_page(viewport=vp, device_scale_factor=2)
        pg.on('pageerror', lambda e: fouten.append('js: ' + str(e)))
        pg.on('console', lambda m: m.type == 'error' and fouten.append('console: ' + m.text))
        pg.goto(URL); pg.wait_for_timeout(500)
        naam_van = lambda i: pg.evaluate(f"naamVan('{i}')")

        pg.click('[data-modus=ontdek]'); pg.evaluate("spel.opTik('EU')"); pg.wait_for_timeout(400)
        check(pg.inner_text('#vraag .groot') == 'Europa', 'ontdekken toont de naam')
        pg.screenshot(path=f'/tmp/{naam}-ontdek.png'); pg.click('#terug')

        # Waar ligt: eerste vraag één keer fout, daarna alles goed -> 6 van 7, fout komt terug
        pg.click('[data-modus=waar]'); pg.wait_for_timeout(200)
        doel = pg.evaluate('spel.doel'); pg.evaluate(f"spel.opTik('{[i for i in IDS if i != doel][0]}')")
        for _ in range(20):
            if pg.is_visible('#einde'): break
            pg.evaluate("spel.opTik(spel.doel)"); pg.wait_for_timeout(1750)
        check(pg.inner_text('#einde-tekst').startswith('6 van de 7'), 'waar: 6 van 7 na één fout')
        check(pg.locator('#einde-nieuw span').count() == 6, 'waar: 6 nieuwe diersterren')
        pg.screenshot(path=f'/tmp/{naam}-einde.png'); pg.click('#einde-menu')
        check(pg.locator('#dieren div:not(.leeg)').count() == 6, 'verzameling toont 6 dieren')

        # Terug tijdens de wachttijd na een goed antwoord mag geen fout geven
        pg.click('[data-modus=welk]'); pg.wait_for_timeout(200)
        pg.click(f"#knoppen button[data-id={pg.evaluate('spel.doel')}]"); pg.click('#terug'); pg.wait_for_timeout(1900)
        check(pg.is_visible('#start'), 'terug midden in een vraag')

        # Typen
        pg.click('[data-modus=typ]'); pg.wait_for_timeout(200)
        check(pg.evaluate("document.activeElement.id") == 'invoer', 'typen: invoerveld heeft focus')
        check(pg.locator('.label.zien').count() == 0 and pg.locator('#knoppen button').count() == 0, 'typen: geen namen in beeld')
        doel = pg.evaluate('spel.doel'); ander = [i for i in IDS if i != doel][0]
        typ(pg, 'blabla'); check('Probeer nog eens' in pg.inner_text('#vraag'), 'typen: fout antwoord geeft hint')
        check(pg.inner_text('#vraag .groot').startswith(naam_van(doel)[0]), 'typen: hint begint met eerste letter')
        pg.screenshot(path=f'/tmp/{naam}-typ.png')
        typ(pg, naam_van(ander)); check(pg.inner_text('#vraag .groot') == naam_van(doel), 'typen: na 2 fouten het antwoord')
        pg.wait_for_timeout(2800)
        varianten = {'AS': 'azie', 'NA': 'noord amerika', 'SA': 'ZUID-AMERIKA', 'OC': 'Oceanie'}
        slordig = False
        for _ in range(20):
            if pg.is_visible('#einde'): break
            d = pg.evaluate('spel.doel'); typ(pg, varianten.get(d, naam_van(d)))
            check(pg.evaluate('spel.bezig'), f'typen: "{varianten.get(d, naam_van(d))}" goed gerekend')
            if d == 'AS' and not slordig: slordig = True; check('Azië' in pg.inner_text('#vraag .weetje'), 'typen: toont nette schrijfwijze')
            pg.wait_for_timeout(1750)
        check(pg.inner_text('#einde-tekst').startswith('6 van de 7'), 'typen: 6 van 7')
        pg.click('#einde-menu')

        # Tegen de klok (ingekort)
        pg.click('[data-modus=race]'); pg.wait_for_timeout(200)
        for i in range(3):
            pg.evaluate("spel.opTik(spel.doel)"); pg.wait_for_timeout(850)
        if naam == 'telefoon': pg.screenshot(path='/tmp/telefoon-race.png')
        d = pg.evaluate('spel.doel'); pg.evaluate(f"spel.opTik('{[i for i in IDS if i != d][0]}')"); pg.wait_for_timeout(1300)
        pg.evaluate("spel.eind = Date.now() + 300"); pg.wait_for_timeout(900)
        check(pg.is_visible('#einde') and pg.inner_text('#einde-tekst').startswith('3 goed'), 'race: 3 goed, record')
        pg.click('#einde-menu'); check(pg.inner_text('#best-race') == '🏆 3', 'race: record op startscherm')
        pg.screenshot(path=f'/tmp/{naam}-start.png')
        pg.close()
    b.close()
print('fouten:', fouten); sys.exit(1 if fouten else 0)
