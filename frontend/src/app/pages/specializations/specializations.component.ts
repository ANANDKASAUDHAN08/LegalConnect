import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

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
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './specializations.component.html',
  styleUrls: ['./specializations.component.scss']
})
export class SpecializationsComponent implements OnInit {
  searchQuery = '';
  selectedSpecializationName = '';

  specializations: SpecializationInfo[] = [
    {
      name: 'Criminal Law',
      icon: 'scale',
      category: 'Criminal Justice',
      description: 'Focuses on defending individuals and entities accused of criminal activities, representing clients from bail matters to trials and appeals.',
      subfields: ['NDPS Cases', 'Bail Matters', 'Criminal Appeals', 'Trials']
    },
    {
      name: 'Civil Law',
      icon: 'building',
      category: 'Litigation & Disputes',
      description: 'Focuses on non-criminal disputes between individuals or organizations, covering contract disputes, recoveries, injunctions, and declarations.',
      subfields: ['Contract Disputes', 'Property Partitioning', 'Civil Suits']
    },
    {
      name: 'Property Disputes',
      icon: 'home',
      category: 'Real Estate & Property',
      description: 'Resolves conflicts regarding land ownership, property titles, partitioning, tenancy disputes, and RERA compliance issues.',
      subfields: ['Land Acquisition', 'Tenancy Disputes', 'Partition Suits']
    },
    {
      name: 'Contract Law',
      icon: 'document',
      category: 'Corporate & Commercial',
      description: 'Covers the drafting, vetting, negotiation, and judicial enforcement of legal agreements, deeds, and commercial contracts.',
      subfields: ['Agreement Vetting', 'Breach of Contract', 'Lease Deeds']
    },
    {
      name: 'Family Law',
      icon: 'family',
      category: 'Personal & Domestic Relations',
      description: 'Deals with personal law matters, marital relations, child custody disputes, maintenance, and division of ancestral estate.',
      subfields: ['Divorce', 'Child Custody', 'Alimony & Maintenance']
    },
    {
      name: 'Divorce',
      icon: 'heart-broken',
      category: 'Personal & Domestic Relations',
      description: 'Focuses specifically on mutual consent and contested divorce proceedings, marital reconciliation, and separations.',
      subfields: ['Mutual Consent', 'Contested Divorce', 'Marital Mediation']
    },
    {
      name: 'Child Custody',
      icon: 'child',
      category: 'Personal & Domestic Relations',
      description: 'Resolves disputes regarding guardianship rights, child visitation schedules, custody battles, and wardship concerns.',
      subfields: ['Visitation Rights', 'Guardianship Matters', 'Child Support']
    },
    {
      name: 'Corporate Law',
      icon: 'briefcase',
      category: 'Corporate & Commercial',
      description: 'Directs company incorporations, corporate governance compliance, mergers and acquisitions, and general advisory on commercial operations.',
      subfields: ['Company Incorporation', 'Corporate Compliance', 'Board Advisory']
    },
    {
      name: 'Mergers & Acquisitions',
      icon: 'handshake',
      category: 'Corporate & Commercial',
      description: 'Advises on corporate consolidations, structural sales, due diligence, asset buyouts, and company transitions.',
      subfields: ['Due Diligence', 'Share Purchase Agreements', 'Corporate Buyouts']
    },
    {
      name: 'Consumer Law',
      icon: 'shopping-bag',
      category: 'Public & Consumer Rights',
      description: 'Protects consumer interests under the Consumer Protection Act, addressing product liabilities, service deficits, and fraudulent trade.',
      subfields: ['Consumer Forums', 'Product Liability Claims', 'Service Defaults']
    },
    {
      name: 'RTI',
      icon: 'info',
      category: 'Public & Consumer Rights',
      description: 'Handles requests, appeals, and compliance under the Right to Information Act to enforce disclosure from public departments.',
      subfields: ['RTI Applications', 'First Appeals', 'Information Commission Hearings']
    },
    {
      name: 'Public Interest Litigation',
      icon: 'megaphone',
      category: 'Litigation & Disputes',
      description: 'Deals with writ petitions, civil rights advocacy, environmental issues, and constitutional protection in High Courts and the Supreme Court.',
      subfields: ['Writ Petitions', 'Civil Liberties', 'Environmental Scrutiny']
    },
    {
      name: 'Labour Law',
      icon: 'hammer',
      category: 'Employment & Labor',
      description: 'Governs employer-employee relationships, industrial disputes, trade union disputes, and employee safety regulations.',
      subfields: ['Industrial Disputes', 'Worker Compensation', 'Trade Unions']
    },
    {
      name: 'Employment Disputes',
      icon: 'user-tie',
      category: 'Employment & Labor',
      description: 'Advises on wrongful terminations, severance package conflicts, wage defaults, and non-compete agreements.',
      subfields: ['Wrongful Termination', 'Severance Disputes', 'Wage Defaults']
    },
    {
      name: 'Industrial Law',
      icon: 'factory',
      category: 'Employment & Labor',
      description: 'Ensures compliance with factory safety standards, worker rights, industrial safety acts, and regulatory treaties.',
      subfields: ['Factory Safety Act', 'Labour Audits', 'Compliance Certifications']
    },
    {
      name: 'Intellectual Property',
      icon: 'lightbulb',
      category: 'Intellectual Property',
      description: 'Registers and protects creations of the mind, covering copyright licenses, patents, and trademark disputes.',
      subfields: ['Copyright Registration', 'Patent Filings', 'IP Infringements']
    },
    {
      name: 'Trademark',
      icon: 'trademark',
      category: 'Intellectual Property',
      description: 'Handles trademark registration, brand protection, opposition filings, and legal action against brand infringements.',
      subfields: ['Brand Registration', 'Trademark Opposition', 'Infringement Actions']
    },
    {
      name: 'Copyright',
      icon: 'copyright',
      category: 'Intellectual Property',
      description: 'Protects literature, arts, music, designs, and software creations, resolving issues of piracy and license breach.',
      subfields: ['Artistic Copyrights', 'Piracy Suits', 'License Enforcement']
    },
    {
      name: 'NDPS Cases',
      icon: 'package',
      category: 'Criminal Justice',
      description: 'Specializes in violations of the Narcotic Drugs and Psychotropic Substances Act, drug arrest defense, and trial representations.',
      subfields: ['NDPS Bail', 'Possession Defense', 'Drug Arrest Trials']
    },
    {
      name: 'Bail Matters',
      icon: 'key',
      category: 'Criminal Justice',
      description: 'Focuses on securing immediate regular bail, transit bail, and anticipatory bail representation before judicial courts.',
      subfields: ['Anticipatory Bail', 'Regular Bail', 'Surety Procedures']
    },
    {
      name: 'Tax Law',
      icon: 'chart-line',
      category: 'Corporate & Commercial',
      description: 'Advises on direct and indirect tax structures, appellate taxation litigation, corporate tax audit compliance, and assessments.',
      subfields: ['Corporate Tax', 'Tax Litigation', 'Assessment Representation']
    },
    {
      name: 'GST',
      icon: 'chart-bar',
      category: 'Corporate & Commercial',
      description: 'Advises on Goods and Services Tax compliance, audits, classifications, input tax credits, and appellate disputes.',
      subfields: ['Input Tax Credit', 'GST Audits', 'Tax Classification']
    },
    {
      name: 'Income Tax Disputes',
      icon: 'banknotes',
      category: 'Corporate & Commercial',
      description: 'Resolves direct tax audits, scrutiny notice responses, ITAT appeals, and penalty recovery disputes.',
      subfields: ['ITAT Appeals', 'Scrutiny Notices', 'Penalty Reductions']
    },
    {
      name: 'Real Estate Law',
      icon: 'crane',
      category: 'Real Estate & Property',
      description: 'Advises builders, realtors, and buyers on land zoning laws, compliance codes, property acquisitions, and development projects.',
      subfields: ['Zoning Compliance', 'Development Agreements', 'Due Diligence']
    },
    {
      name: 'RERA',
      icon: 'office',
      category: 'Real Estate & Property',
      description: 'Focuses on real estate project compliance under RERA regulations, buyers protection disputes, and builder delay representations.',
      subfields: ['RERA Registrations', 'Buyer Complaints', 'Delay Compensation']
    },
    {
      name: 'Cyber Crime',
      icon: 'terminal',
      category: 'Technology & Privacy',
      description: 'Handles online financial scams, phishing attacks, defamation suits, IT Act violations, and online fraud defense.',
      subfields: ['Phishing Fraud', 'IT Act Violations', 'Hacking Defense']
    },
    {
      name: 'Data Privacy',
      icon: 'lock',
      category: 'Technology & Privacy',
      description: 'Ensures business alignment with data privacy laws, drafting policy terms, user data compliance, and IT audit policies.',
      subfields: ['Privacy Policies', 'GDPR/DPDP Compliance', 'Data Breach Audits']
    },
    {
      name: 'IT Law',
      icon: 'cog',
      category: 'Technology & Privacy',
      description: 'Focuses on technology software licensing agreements, e-commerce terms, cloud computing contracts, and digital regulations.',
      subfields: ['Software Licensing', 'E-commerce Terms', 'SaaS Agreements']
    },
    {
      name: 'Immigration Law',
      icon: 'plane',
      category: 'International & Immigration',
      description: 'Resolves visa delays, student status adjustments, permanent residencies, dual citizenships, and immigration hearings.',
      subfields: ['Visa Application', 'OCI/Citizenship', 'Immigration Hearings']
    },
    {
      name: 'Visa Matters',
      icon: 'passport',
      category: 'International & Immigration',
      description: 'Focuses on visa application preparation, document verifications, visa rejection appeals, and work authorization filings.',
      subfields: ['Visa Appeal', 'Work Permits', 'PR Documentation']
    },
    {
      name: 'Citizenship',
      icon: 'globe',
      category: 'International & Immigration',
      description: 'Advises on dual citizenship matters, overseas passport delays, OCI card disputes, and naturalization clearances.',
      subfields: ['OCI Cards', 'Naturalization appeals', 'Dual Citizenship']
    }
  ];

  constructor(private route: ActivatedRoute, private router: Router) {}

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['name']) {
        this.selectedSpecializationName = params['name'];
        // Optional: Scroll to target card on load
        setTimeout(() => {
          const el = document.getElementById(this.selectedSpecializationName);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 300);
      }
    });
  }

  getFilteredSpecializations() {
    if (!this.searchQuery.trim()) {
      return this.specializations;
    }
    const q = this.searchQuery.toLowerCase().trim();
    return this.specializations.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.category.toLowerCase().includes(q) ||
      s.subfields.some(sf => sf.toLowerCase().includes(q))
    );
  }

  clearSearch() {
    this.searchQuery = '';
  }

  findAttorneys(specName: string) {
    this.router.navigate(['/lawyers'], { queryParams: { specialization: specName } });
  }
}
