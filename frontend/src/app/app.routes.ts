import { Routes } from '@angular/router';
import { LandingComponent } from './pages/landing/landing.component';
import { BrowseLawsComponent } from './pages/browse-laws/browse-laws.component';
import { LawViewerComponent } from './pages/law-viewer/law-viewer.component';
import { AuthComponent } from './pages/auth/auth.component';
import { ForgotPasswordComponent } from './pages/forgot-password/forgot-password.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { SearchComponent } from './pages/search/search.component';
import { LawyersComponent } from './pages/lawyers/lawyers.component';
import { ProfileComponent } from './pages/profile/profile.component';
import { NotificationsComponent } from './pages/notifications/notifications.component';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '',        component: LandingComponent },
  { path: 'laws',    component: BrowseLawsComponent },
  { path: 'laws/:shortName', component: LawViewerComponent },
  { path: 'auth',    component: AuthComponent },
  { path: 'forgot-password', component: ForgotPasswordComponent },
  { path: 'login',   redirectTo: 'auth', pathMatch: 'full' },
  { path: 'register', redirectTo: 'auth?tab=register', pathMatch: 'full' },
  { path: 'dashboard', component: DashboardComponent, canActivate: [authGuard] },
  { path: 'profile', component: ProfileComponent, canActivate: [authGuard] },
  { path: 'notifications', component: NotificationsComponent },
  { path: 'search',  component: SearchComponent },
  { path: 'lawyers', component: LawyersComponent },
  { path: '**',      redirectTo: '' }
];
