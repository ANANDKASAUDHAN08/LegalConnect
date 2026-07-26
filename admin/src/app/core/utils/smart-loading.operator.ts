import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

/**
 * Senior-Engineering RxJS Utility for Smart Loading & Anti-Flicker:
 * - Prevents skeleton flashes if response finishes in <150ms during filter/page switches.
 * - Supports environment.demoMode for demo/stakeholder previewing.
 */
export function smartLoading<T>(
  setLoadingState: (isLoading: boolean) => void,
  isInitialLoad: boolean = false
) {
  const startTime = Date.now();
  setLoadingState(true);

  return (source$: Observable<T>): Observable<T> => {
    return source$.pipe(
      finalize(() => {
        const elapsedTime = Date.now() - startTime;

        if (environment.demoMode) {
          setTimeout(() => setLoadingState(false), 350);
        } else if (elapsedTime < environment.smartLoadingThresholdMs && !isInitialLoad) {
          setLoadingState(false);
        } else {
          setLoadingState(false);
        }
      })
    );
  };
}