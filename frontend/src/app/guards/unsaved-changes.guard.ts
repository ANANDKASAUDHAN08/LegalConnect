import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';

/**
 * Interface for components that want unsaved changes protection.
 * Implement this in any component that has forms with dirty state.
 */
export interface HasUnsavedChanges {
  hasUnsavedChanges(): boolean;
}

/**
 * CanDeactivate guard that prevents navigation when a form has unsaved changes.
 * Uses the native browser confirm dialog for maximum compatibility.
 *
 * Usage in routes:
 *   { path: 'profile', component: ProfileComponent, canDeactivate: [unsavedChangesGuard] }
 *
 * The component must implement the HasUnsavedChanges interface:
 *   hasUnsavedChanges(): boolean { return this.profileForm.dirty; }
 */
export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = (component) => {
  if (component.hasUnsavedChanges && component.hasUnsavedChanges()) {
    return window.confirm(
      'You have unsaved changes. Are you sure you want to leave this page? Your changes will be lost.'
    );
  }
  return true;
};