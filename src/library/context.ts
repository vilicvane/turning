import {EventEmitter} from 'events';

abstract class TurningContext extends EventEmitter {
  spawn(): this {
    throw new Error(
      'Implementation of `TurningContext#spawn` is required for using spawn transition',
    );
  }
}

export const AbstractTurningContext = TurningContext;

export interface ITurningContext extends TurningContext {}
