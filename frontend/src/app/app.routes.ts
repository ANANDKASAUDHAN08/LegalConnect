import { Routes } from '@angular/router';
import { LandingComponent } from './pages/landing/landing.component';
import { BrowseLawsComponent } from './pages/browse-laws/browse-laws.component';
import { LawViewerComponent } from './pages/law-viewer/law-viewer.component';
import { LoginComponent } from './pages/login/login.component';
import { RegisterComponent } from './pages/register/register.component';

export const routes: Routes = [
  { path: '',        component: LandingComponent },
  { path: 'laws',    component: BrowseLawsComponent },
  { path: 'laws/:shortName', component: LawViewerComponent },
  { path: 'login',   component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: '**',      redirectTo: '' }
];
