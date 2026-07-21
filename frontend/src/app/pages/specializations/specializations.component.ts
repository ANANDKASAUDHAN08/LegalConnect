import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LawyerService } from '../../services/lawyer.service';
import { TooltipDirective } from '../../directives/tooltip.directive';

export interface SpecializationInfo {
  name: string;
  icon: string;
  category: string;
  description: string;
  subfields: string[];
}

@Component({
  selector: 'app-specializations',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TooltipDirective],
  templateUrl: './specializations.component.html',
  styleUrls: ['./specializations.component.scss']
})
export class SpecializationsComponent implements OnInit {
  searchQuery = '';
  selectedSpecializationName = '';
  
  // Filtering States
  selectedCategory = signal<string>('All');
  isLoading = signal(true);
  
  // Lawyer counts tracking
  lawyerCounts = signal<Map<string, number>>(new Map());

  specializations: SpecializationInfo[] = [
    {
      name: 'Criminal Law',
      icon: '🏛️',
      category: 'Criminal Justice',
      description: 'Focuses on defending individuals and entities accused of criminal activities, representing clients from bail matters to trials and appeals.',
      subfields: ['NDPS Cases', 'Bail Matters', 'Criminal Appeals', 'Trials']
    },
    {
      name: 'Civil Law',
      icon: '⚖️',
      category: 'Litigation & Disputes',
      description: 'Focuses on non-criminal disputes between individuals or organizations, covering contract disputes, recoveries, injunctions, and declarations.',
      subfields: ['Contract Disputes', 'Property Partitioning', 'Civil Suits']
    },
    {
      name: 'Property Disputes',
      icon: '🏠',
      category: 'Real Estate & Property',
      description: 'Resolves conflicts regarding land ownership, property titles, partitioning, tenancy disputes, and RERA compliance issues.',
      subfields: ['Land Acquisition', 'Tenancy Disputes', 'Partition Suits']
    },
    {
      name: 'Contract Law',
      icon: '📝',
      category: 'Corporate & Commercial',
      description: 'Covers the drafting, vetting, negotiation, and judicial enforcement of legal agreements, deeds, and commercial contracts.',
      subfields: ['Agreement Vetting', 'Breach of Contract', 'Lease Deeds']
    },
    {
      name: 'Family Law',
      icon: '👨‍👩‍👧‍👦',
      category: 'Personal & Domestic Relations',
      description: 'Deals with personal law matters, marital relations, child custody disputes, maintenance, and division of ancestral estate.',
      subfields: ['Divorce', 'Child Custody', 'Alimony & Maintenance']
    },
    {
      name: 'Divorce',
      icon: '💔',
      category: 'Personal & Domestic Relations',
      description: 'Focuses specifically on mutual consent and contested divorce proceedings, marital reconciliation, and separations.',
      subfields: ['Mutual Consent', 'Contested Divorce', 'Marital Mediation']
    },
    {
      name: 'Child Custody',
      icon: '👶',
      category: 'Personal & Domestic Relations',
      description: 'Resolves disputes regarding guardianship rights, child visitation schedules, custody battles, and wardship concerns.',
      subfields: ['Visitation Rights', 'Guardianship Matters', 'Child Support']
    },
    {
      name: 'Corporate Law',
      icon: '💼',
      category: 'Corporate & Commercial',
      description: 'Directs company incorporations, corporate governance compliance, mergers and acquisitions, and general advisory on commercial operations.',
      subfields: ['Company Incorporation', 'Corporate Compliance', 'Board Advisory']
    },
    {
      name: 'Mergers & Acquisitions',
      icon: '🤝',
      category: 'Corporate & Commercial',
      description: 'Advises on corporate consolidations, structural sales, due diligence, asset buyouts, and company transitions.',
      subfields: ['Due Diligence', 'Share Purchase Agreements', 'Corporate Buyouts']
    },
    {
      name: 'Consumer Law',
      icon: '🛍️',
      category: 'Public & Consumer Rights',
      description: 'Protects consumer interests under the Consumer Protection Act, addressing product liabilities, service deficits, and fraudulent trade.',
      subfields: ['Consumer Forums', 'Product Liability Claims', 'Service Defaults']
    },
    {
      name: 'RTI',
      icon: 'ℹ️',
      category: 'Public & Consumer Rights',
      description: 'Handles requests, appeals, and compliance under the Right to Information Act to enforce disclosure from public departments.',
      subfields: ['RTI Applications', 'First Appeals', 'Information Commission Hearings']
    },
    {
      name: 'Public Interest Litigation',
      icon: '📢',
      category: 'Litigation & Disputes',
      description: 'Deals with writ petitions, civil rights advocacy, environmental issues, and constitutional protection in High Courts and the Supreme Court.',
      subfields: ['Writ Petitions', 'Civil Liberties', 'Environmental Scrutiny']
    },
    {
      name: 'Labour Law',
      icon: '🔨',
      category: 'Employment & Labor',
      description: 'Governs employer-employee relationships, industrial disputes, trade union disputes, and employee safety regulations.',
      subfields: ['Industrial Disputes', 'Worker Compensation', 'Trade Unions']
    },
    {
      name: 'Employment Disputes',
      icon: '👔',
      category: 'Employment & Labor',
      description: 'Advises on wrongful terminations, severance package conflicts, wage defaults, and non-compete agreements.',
      subfields: ['Wrongful Termination', 'Severance Disputes', 'Wage Defaults']
    },
    {
      name: 'Industrial Law',
      icon: '🏭',
      category: 'Employment & Labor',
      description: 'Ensures compliance with factory safety standards, worker rights, industrial safety acts, and regulatory treaties.',
      subfields: ['Factory Safety Act', 'Labour Audits', 'Compliance Certifications']
    },
    {
      name: 'Intellectual Property',
      icon: '💡',
      category: 'Intellectual Property',
      description: 'Registers and protects creations of the mind, covering copyright licenses, patents, and trademark disputes.',
      subfields: ['Copyright Registration', 'Patent Filings', 'IP Infringements']
    },
    {
      name: 'Trademark',
      icon: '™️',
      category: 'Intellectual Property',
      description: 'Handles trademark registration, brand protection, opposition filings, and legal action against brand infringements.',
      subfields: ['Brand Registration', 'Trademark Opposition', 'Infringement Actions']
    },
    {
      name: 'Copyright',
      icon: '©️',
      category: 'Intellectual Property',
      description: 'Protects literature, arts, music, designs, and software creations, resolving issues of piracy and license breach.',
      subfields: ['Artistic Copyrights', 'Piracy Suits', 'License Enforcement']
    },
    {
      name: 'NDPS Cases',
      icon: '📦',
      category: 'Criminal Justice',
      description: 'Specializes in violations of the Narcotic Drugs and Psychotropic Substances Act, drug arrest defense, and trial representations.',
      subfields: ['NDPS Bail', 'Possession Defense', 'Drug Arrest Trials']
    },
    {
      name: 'Bail Matters',
      icon: '🔑',
      category: 'Criminal Justice',
      description: 'Focuses on securing immediate regular bail, transit bail, and anticipatory bail representation before judicial courts.',
      subfields: ['Anticipatory Bail', 'Regular Bail', 'Surety Procedures']
    },
    {
      name: 'Tax Law',
      icon: '📈',
      category: 'Corporate & Commercial',
      description: 'Advises on direct and indirect tax structures, appellate taxation litigation, corporate tax audit compliance, and assessments.',
      subfields: ['Corporate Tax', 'Tax Litigation', 'Assessment Representation']
    },
    {
      name: 'GST',
      icon: '📊',
      category: 'Corporate & Commercial',
      description: 'Advises on Goods and Services Tax compliance, audits, classifications, input tax credits, and appellate disputes.',
      subfields: ['Input Tax Credit', 'GST Audits', 'Tax Classification']
    },
    {
      name: 'Income Tax Disputes',
      icon: '💰',
      category: 'Corporate & Commercial',
      description: 'Resolves direct tax audits, scrutiny notice responses, ITAT appeals, and penalty recovery disputes.',
      subfields: ['ITAT Appeals', 'Scrutiny Notices', 'Penalty Reductions']
    },
    {
      name: 'Real Estate Law',
      icon: '🏗️',
      category: 'Real Estate & Property',
      description: 'Advises builders, realtors, and buyers on land zoning laws, compliance codes, property acquisitions, and development projects.',
      subfields: ['Zoning Compliance', 'Development Agreements', 'Due Diligence']
    },
    {
      name: 'RERA',
      icon: '🏢',
      category: 'Real Estate & Property',
      description: 'Focuses on real estate project compliance under RERA regulations, buyers protection disputes, and builder delay representations.',
      subfields: ['RERA Registrations', 'Buyer Complaints', 'Delay Compensation']
    },
    {
      name: 'Cyber Crime',
      icon: '💻',
      category: 'Technology & Privacy',
      description: 'Handles online financial scams, phishing attacks, defamation suits, IT Act violations, and online fraud defense.',
      subfields: ['Phishing Fraud', 'IT Act Violations', 'Hacking Defense']
    },
    {
      name: 'Data Privacy',
      icon: '🔒',
      category: 'Technology & Privacy',
      description: 'Ensures business alignment with data privacy laws, drafting policy terms, user data compliance, and IT audit policies.',
      subfields: ['Privacy Policies', 'GDPR/DPDP Compliance', 'Data Breach Audits']
    },
    {
      name: 'IT Law',
      icon: '⚙️',
      category: 'Technology & Privacy',
      description: 'Focuses on technology software licensing agreements, e-commerce terms, cloud computing contracts, and digital regulations.',
      subfields: ['Software Licensing', 'E-commerce Terms', 'SaaS Agreements']
    },
    {
      name: 'Immigration Law',
      icon: '✈️',
      category: 'International & Immigration',
      description: 'Resolves visa delays, student status adjustments, permanent residencies, dual citizenships, and immigration hearings.',
      subfields: ['Visa Application', 'OCI/Citizenship', 'Immigration Hearings']
    },
    {
      name: 'Visa Matters',
      icon: '🛂',
      category: 'International & Immigration',
      description: 'Focuses on visa application preparation, document verifications, visa rejection appeals, and work authorization filings.',
      subfields: ['Visa Appeal', 'Work Permits', 'PR Documentation']
    },
    {
      name: 'Citizenship',
      icon: '🌐',
      category: 'International & Immigration',
      description: 'Advises on dual citizenship matters, overseas passport delays, OCI card disputes, and naturalization clearances.',
      subfields: ['OCI Cards', 'Naturalization appeals', 'Dual Citizenship']
    }
  ];

  categories = computed(() => {
    const list = this.specializations.map(s => s.category);
    return ['All', ...Array.from(new Set(list))];
  });

  constructor(
    private route: ActivatedRoute, 
    private router: Router,
    private lawyerService: LawyerService
  ) {}

  ngOnInit() {
    this.loadLawyerCounts();

    this.route.queryParams.subscribe(params => {
      if (params['name']) {
        this.selectedSpecializationName = params['name'];
        // Scroll to target card on load
        setTimeout(() => {
          const el = document.getElementById(this.selectedSpecializationName);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 500);
      }
    });
  }

  loadLawyerCounts() {
    this.isLoading.set(true);
    this.lawyerService.getLawyers().subscribe({
      next: (res) => {
        if (res && res.success && res.data) {
          const countMap = new Map<string, number>();
          res.data.forEach(lawyer => {
            lawyer.specializations.forEach(spec => {
              const key = spec.trim();
              countMap.set(key, (countMap.get(key) || 0) + 1);
            });
          });
          this.lawyerCounts.set(countMap);
        }
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      }
    });
  }

  getFilteredSpecializations() {
    let list = this.specializations;
    const cat = this.selectedCategory();
    const query = this.searchQuery.toLowerCase().trim();

    if (cat !== 'All') {
      list = list.filter(s => s.category === cat);
    }

    if (query) {
      list = list.filter(s =>
        s.name.toLowerCase().includes(query) ||
        s.description.toLowerCase().includes(query) ||
        s.category.toLowerCase().includes(query) ||
        s.subfields.some(sf => sf.toLowerCase().includes(query))
      );
    }

    return list;
  }

  getLawyerCount(specName: string): number {
    // Exact or partial matches
    const map = this.lawyerCounts();
    let total = 0;
    map.forEach((count, key) => {
      if (key.toLowerCase().includes(specName.toLowerCase()) || specName.toLowerCase().includes(key.toLowerCase())) {
        total += count;
      }
    });
    return total;
  }

  setCategory(category: string) {
    this.selectedCategory.set(category);
  }

  clearSearch() {
    this.searchQuery = '';
  }

  findAttorneys(specName: string) {
    this.router.navigate(['/lawyers'], { queryParams: { specialization: specName } });
  }
}
