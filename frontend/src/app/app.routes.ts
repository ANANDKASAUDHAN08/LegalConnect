import { Routes } from '@angular/router';
import { LandingComponent } from './pages/landing/landing.component';
import { BrowseLawsComponent } from './pages/browse-laws/browse-laws.component';
import { LawViewerComponent } from './pages/law-viewer/law-viewer.component';
import { LoginComponent } from './pages/auth/login/login.component';
import { RegisterComponent } from './pages/auth/register/register.component';
import { ResetPasswordComponent } from './pages/auth/reset-password/reset-password.component';
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
  { path: 'login',   component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'forgot-password', component: ForgotPasswordComponent },
  { path: 'reset-password', component: ResetPasswordComponent },
  { path: 'auth',    redirectTo: 'login', pathMatch: 'full' },
  { path: 'dashboard', component: DashboardComponent, canActivate: [authGuard] },
  { path: 'profile', component: ProfileComponent, canActivate: [authGuard] },
  { path: 'notifications', component: NotificationsComponent },
  { path: 'search',  component: SearchComponent },
  { path: 'lawyers', component: LawyersComponent },
  { path: '**',      redirectTo: '' }
];
