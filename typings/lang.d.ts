interface Dictionary<T> {
    [key: string]: T;
}

type Resolvable<T> = PromiseLike<T> | T;
