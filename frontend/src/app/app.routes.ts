import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { guestGuard } from './guards/guest.guard';
import { roleGuard } from './guards/role.guard';

export const routes: Routes = [
  // 1. Entry & Home Page
  { path: '', redirectTo: 'home', pathMatch: 'full' },

  {
    path: 'home',
    loadComponent: () => import('./pages/landing/landing.component').then(m => m.LandingComponent)
  },

  // 2. Authentication Flow (Guest Users Only)
  {
    path: 'login',
    loadComponent: () => import('./pages/auth/login/login.component').then(m => m.LoginComponent),
    canActivate: [guestGuard]
  },
  {
    path: 'register',
    loadComponent: () => import('./pages/auth/register/register.component').then(m => m.RegisterComponent),
    canActivate: [guestGuard]
  },
  {
    path: 'forgot-password',
    loadComponent: () => import('./pages/forgot-password/forgot-password.component').then(m => m.ForgotPasswordComponent),
    canActivate: [guestGuard]
  },
  {
    path: 'reset-password',
    loadComponent: () => import('./pages/auth/reset-password/reset-password.component').then(m => m.ResetPasswordComponent),
    canActivate: [guestGuard]
  },
  { path: 'auth', redirectTo: 'login', pathMatch: 'full' },

  // 3. Indian Laws Reference Library (Public)
  {
    path: 'laws',
    loadComponent: () => import('./pages/browse-laws/browse-laws.component').then(m => m.BrowseLawsComponent)
  },
  {
    path: 'laws/:shortName',
    loadComponent: () => import('./pages/law-viewer/law-viewer.component').then(m => m.LawViewerComponent)
  },

  // 4. Search, Directory & Review Sections (Public)
  {
    path: 'search',
    loadComponent: () => import('./pages/search/search.component').then(m => m.SearchComponent)
  },
  {
    path: 'lawyers',
    loadComponent: () => import('./pages/lawyers/lawyers.component').then(m => m.LawyersComponent)
  },
  {
    path: 'lawyers/:id',
    loadComponent: () => import('./pages/lawyer-detail/lawyer-detail.component').then(m => m.LawyerDetailComponent)
  },
  {
    path: 'reviews',
    loadComponent: () => import('./pages/reviews/reviews.component').then(m => m.ReviewsComponent)
  },
  {
    path: 'specializations',
    loadComponent: () => import('./pages/specializations/specializations.component').then(m => m.SpecializationsComponent)
  },

  // 5. User Workstations & Dashboards (Auth Required)
  {
    path: 'dashboard',
    loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent),
    canActivate: [authGuard]
  },
  {
    path: 'lawyer/workstation',
    loadComponent: () => import('./pages/dashboard/advocate-dashboard/advocate-dashboard.component').then(m => m.AdvocateDashboardComponent),
    canActivate: [authGuard, roleGuard],
    data: { expectedRoles: ['Lawyer'] }
  },
  {
    path: 'client/portal',
    loadComponent: () => import('./pages/dashboard/client-dashboard/client-dashboard.component').then(m => m.ClientDashboardComponent),
    canActivate: [authGuard, roleGuard],
    data: { expectedRoles: ['Client'] }
  },
  {
    path: 'profile',
    loadComponent: () => import('./pages/profile/profile.component').then(m => m.ProfileComponent),
    canActivate: [authGuard]
  },
  {
    path: 'notifications',
    loadComponent: () => import('./pages/notifications/notifications.component').then(m => m.NotificationsComponent),
    canActivate: [authGuard]
  },
  {
    path: 'settings',
    loadComponent: () => import('./pages/settings/settings.component').then(m => m.SettingsComponent),
    canActivate: [authGuard],
    title: 'Settings | LegalConnect'
  },

  { path: '**', redirectTo: '' }
];