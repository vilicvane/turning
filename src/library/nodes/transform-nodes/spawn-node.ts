import {TransformNode} from './transform-node';

export type SpawnHandler<T> = (object: T) => Promise<T> | T;

export class SpawnNode<T> extends TransformNode {
  handler: SpawnHandler<T> | undefined;
  verifyHandler: SpawnVerifyHandler<T> | undefined;

  constructor(toStates: Set<string>) {
    super();
    this.toStateSet = toStates;
  }

  get description(): string {
    let description = `Spawn [${Array.from(
      this.toStateSet,
    )}] from [${Array.from(this.fromStateSet)}]`;

    if (this._description) {
      description += `by ${this._description}`;
    }

    return description;
  }

  from(states: string | string[]): SpawnFromNode<T> {
    if (typeof states === 'string') {
      states = [states];
    }

    this.fromStateSet = new Set(states);

    return new SpawnFromNode(this);
  }
}

export class SpawnFromNode<T> {
  constructor(public node: SpawnNode<T>) {}

  by(description: string, handler: SpawnHandler<T>): SpawnResultNode<T>;
  by(handler: SpawnHandler<T>): SpawnResultNode<T>;
  by(
    description: string | SpawnHandler<T>,
    handler?: SpawnHandler<T>,
  ): SpawnResultNode<T> {
    if (typeof description === 'string') {
      this.node._description = description;
      this.node.handler = handler!;
    } else {
      this.node.handler = description;
    }

    return new SpawnResultNode(this.node);
  }
}

export type SpawnVerifyHandler<T> = (
  spawned: T,
  original: T,
) => Promise<void> | void;

export class SpawnResultNode<T> {
  constructor(public node: SpawnNode<T>) {}

  verify(handler: SpawnVerifyHandler<T>): void {
    this.node.verifyHandler = handler;
  }
}
