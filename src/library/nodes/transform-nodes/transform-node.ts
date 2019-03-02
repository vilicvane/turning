import assert from 'assert';

import {ITurningNode} from '../common';

export abstract class TransformNode implements ITurningNode {
  _description: string | undefined;

  protected fromStateSet!: Set<string>;
  protected toStateSet!: Set<string>;

  abstract get description(): string;

  transform(stateSet: Set<string>): Set<string> | undefined {
    stateSet = new Set(stateSet);

    let fromStateSet = this.fromStateSet;
    let toStateSet = this.toStateSet;

    assert(fromStateSet);
    assert(toStateSet);

    for (let state of fromStateSet) {
      if (stateSet.has(state)) {
        stateSet.delete(state);
      } else {
        return undefined;
      }
    }

    for (let state of toStateSet) {
      stateSet.add(state);
    }

    return stateSet;
  }
}
