import { InjectionToken, Provider } from '@angular/core';

//import {  } from "../workers/worker.worker";

export const HTTP_WORKER_SERVICE = new InjectionToken<Worker>('HTTP_WORKER_SERVICE');

export function workerFactory(): Worker {
  return new Worker(new URL('./worker.worker.ts', import.meta.url), {type: 'module'});
}

export const WORKER_PROVIDER: Provider = {provide: HTTP_WORKER_SERVICE, useFactory: workerFactory};