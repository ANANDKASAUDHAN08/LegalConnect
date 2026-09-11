import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

/**
 * Senior-Engineering RxJS Utility for Smart Loading & Anti-Flicker:
 * - Prevents skeleton flashes if response finishes in <150ms during filter/page switches.
 * - Guarantees a minimum skeleton display time (200ms) for responses that trigger the skeleton,
 *   preventing the "blink" effect on responses between 150-400ms.
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
          // Response was fast enough — hide loading instantly (no skeleton flash)
          setLoadingState(false);
        } else {
          // Response triggered visible skeleton — ensure minimum display to prevent blink
          const minDisplayMs = 200;
          const remaining = Math.max(0, minDisplayMs - elapsedTime);
          if (remaining > 0) {
            setTimeout(() => setLoadingState(false), remaining);
          } else {
            setLoadingState(false);
          }
        }
      })
    );
  };
}