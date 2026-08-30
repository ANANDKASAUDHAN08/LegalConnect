import { Routes } from '@angular/router';
import { adminAuthGuard } from './core/auth.guard';
import { adminGuestGuard } from './core/guest.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent),
    canActivate: [adminGuestGuard]
  },
  {
    path: '',
    loadComponent: () => import('./layout/layout.component').then(m => m.LayoutComponent),
    canActivate: [adminAuthGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent),
        title: 'Dashboard | LegalConnect Admin'
      },
      {
        path: 'users',
        loadComponent: () => import('./pages/users/users.component').then(m => m.UsersComponent),
        title: 'User Management | LegalConnect Admin'
      },
      {
        path: 'lawyers',
        loadComponent: () => import('./pages/lawyers/lawyers.component').then(m => m.LawyersComponent),
        title: 'Lawyer Management | LegalConnect Admin'
      },
      {
        path: 'support',
        loadComponent: () => import('./pages/support/support.component').then(m => m.SupportComponent),
        title: 'Support & Grievances | LegalConnect Admin'
      },
      {
        path: 'announcements',
        loadComponent: () => import('./pages/announcements/announcements.component').then(m => m.AnnouncementsComponent),
        title: 'Announcements Broadcast | LegalConnect Admin'
      },
      {
        path: 'notifications',
        loadComponent: () => import('./pages/notifications/notifications.component').then(m => m.NotificationsComponent),
        title: 'Notifications & Telemetry Hub | LegalConnect Admin'
      },
      {
        path: 'security',
        loadComponent: () => import('./pages/security/security.component').then(m => m.SecurityComponent),
        title: 'Security & Sessions | LegalConnect Admin'
      },
      {
        path: 'reviews',
        loadComponent: () => import('./pages/reviews/reviews.component').then(m => m.ReviewsComponent),
        title: 'Review Moderation | LegalConnect Admin'
      },
      {
        path: 'moderation',
        loadComponent: () => import('./pages/moderation/moderation.component').then(m => m.ModerationComponent),
        title: 'Content Moderation Desk | LegalConnect Admin'
      },
      {
        path: 'consultations',
        loadComponent: () => import('./pages/consultations/consultations.component').then(m => m.ConsultationsComponent),
        title: 'Consultations Tracking | LegalConnect Admin'
      },
      {
        path: 'legal-content',
        loadComponent: () => import('./pages/legal-content/legal-content.component').then(m => m.LegalContentComponent),
        title: 'Bare Acts & Statutory Content | LegalConnect Admin'
      },
      {
        path: 'legal-content/:shortName',
        loadComponent: () => import('./pages/legal-content/act-detail/act-detail.component').then(m => m.ActDetailComponent),
        title: 'Statutory Act Reader & Editor | LegalConnect Admin'
      },
      {
        path: 'resources',
        loadComponent: () => import('./pages/resources/resources.component').then(m => m.ResourcesComponent),
        title: 'Legal Resources Management | LegalConnect Admin'
      },
      {
        path: 'helplines',
        loadComponent: () => import('./pages/helplines/helplines.component').then(m => m.HelplinesComponent),
        title: 'Helplines & Help Content | LegalConnect Admin'
      },
      {
        path: 'consent',
        loadComponent: () => import('./pages/consent/consent.component').then(m => m.ConsentComponent),
        title: 'Consent & Compliance Dashboard | LegalConnect Admin'
      },
      {
        path: 'templates',
        loadComponent: () => import('./pages/templates/templates.component').then(m => m.TemplatesComponent),
        title: 'Legal Templates & Drafts Analytics | LegalConnect Admin'
      },
      {
        path: 'bookmarks',
        loadComponent: () => import('./pages/bookmarks/bookmarks.component').then(m => m.BookmarksComponent),
        title: 'Bookmarks & Research Telemetry | LegalConnect Admin'
      },
      {
        path: 'account',
        loadComponent: () => import('./pages/account/account.component').then(m => m.AccountComponent),
        title: 'Account Security | LegalConnect Admin'
      }
    ]
  },
  { path: '**', redirectTo: 'login' }
];