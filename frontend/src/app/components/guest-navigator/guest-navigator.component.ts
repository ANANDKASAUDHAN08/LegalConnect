import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';

@Component({
  selector: 'app-guest-navigator',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './guest-navigator.component.html',
  styleUrls: ['./guest-navigator.component.scss']
})
export class GuestNavigatorComponent {
  // Wizard State
  activeHeroTab: 'client' | 'lawyer' = 'client';
  wizardStep = 1;
  selectedWizardCategory = '';
  selectedWizardCity = '';
  wizardDescription = '';
  isCityDropdownOpen = false;

  citiesList = ['Delhi', 'Mumbai', 'Bangalore', 'Chennai', 'Kolkata', 'Hyderabad', 'Ahmedabad'];

  constructor(private router: Router) {}

  selectWizardCategory(category: string) {
    this.selectedWizardCategory = category;
    this.wizardStep = 2;
  }

  submitWizardStep2() {
    if (this.selectedWizardCity) {
      this.wizardStep = 3;
    }
  }

  selectCity(city: string) {
    this.selectedWizardCity = city;
    this.isCityDropdownOpen = false;
  }

  resetWizard() {
    this.wizardStep = 1;
    this.selectedWizardCategory = '';
    this.selectedWizardCity = '';
    this.wizardDescription = '';
    this.isCityDropdownOpen = false;
  }

  getLawLink(index: number): string {
    const rec = this.wizardRecommendation;
    if (rec && rec.lawLinks && rec.lawLinks[index]) {
      return rec.lawLinks[index];
    }
    return '/laws';
  }

  get recommendedLawyerInitials(): string {
    const name = this.wizardRecommendation?.lawyerName;
    if (!name) return 'L';
    return name.replace('Adv. ', '').split(' ').map(n => n[0]).slice(0, 2).join('');
  }

  // Dynamic recommendation helper for the wizard
  get wizardRecommendation() {
    if (!this.selectedWizardCategory || !this.selectedWizardCity) return null;

    const recommendations: { [key: string]: { [key: string]: { laws: string[], lawLinks: string[], lawyerName: string, lawyerEmail: string } } } = {
      'Criminal Law': {
        'Delhi': { laws: ['Bharatiya Nyaya Sanhita (BNS)', 'Bharatiya Nagarik Suraksha Sanhita (BNSS)'], lawLinks: ['/laws/BNS', '/laws'], lawyerName: 'Adv. Priya Sharma', lawyerEmail: 'priya.sharma@legalconnect.in' },
        'Mumbai': { laws: ['Bharatiya Nyaya Sanhita (BNS)', 'Bharatiya Nagarik Suraksha Sanhita (BNSS)'], lawLinks: ['/laws/BNS', '/laws'], lawyerName: 'Adv. Rajesh Kumar', lawyerEmail: 'rajesh.kumar@legalconnect.in' },
        'Bangalore': { laws: ['Bharatiya Nyaya Sanhita (BNS)'], lawLinks: ['/laws/BNS'], lawyerName: 'Adv. Pooja Iyer', lawyerEmail: 'pooja.iyer@legalconnect.in' },
        'default': { laws: ['Bharatiya Nyaya Sanhita (BNS)'], lawLinks: ['/laws/BNS'], lawyerName: 'Adv. Priya Sharma', lawyerEmail: 'priya.sharma@legalconnect.in' }
      },
      'Civil Law': {
        'Mumbai': { laws: ['Code of Civil Procedure (CPC)', 'Indian Contract Act'], lawLinks: ['/laws', '/laws'], lawyerName: 'Adv. Rajesh Kumar', lawyerEmail: 'rajesh.kumar@legalconnect.in' },
        'Delhi': { laws: ['Code of Civil Procedure (CPC)', 'Indian Contract Act'], lawLinks: ['/laws', '/laws'], lawyerName: 'Adv. Priya Sharma', lawyerEmail: 'priya.sharma@legalconnect.in' },
        'default': { laws: ['Code of Civil Procedure (CPC)'], lawLinks: ['/laws'], lawyerName: 'Adv. Rajesh Kumar', lawyerEmail: 'rajesh.kumar@legalconnect.in' }
      },
      'Family Law': {
        'Bangalore': { laws: ['Hindu Marriage Act', 'Special Marriage Act'], lawLinks: ['/laws', '/laws'], lawyerName: 'Adv. Sunita Mehta', lawyerEmail: 'sunita.mehta@legalconnect.in' },
        'default': { laws: ['Family Courts Act'], lawLinks: ['/laws'], lawyerName: 'Adv. Sunita Mehta', lawyerEmail: 'sunita.mehta@legalconnect.in' }
      },
      'Corporate Law': {
        'Delhi': { laws: ['Companies Act, 2013', 'Indian Partnership Act'], lawLinks: ['/laws', '/laws'], lawyerName: 'Adv. Amit Verma', lawyerEmail: 'amit.verma@legalconnect.in' },
        'default': { laws: ['Companies Act, 2013'], lawLinks: ['/laws'], lawyerName: 'Adv. Amit Verma', lawyerEmail: 'amit.verma@legalconnect.in' }
      },
      'Consumer Law': {
        'Chennai': { laws: ['Consumer Protection Act, 2019'], lawLinks: ['/laws'], lawyerName: 'Adv. Kavita Nair', lawyerEmail: 'kavita.nair@legalconnect.in' },
        'default': { laws: ['Consumer Protection Act, 2019'], lawLinks: ['/laws'], lawyerName: 'Adv. Kavita Nair', lawyerEmail: 'kavita.nair@legalconnect.in' }
      },
      'Labour Law': {
        'Ahmedabad': { laws: ['Industrial Disputes Act, 1947', 'Trade Unions Act'], lawLinks: ['/laws', '/laws'], lawyerName: 'Adv. Sanjay Patel', lawyerEmail: 'sanjay.patel@legalconnect.in' },
        'default': { laws: ['Industrial Disputes Act, 1947'], lawLinks: ['/laws'], lawyerName: 'Adv. Sanjay Patel', lawyerEmail: 'sanjay.patel@legalconnect.in' }
      },
      'Intellectual Property': {
        'Mumbai': { laws: ['Trade Marks Act, 1999', 'Copyright Act, 1957'], lawLinks: ['/laws', '/laws'], lawyerName: 'Adv. Neha Gupta', lawyerEmail: 'neha.gupta@legalconnect.in' },
        'default': { laws: ['Trade Marks Act, 1999'], lawLinks: ['/laws'], lawyerName: 'Adv. Neha Gupta', lawyerEmail: 'neha.gupta@legalconnect.in' }
      }
    };

    const categoryData = recommendations[this.selectedWizardCategory] || recommendations['Civil Law'];
    return categoryData[this.selectedWizardCity] || categoryData['default'];
  }
}
