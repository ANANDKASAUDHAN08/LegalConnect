import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { guestGuard } from './guards/guest.guard';
import { roleGuard } from './guards/role.guard';

export const routes: Routes = [
  // 1. Entry & Home Page
  { path: '', redirectTo: 'home', pathMatch: 'full' },

  {
    path: 'home',
    loadComponent: () => import('./pages/landing/landing.component').then(m => m.LandingComponent),
    title: 'LegalConnect — Access to Justice for Every Citizen'
  },

  // 2. Authentication Flow (Guest Users Only)
  {
    path: 'login',
    loadComponent: () => import('./pages/auth/login/login.component').then(m => m.LoginComponent),
    canActivate: [guestGuard],
    title: 'Sign In | LegalConnect'
  },
  {
    path: 'register',
    loadComponent: () => import('./pages/auth/register/register.component').then(m => m.RegisterComponent),
    canActivate: [guestGuard],
    title: 'Create Account | LegalConnect'
  },
  {
    path: 'forgot-password',
    loadComponent: () => import('./pages/forgot-password/forgot-password.component').then(m => m.ForgotPasswordComponent),
    canActivate: [guestGuard],
    title: 'Forgot Password | LegalConnect'
  },
  {
    path: 'reset-password',
    loadComponent: () => import('./pages/auth/reset-password/reset-password.component').then(m => m.ResetPasswordComponent),
    canActivate: [guestGuard],
    title: 'Reset Password | LegalConnect'
  },
  { path: 'auth', redirectTo: 'login', pathMatch: 'full' },

  // 3. Indian Laws Reference Library (Public)
  {
    path: 'laws',
    loadComponent: () => import('./pages/browse-laws/browse-laws.component').then(m => m.BrowseLawsComponent),
    title: 'Bare Acts & Indian Legal Library | LegalConnect'
  },
  {
    path: 'laws/mapper',
    loadComponent: () => import('./pages/law-mapper/law-mapper.component').then(m => m.LawMapperComponent),
    title: 'IPC to BNS / CrPC to BNSS Law Mapper | LegalConnect'
  },
  {
    path: 'laws/civil-family',
    loadComponent: () => import('./pages/civil-family-portal/civil-family-portal.component').then(m => m.CivilFamilyPortalComponent),
    title: 'Civil & Family Law Portal | LegalConnect'
  },
  {
    path: 'laws/templates',
    loadComponent: () => import('./pages/document-templates/document-templates.component').then(m => m.DocumentTemplatesComponent),
    title: 'Legal Document Templates & Drafts | LegalConnect'
  },
  {
    path: 'laws/:shortName',
    loadComponent: () => import('./pages/law-viewer/law-viewer.component').then(m => m.LawViewerComponent),
    title: 'Law Reader & AI Navigator | LegalConnect'
  },

  // 4. Search, Directory & Review Sections (Public)
  {
    path: 'search',
    loadComponent: () => import('./pages/search/search.component').then(m => m.SearchComponent),
    title: 'Legal Search Hub | LegalConnect'
  },
  {
    path: 'find-help',
    loadComponent: () => import('./pages/find-help/find-help.component').then(m => m.FindHelpComponent),
    title: 'Free Legal Aid & Emergency Helplines | LegalConnect'
  },
  {
    path: 'lawyers',
    loadComponent: () => import('./pages/lawyers/lawyers.component').then(m => m.LawyersComponent),
    title: 'Find Verified Lawyers & Legal Advocates | LegalConnect'
  },
  {
    path: 'lawyers/:id',
    loadComponent: () => import('./pages/lawyer-detail/lawyer-detail.component').then(m => m.LawyerDetailComponent),
    title: 'Advocate Profile & Consultations | LegalConnect'
  },
  {
    path: 'reviews',
    loadComponent: () => import('./pages/reviews/reviews.component').then(m => m.ReviewsComponent),
    title: 'Verified Client Reviews | LegalConnect'
  },
  {
    path: 'specializations',
    loadComponent: () => import('./pages/specializations/specializations.component').then(m => m.SpecializationsComponent),
    title: 'Legal Practice Specializations | LegalConnect'
  },
  {
    path: 'about',
    loadComponent: () => import('./pages/info/info-page.component').then(m => m.InfoPageComponent),
    title: 'About Us | LegalConnect'
  },
  {
    path: 'privacy',
    loadComponent: () => import('./pages/info/info-page.component').then(m => m.InfoPageComponent),
    title: 'Privacy Policy | LegalConnect'
  },
  {
    path: 'terms',
    loadComponent: () => import('./pages/info/info-page.component').then(m => m.InfoPageComponent),
    title: 'Terms of Service | LegalConnect'
  },
  {
    path: 'contact',
    loadComponent: () => import('./pages/contact/contact.component').then(m => m.ContactComponent),
    title: 'Contact Support & Inquiries | LegalConnect'
  },
  {
    path: 'help',
    loadComponent: () => import('./pages/info/info-page.component').then(m => m.InfoPageComponent),
    title: 'Help Center | LegalConnect'
  },
  {
    path: 'cookie-preferences',
    loadComponent: () => import('./pages/cookie-preferences/cookie-preferences.component').then(m => m.CookiePreferencesComponent),
    title: 'Cookie Preferences | LegalConnect'
  },

  // 5. User Workstations & Dashboards (Auth Required)
  {
    path: 'dashboard',
    loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent),
    canActivate: [authGuard],
    title: 'User Workstation | LegalConnect'
  },
  {
    path: 'lawyer/workstation',
    loadComponent: () => import('./pages/dashboard/advocate-dashboard/advocate-dashboard.component').then(m => m.AdvocateDashboardComponent),
    canActivate: [authGuard, roleGuard],
    data: { expectedRoles: ['Lawyer'] },
    title: 'Advocate Workstation | LegalConnect'
  },
  {
    path: 'client/portal',
    loadComponent: () => import('./pages/dashboard/client-dashboard/client-dashboard.component').then(m => m.ClientDashboardComponent),
    canActivate: [authGuard, roleGuard],
    data: { expectedRoles: ['Client'] },
    title: 'Client Portal | LegalConnect'
  },
  {
    path: 'admin/resources',
    loadComponent: () => import('./pages/admin-resources/admin-resources.component').then(m => m.AdminResourcesComponent),
    canActivate: [authGuard, roleGuard],
    data: { expectedRoles: ['Admin', 'Lawyer', 'Client'] },
    title: 'Manage Resources | LegalConnect'
  },
  {
    path: 'profile',
    loadComponent: () => import('./pages/profile/profile.component').then(m => m.ProfileComponent),
    canActivate: [authGuard],
    title: 'My Profile | LegalConnect'
  },
  {
    path: 'notifications',
    loadComponent: () => import('./pages/notifications/notifications.component').then(m => m.NotificationsComponent),
    canActivate: [authGuard],
    title: 'Notifications | LegalConnect'
  },
  {
    path: 'settings',
    loadComponent: () => import('./pages/settings/settings.component').then(m => m.SettingsComponent),
    canActivate: [authGuard],
    title: 'Settings | LegalConnect'
  },

  { path: '**', redirectTo: '' }
];