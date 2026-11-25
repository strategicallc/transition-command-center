# Interaction test for the Monday view: Start here, Mark handled, grouping, Draft email, undo.
import asyncio, sys
from playwright.async_api import async_playwright
async def main(path):
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--allow-file-access-from-files'])
        pg = await b.new_page(viewport={'width':1360,'height':900}); errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file://'+path+'#today'); await pg.wait_for_timeout(1200)
        t = lambda s: pg.inner_text(s)
        first = await pg.evaluate("document.querySelector('.scard .idtag').innerText")
        print('start cards:', await pg.evaluate("[...document.querySelectorAll('.scard .idtag')].map(x=>x.innerText).join(', ')"))
        await pg.click('.scard [data-done]'); await pg.wait_for_timeout(300)
        print('after handling', first, '-> cards:', await pg.evaluate("[...document.querySelectorAll('.scard .idtag')].map(x=>x.innerText).join(', ')"))
        print('tile:', (await t('#tiles .tile:nth-child(2) .n')), '| queue:', await t('#queueCount'))
        await pg.click('.scard [data-draft]'); await pg.wait_for_timeout(500)
        print('draft opened for:', await t('#detail h3'), '| draft starts:', (await pg.input_value('#draft'))[:60].replace('\n',' '))
        print('check:', await t('#draftCheck'))
        await pg.click('#scopeSeg [data-v=now]'); await pg.wait_for_timeout(200)
        await pg.click('details.grp >> nth=0 >> summary'); await pg.wait_for_timeout(200)
        print('group 1 open rows:', await pg.evaluate("document.querySelectorAll('details.grp')[0].querySelectorAll('.qrow').length"))
        await pg.click('details.filters > summary'); await pg.select_option('#fReview', '*'); await pg.wait_for_timeout(200)
        print('with handled shown:', await t('#queueCount'))
        await pg.click('[data-done="%s"]' % first); await pg.wait_for_timeout(300)
        print('after undo cards:', await pg.evaluate("[...document.querySelectorAll('.scard .idtag')].map(x=>x.innerText).join(', ')"))
        await pg.screenshot(path='/tmp/m2.png', full_page=False)
        print('errors:', errs or 'none'); await b.close()
asyncio.run(main(sys.argv[1]))
