/**
 * NEXA NautaX — HealthReporter
 *  — Doc 2 §10 +  — Doc 3 §7
 *
 * Recibe eventos del connector y mantiene el estado de salud.
 * Lo consume DiagnosticEngine / Developer Mode.
 */

import type {
  ConnectorHealth,
  EtecsaError,
  HttpTiming,
  StrategyName,
} from '../contracts/types';

export interface HealthReporter {
  markSuccess(
    operation: string,
    strategy: StrategyName,
    timing: HttpTiming,
  ): void;

  markFailure(
    operation: string,
    strategy: StrategyName,
    error: EtecsaError,
  ): void;

  markFallback(
    operation: string,
    from: StrategyName,
    to: StrategyName,
  ): void;

  snapshot(): ConnectorHealth;
  reset(): void;
}

export class DefaultHealthReporter implements HealthReporter {
  private state: ConnectorHealth = {
    lastOperation: null,
    lastSuccessAt: null,
    lastError: null,
    currentStrategy: 'KnownEndpoint',
    consecutiveFailures: 0,
    totalOperations: 0,
    totalSuccesses: 0,
    totalFailures: 0,
  };

  private readonly onDegraded?: ((consecutiveFailures: number) => void) | undefined;
  private readonly onRecovered?: (() => void) | undefined;

  constructor(callbacks?: {
    onDegraded?: (consecutiveFailures: number) => void;
    onRecovered?: () => void;
  }) {
    this.onDegraded = callbacks?.onDegraded;
    this.onRecovered = callbacks?.onRecovered;
  }

  markSuccess(
    operation: string,
    strategy: StrategyName,
    _timing: HttpTiming,
  ): void {
    const wasDegraded = this.state.consecutiveFailures >= 3;

    this.state = {
      ...this.state,
      lastOperation: operation as ConnectorHealth['lastOperation'],
      lastSuccessAt: Date.now(),
      lastError: null,
      currentStrategy: strategy,
      consecutiveFailures: 0,
      totalOperations: this.state.totalOperations + 1,
      totalSuccesses: this.state.totalSuccesses + 1,
    };

    if (wasDegraded) {
      this.onRecovered?.();
    }

    console.debug('[HealthReporter] Success', {
      operation,
      strategy,
      total: this.state.totalOperations,
    });
  }

  markFailure(
    operation: string,
    strategy: StrategyName,
    error: EtecsaError,
  ): void {
    const newConsecutiveFailures = this.state.consecutiveFailures + 1;

    this.state = {
      ...this.state,
      lastOperation: operation as ConnectorHealth['lastOperation'],
      lastError: error,
      currentStrategy: strategy,
      consecutiveFailures: newConsecutiveFailures,
      totalOperations: this.state.totalOperations + 1,
      totalFailures: this.state.totalFailures + 1,
    };

    if (newConsecutiveFailures === 3) {
      this.onDegraded?.(newConsecutiveFailures);
    }

    console.warn('[HealthReporter] Failure', {
      operation,
      strategy,
      error: error.code,
      consecutive: newConsecutiveFailures,
    });
  }

  markFallback(
    operation: string,
    from: StrategyName,
    to: StrategyName,
  ): void {
    this.state = {
      ...this.state,
      currentStrategy: to,
    };

    console.info('[HealthReporter] Fallback', { operation, from, to });
  }

  snapshot(): ConnectorHealth {
    return { ...this.state };
  }

  reset(): void {
    this.state = {
      lastOperation: null,
      lastSuccessAt: null,
      lastError: null,
      currentStrategy: 'KnownEndpoint',
      consecutiveFailures: 0,
      totalOperations: 0,
      totalSuccesses: 0,
      totalFailures: 0,
    };
  }
}

// Singleton
let healthReporterInstance: HealthReporter | null = null;

export function getHealthReporter(): HealthReporter {
  if (healthReporterInstance === null) {
    healthReporterInstance = new DefaultHealthReporter({
      onDegraded: (n) => {
        console.warn(`[HealthReporter] Connector degraded (${n} consecutive failures)`);
      },
      onRecovered: () => {
        console.info('[HealthReporter] Connector recovered');
      },
    });
  }
  return healthReporterInstance;
}

export function setHealthReporter(reporter: HealthReporter): void {
  healthReporterInstance = reporter;
}
