
```ts
import * as Turning from 'turning';

let turning = new Turning();

turning
    .init(Page, ['opened', 'not-logged-in'])
    .by(() => {
        return new Page();
    })
    .verify(page => {
        page.opened.should.be.true;
        page.loggedIn.should.be.false;
    });

turning
    .turn(Page, 'not-logged-in')
    .to('logged-in')
    .by(async page => {
        await page.logIn('username', 'password');
    })
    .verify(page => {
        page.loggedIn.should.be.true;
    });

```
