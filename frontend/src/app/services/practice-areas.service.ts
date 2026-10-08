import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { IconName } from '../components/icon/icon.types';

export interface PracticeArea {
  id: string;
  name: string;
  icon: IconName;
  category: string;
  description: string;
  subfields: string[];
  relevantActs: string[];
  typicalForums: string[];
  popular?: boolean;
  advocateCount?: number;
}

export interface PracticeCategoryCount {
  name: string;
  count: number;
}

export interface PracticeAreasResponse {
  success: boolean;
  totalCount: number;
  categories: PracticeCategoryCount[];
  data: PracticeArea[];
}

@Injectable({ providedIn: 'root' })
export class PracticeAreasService {
  private http = inject(HttpClient);
  private apiUrl = '/api/info/practice-areas';

  // Signals for reactive state
  practiceAreas = signal<PracticeArea[]>([]);
  categories = signal<PracticeCategoryCount[]>([]);
  isLoading = signal<boolean>(false);
  activeFilterCategory = signal<string>('All');
  searchQuery = signal<string>('');
  sortBy = signal<'popular' | 'alpha-asc' | 'alpha-desc' | 'advocates'>('popular');

  // Client-side fallback seed if backend connection fails
  private readonly fallbackCatalog: PracticeArea[] = [
    {
      id: 'criminal-law',
      name: 'Criminal Law',
      icon: 'scale',
      category: 'Criminal Justice',
      description: 'Defense against statutory criminal charges under the Bharatiya Nyaya Sanhita (BNS) and legacy IPC, covering bail hearings, trials, and High Court appeals.',
      subfields: ['NDPS Cases', 'Bail Matters', 'Criminal Appeals', 'Trials', 'White Collar Defense'],
      relevantActs: ['Bharatiya Nyaya Sanhita (BNS)', 'Bharatiya Nagarik Suraksha Sanhita (BNSS)', 'Arms Act'],
      typicalForums: ['Sessions Court', 'High Court', 'Supreme Court of India'],
      popular: true,
      advocateCount: 14
    },
    {
      id: 'bail-matters',
      name: 'Bail Matters & Remand',
      icon: 'key',
      category: 'Criminal Justice',
      description: 'Emergency legal representation for securing anticipatory bail, transit bail, regular bail, and statutory default bail under BNSS provisions.',
      subfields: ['Anticipatory Bail', 'Regular Bail', 'Transit Bail', 'Default Bail (Sec 479 BNSS)'],
      relevantActs: ['BNSS 2023 Sec 480', 'BNSS 2023 Sec 482', 'Constitution Art 21'],
      typicalForums: ['Magistrate Court', 'Sessions Court', 'High Court'],
      popular: true,
      advocateCount: 19
    },
    {
      id: 'property-disputes',
      name: 'Property Disputes & Land Law',
      icon: 'home',
      category: 'Real Estate & Property',
      description: 'Resolution of property conflicts regarding clear titles, partition suits, boundary disputes, unlawful possession, and ancestral estate claims.',
      subfields: ['Title Verification', 'Partition Suits', 'Encroachment Actions', 'Inheritance Disputes'],
      relevantActs: ['Transfer of Property Act 1882', 'Specific Relief Act 1963', 'Registration Act 1908'],
      typicalForums: ['Civil Court (Senior Division)', 'District Court', 'Revenue Tribunal'],
      popular: true,
      advocateCount: 18
    },
    {
      id: 'cyber-crime',
      name: 'Cyber Crime & Online Fraud',
      icon: 'lock',
      category: 'Technology & Privacy',
      description: 'Representation in online financial scams, phishing attacks, identity theft, data breach investigations, and IT Act infractions.',
      subfields: ['UPI Fraud', 'Phishing & Identity Theft', 'Section 66D IT Act', 'Crypto Scam Inquiries'],
      relevantActs: ['Information Technology Act 2000', 'BNS 2023', 'DPDP Act 2023'],
      typicalForums: ['Cyber Crime Police Stations', 'Adjudicating Officer IT Act', 'Sessions Court'],
      popular: true,
      advocateCount: 12
    },
    {
      id: 'family-law',
      name: 'Family Law & Domestic Relations',
      icon: 'users',
      category: 'Personal & Family Relations',
      description: 'Holistic handling of sensitive matrimonial matters, personal law rights, mutual consent separations, and division of joint matrimonial assets.',
      subfields: ['Mutual Consent Divorce', 'Contested Divorce', 'Alimony & Maintenance', 'Restitution of Conjugal Rights'],
      relevantActs: ['Hindu Marriage Act 1955', 'Special Marriage Act 1954', 'Indian Divorce Act 1869'],
      typicalForums: ['Family Court', 'High Court'],
      popular: true,
      advocateCount: 16
    },
    {
      id: 'consumer-protection',
      name: 'Consumer Complaints & Redressal',
      icon: 'shield',
      category: 'Public & Consumer Rights',
      description: 'Representing consumers against defective goods, airline delays, insurance claim repudiations, medical negligence, and misleading advertising.',
      subfields: ['Defective Products', 'Insurance Claim Rejection', 'E-commerce Defaults', 'Medical Negligence'],
      relevantActs: ['Consumer Protection Act 2019'],
      typicalForums: ['District Consumer Commission', 'State Consumer Commission', 'NCDRC'],
      popular: true,
      advocateCount: 11
    },
    {
      id: 'corporate-law',
      name: 'Corporate Law & Governance',
      icon: 'briefcase',
      category: 'Corporate & Commercial',
      description: 'Counseling companies and boards on statutory compliance, shareholder agreements, corporate restructuring, and regulatory disclosures.',
      subfields: ['Company Incorporation', 'Shareholder Disputes', 'Director Liabilities', 'Board Governance'],
      relevantActs: ['Companies Act 2013', 'SEBI Regulations', 'FEMA 1999'],
      typicalForums: ['NCLT', 'NCLAT', 'High Court'],
      popular: true,
      advocateCount: 15
    },
    {
      id: 'tax-law',
      name: 'Tax Law & Direct Taxation',
      icon: 'file-text',
      category: 'Taxation & Revenue',
      description: 'Advising individuals and corporations on income tax assessments, scrutiny notices, search & seizure proceedings, and ITAT appeals.',
      subfields: ['Income Tax Appeals', 'Scrutiny Notices', 'Tax Evasion Defense', 'Transfer Pricing'],
      relevantActs: ['Income Tax Act 1961', 'Finance Acts'],
      typicalForums: ['CIT (Appeals)', 'Income Tax Appellate Tribunal (ITAT)', 'High Court'],
      popular: true,
      advocateCount: 10
    },
    {
      id: 'immigration-law',
      name: 'Immigration & Citizenship',
      icon: 'globe',
      category: 'International & Immigration',
      description: 'Assisting non-resident Indians and foreign nationals with visa cancellations, deportation defense, OCI card revocations, and naturalization.',
      subfields: ['OCI Card Registrations', 'Visa Rejections & Appeals', 'FRRO Inquiries', 'Dual Citizenship Advocacy'],
      relevantActs: ['Citizenship Act 1955', 'Passports Act 1967', 'Foreigners Act 1946'],
      typicalForums: ['FRRO Offices', 'Ministry of Home Affairs', 'High Court'],
      popular: true,
      advocateCount: 8
    },
    {
      id: 'labour-law',
      name: 'Labour & Industrial Law',
      icon: 'briefcase',
      category: 'Employment & Labor',
      description: 'Navigating employer-employee relationships, trade union disputes, wage compliance, workplace safety standards, and factory statutory regulations.',
      subfields: ['Industrial Disputes', 'Trade Union Matters', 'Factory Act Compliance', 'Contract Labour Regulation'],
      relevantActs: ['Industrial Disputes Act 1947', 'Code on Wages 2019', 'Occupational Safety Code 2020'],
      typicalForums: ['Labour Court', 'Industrial Tribunal', 'High Court'],
      popular: true,
      advocateCount: 9
    }
  ];

  fetchPracticeAreas(category: string = 'All', query: string = '', sort: string = 'popular'): Observable<PracticeAreasResponse> {
    this.isLoading.set(true);

    let url = `${this.apiUrl}?category=${encodeURIComponent(category)}&sort=${encodeURIComponent(sort)}`;
    if (query) {
      url += `&q=${encodeURIComponent(query)}`;
    }

    return this.http.get<PracticeAreasResponse>(url).pipe(
      tap(res => {
        if (res && res.success && Array.isArray(res.data)) {
          this.practiceAreas.set(res.data);
          this.categories.set(res.categories || []);
        }
        this.isLoading.set(false);
      }),
      catchError(err => {
        console.warn('Practice Areas API fallback engaged:', err);
        // Fallback filtering in memory
        let filtered = [...this.fallbackCatalog];
        if (category !== 'All') {
          filtered = filtered.filter(p => p.category.toLowerCase() === category.toLowerCase());
        }
        if (query) {
          const q = query.toLowerCase();
          filtered = filtered.filter(p =>
            p.name.toLowerCase().includes(q) ||
            p.description.toLowerCase().includes(q) ||
            p.subfields.some(s => s.toLowerCase().includes(q))
          );
        }
        const cats = ['All', ...Array.from(new Set(this.fallbackCatalog.map(p => p.category)))];
        const catsWithCounts: PracticeCategoryCount[] = cats.map(c => ({
          name: c,
          count: c === 'All' ? this.fallbackCatalog.length : this.fallbackCatalog.filter(p => p.category === c).length
        }));

        this.practiceAreas.set(filtered);
        this.categories.set(catsWithCounts);
        this.isLoading.set(false);

        return of({
          success: true,
          totalCount: filtered.length,
          categories: catsWithCounts,
          data: filtered
        });
      })
    );
  }
}