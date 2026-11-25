# Simulates the host's Claude capability to test the AI paths without spending usage:
# 1) a draft that invents a dollar amount and a date (fact check must flag both)
# 2) AI unavailable (template fallback must appear)
import asyncio, sys
from playwright.async_api import async_playwright
MOCK = """window.claude={use:async(n)=>n==='sample'?Object.assign(async(p,o)=>{const t='Subject: VC-5002 renewal\\n\\nHi [CONFIRM: name],\\nMetroFiber renews 11/05/2026 at $4,746 per month. Please confirm by 12/09/2026; the fee is $5,100.\\n\\n[Your name]';o&&o.onText&&o.onText({text:t});window.__lastPrompt=p;return {text:t}},{json:null}):null};"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--allow-file-access-from-files'])
        for mode in ('mock','none'):
            pg = await b.new_page(viewport={'width':1360,'height':900})
            errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
            if mode=='mock': await pg.add_init_script(MOCK)
            await pg.goto('file://'+sys.argv[1]+'#today'); await pg.wait_for_timeout(1200)
            await pg.click("text=Everything"); await pg.click('details.filters > summary'); await pg.fill('#fQ','VC-5002'); await pg.wait_for_timeout(300)
            await pg.click('.item'); await pg.click('#draftAI'); await pg.wait_for_timeout(800)
            print(mode, '| FLAG:', (await pg.inner_text('#draftFlag'))[:120].replace('\n',' '))
            print(mode, '| CHECK:', await pg.inner_text('#draftCheck'))
            if mode=='mock':
                pr = await pg.evaluate('window.__lastPrompt'); print('prompt has staff-owner rule:', 'Never present that person' in pr, '| prompt length', len(pr))
                await pg.click('#briefAI'); await pg.wait_for_timeout(600); print('brief note:', await pg.inner_text('#briefNote'))
            print(mode,'errors:',errs or 'none')
            await pg.close()
        await b.close()
asyncio.run(main())
