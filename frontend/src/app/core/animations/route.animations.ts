import { trigger, transition, style, animate, query } from '@angular/animations';

/**
 * Route transition animation — Apple / Linear style smooth in-flow page entry.
 *
 * Design decisions:
 * - In-flow transition: DOES NOT use `position: absolute`. This ensures the routed
 *   page maintains normal document flow from millisecond zero.
 * - Zero CLS (Cumulative Layout Shift): The container (#main-content) always matches
 *   the entering page's real height, permanently preventing footer jumps.
 * - 160ms ease-out: Ultra-crisp, native-app feel with subtle 4px translation.
 */
export const routeTransitionAnimation = trigger('routeAnimation', [
  transition('* <=> *', [
    query(
      ':enter',
      [
        style({
          opacity: 0,
          transform: 'translateY(4px)',
          display: 'block'
        }),
        animate(
          '160ms cubic-bezier(0.16, 1, 0.3, 1)',
          style({
            opacity: 1,
            transform: 'translateY(0)'
          })
        )
      ],
      { optional: true }
    )
  ])
]);