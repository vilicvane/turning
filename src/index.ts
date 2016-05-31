interface Constructor<T> {
    new(...args: any[]): T;
}

export interface StackFrame<T> {
    target: T;
    node: TransformNode<T>;
}

export class Turning<T> {
    defineMap = new Map<string, DefineNode<T>>();
    inits: InitNode<T>[] = [];
    transforms: TransformNode<T>[] = [];

    maxDepth = 3;
    maxRepeat = 1;

    define(state: string): DefineNode<T> {
        let node = new DefineNode(state);
        this.defineMap.set(state, node);
        return node;
    }

    init(states: string | string[]): InitNode<T> {
        if (typeof states === 'string') {
            states = [states];
        }

        let node = new InitNode<T>(new Set(states));
        this.inits.push(node);
        return node;
    }

    turn(states: string | string[]): TurnNode<T> {
        if (typeof states === 'string') {
            states = [states];
        }

        let node = new TurnNode<T>(new Set(states));
        this.transforms.push(node);
        return node;
    }

    spawn(states: string | string[]): SpawnNode<T> {
        if (typeof states === 'string') {
            states = [states];
        }

        let node = new SpawnNode<T>(new Set(states));
        this.transforms.push(node);
        return node;
    }

    start(): void {

    }

    search() {
        for (let initNode of this.inits) {
            let states = initNode.stateSet;
            this.next(states, []);
        }
    }

    next(states: Set<string>, stack: StackFrame<T>[]): void {
        if (stack.length > this.maxDepth) {
            return;
        }

        let transforms = this
            .transforms
            .filter(transformNode => transformNode.test(states));

        for (let transformNode of transforms) {
            let frame: StackFrame<T> = {
                target: undefined!,
                node: transformNode
            };

            this.next(transformNode.toStateSet, stack.concat(frame));
        }
    }
}

export interface TurningNode<T> {
    byDescription: string | undefined;
    description: string;
}

export abstract class TransformNode<T> implements TurningNode<T> {
    byDescription: string | undefined;

    fromStateSet: Set<string>;
    toStateSet: Set<string>;

    abstract get description(): string;

    test(states: Set<string>): boolean {
        for (let state of this.fromStateSet) {
            if (!states.has(state)) {
                return false;
            }
        }

        return true;
    }
}

export class DefineNode<T> {
    verifyHandler: VerifyHandler<T>;

    constructor(
        public state: string
    ) { }

    verify(handler: VerifyHandler<T>): void {
        this.verifyHandler = handler;
    }
}

export type InitHandler<T> = () => Resolvable<T>;

export class InitNode<T> implements TurningNode<T> {
    byDescription: string | undefined;

    handler: InitHandler<T>;
    verifyHandler: VerifyHandler<T>;

    constructor(
        public stateSet: Set<string>
    ) { }

    get description(): string {
        let description = `Initialize [${Array.from(this.stateSet)}]`;

        if (this.byDescription) {
            description += ` by ${this.byDescription}`;
        }

        return description;
    }

    by(description: string, handler: InitHandler<T>): ResultNode<T>;
    by(handler: InitHandler<T>): ResultNode<T>;
    by(description: string | InitHandler<T>, handler?: InitHandler<T>): ResultNode<T> {
        if (typeof description === 'string') {
            this.byDescription = description;
            this.handler = handler!;
        } else {
            this.handler = description;
        }

        return new ResultNode(this);
    }
}

export type TurnHandler<T> = (object: T) => Resolvable<T | void>;

export class TurnNode<T> extends TransformNode<T> {
    handler: TurnHandler<T>;
    verifyHandler: VerifyHandler<T>;

    constructor(fromStates: Set<string>) {
        super();
        this.fromStateSet = fromStates;
    }

    get description(): string {
        let description = `Turn [${Array.from(this.fromStateSet)}] to [${Array.from(this.toStateSet)}]`;

        if (this.byDescription) {
            description += ` by ${this.byDescription}`;
        }

        return description;
    }

    to(states: string | string[]): TurnToNode<T> {
        if (typeof states === 'string') {
            states = [states];
        }

        this.toStateSet = new Set(states);

        return new TurnToNode(this);
    }
}

export class TurnToNode<T> {
    constructor(
        public node: TurnNode<T>
    ) { }

    by(description: string, handler: TurnHandler<T>): ResultNode<T>;
    by(handler: TurnHandler<T>): ResultNode<T>;
    by(description: string | TurnHandler<T>, handler?: TurnHandler<T>): ResultNode<T> {
        if (typeof description === 'string') {
            this.node.byDescription = description;
            this.node.handler = handler!;
        } else {
            this.node.handler = description;
        }

        return new ResultNode(this.node);
    }
}

export class SpawnNode<T> extends TransformNode<T> {
    handler: SpawnHandler<T>;
    verifyHandler: SpawnVerifyHandler<T>;

    constructor(toStates: Set<string>) {
        super();
        this.toStateSet = toStates;
    }

    get description(): string {
        let description = `Spawn [${Array.from(this.toStateSet)}] from [${Array.from(this.fromStateSet)}]`;

        if (this.byDescription) {
            description += `by ${this.byDescription}`;
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

export type SpawnHandler<T> = (object: T) => Resolvable<T>;

export class SpawnFromNode<T> {
    constructor(
        public node: SpawnNode<T>
    ) { }

    by(description: string, handler: SpawnHandler<T>): SpawnResultNode<T>;
    by(handler: SpawnHandler<T>): SpawnResultNode<T>;
    by(description: string | SpawnHandler<T>, handler?: SpawnHandler<T>): SpawnResultNode<T> {
        if (typeof description === 'string') {
            this.node.byDescription = description;
            this.node.handler = handler!;
        } else {
            this.node.handler = description;
        }

        return new SpawnResultNode(this.node);
    }
}

export type VerifyHandler<T> = (object: T) => Resolvable<void>;

export interface WithVerifyHandler<T> {
    verifyHandler: VerifyHandler<T>;
}

export class ResultNode<T> {
    constructor(
        public node: WithVerifyHandler<T>
    ) { }

    verify(handler: VerifyHandler<T>): void {
        this.node.verifyHandler = handler;
    }
}

export type SpawnVerifyHandler<T> = (spawned: T, original: T) => Resolvable<void>;

export class SpawnResultNode<T> {
    constructor(
        public node: SpawnNode<T>
    ) { }

    verify(handler: SpawnVerifyHandler<T>): void {
        this.node.verifyHandler = handler;
    }
}
