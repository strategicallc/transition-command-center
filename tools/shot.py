import sys, asyncio
from playwright.async_api import async_playwright
async def main(url, out, w, h, actions):
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--allow-file-access-from-files'])
        pg = await b.new_page(viewport={'width': w, 'height': h})
        errs=[]
        pg.on('console', lambda m: errs.append(m.type+': '+m.text) if m.type in ('error','warning') else None)
        pg.on('pageerror', lambda e: errs.append('PAGEERROR: '+str(e)))
        await pg.goto(url); await pg.wait_for_timeout(1200)
        for a in actions:
            if a.startswith('click:'): await pg.click(a[6:]); await pg.wait_for_timeout(400)
            elif a.startswith('fill:'): sel,val=a[5:].split('=',1); await pg.fill(sel,val); await pg.dispatch_event(sel,'change'); await pg.wait_for_timeout(400)
            elif a.startswith('js:'): print(await pg.evaluate(a[3:]))
        await pg.screenshot(path=out, full_page=True)
        print('\n'.join(errs) or 'no console errors')
        await b.close()
args=sys.argv
asyncio.run(main(args[1], args[2], int(args[3]), int(args[4]), args[5:]))
