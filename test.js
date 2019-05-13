const {Turning} = require('.');

let t = new Turning();

t.initialize(['a']);

t.initialize(['b', 'c']);

t.turn(['a'])
  .to(['a'])
  .by(() => {});

t.turn(['a'])
  .to(['b'])
  .by(() => {});

t.turn(['a'])
  .to(['c'])
  .by(() => {});

t.turn(['a'])
  .to(['b', 'c'])
  .by(() => {});

t.turn(['b', 'c'])
  .to(['d'])
  .by(() => {});

// t.turn([], {match: 'b'})
//   .to([])
//   .by(() => {});

t.sss();
