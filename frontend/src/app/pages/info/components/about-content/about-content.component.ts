import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SnackbarService } from '../../../../services/snackbar.service';
import { TooltipDirective } from '../../../../directives/tooltip.directive';
import { InfoApiService } from '../../services/info-api.service';

@Component({
  selector: 'app-about-content',
  standalone: true,
  imports: [CommonModule, RouterLink, TooltipDirective],
  templateUrl: './about-content.component.html'
})
export class AboutContentComponent implements OnInit {

  // Platform Metrics
  stats = [
    { value: '1,250+', label: 'Bare Acts & Codes Indexed', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', desc: 'Central & State Acts digitized' },
    { value: '14,850+', label: 'Bar Verified Advocates', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z', desc: 'Audited BCI enrollment' },
    { value: '100%', label: 'Zero Middleman Fee', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z', desc: 'Direct client-lawyer connection' },
    { value: 'DPDP', label: '2023 Privacy Enforced', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z', desc: 'End-to-end data consent protection' }
  ];

  // Traditional Problems vs LegalConnect Solutions
  comparisonPoints = [
    {
      problem: 'Opaque Advocate Referrals & Middleman Cut',
      problemDesc: 'Citizens rely on unverified touts or brokers who charge up to 30% commission, bloating legal fees.',
      solution: 'Direct & Verified Advocate Directory',
      solutionDesc: 'Search lawyers by specialization, bar enrollment, practice courts, and language with zero middleman commissions.',
      icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z'
    },
    {
      problem: 'Inaccessible & Complex Legalese',
      problemDesc: 'Bare Acts and statutes are buried in archaic PDFs with outdated references to colonial penal codes.',
      solution: 'Digitized & Searchable Legal Intelligence',
      solutionDesc: 'Instant lookup of 850+ Bare Acts, BNS/BNSS cross-references, section summaries, and downloadable legal templates.',
      icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253'
    },
    {
      problem: 'Uncertain Fee Structures & Unexpected Retainers',
      problemDesc: 'Clients face hidden court appearance costs and unexpected billing increments without upfront clarity.',
      solution: 'Upfront Fee Transparency',
      solutionDesc: 'Advocates declare consultation rates and appearance fee bands transparently on their public profiles.',
      icon: 'M9 8h6m-5 0a3 3 0 110 6H9l3 3m-3-6h6m6 1a9 9 0 11-18 0 9 9 0 0118 0z'
    },
    {
      problem: 'Risk of Personal Data Misuse',
      problemDesc: 'Legal queries and personal sensitive documents are frequently shared across unencrypted chat channels.',
      solution: 'DPDP Act 2023 Compliant Privacy Vault',
      solutionDesc: 'Your personal data, case details, and communication setting are guarded under strict Indian data privacy protocols.',
      icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z'
    }
  ];

  // Strategic Pillars (What We Are Doing)
  pillars = [
    {
      step: '01',
      title: 'Bar Verified Directory',
      badge: 'BCI VERIFIED',
      desc: 'We validate advocate credentials against State Bar Council registries to eliminate impersonation and ensure authentic legal consultation.',
      color: 'blue'
    },
    {
      step: '02',
      title: 'Digital Bare Acts & BNS Engine',
      badge: '850+ BARE ACTS',
      desc: 'Instant access to India\'s new criminal codes (Bharatiya Nyaya Sanhita, BNSS, BSA) and civil legislation with smart section search.',
      color: 'emerald'
    },
    {
      step: '03',
      title: 'Direct Client Workspaces',
      badge: 'ZERO COMMISSION',
      desc: 'Empowering clients to submit structured consultation requests and build legal case dossiers directly to advocate workstations.',
      color: 'amber'
    },
    {
      step: '04',
      title: 'Pro-Bono & DLSA Network',
      badge: 'DLSA PUBLIC AID',
      desc: 'Seeding emergency helpline contacts, court mediation desk links, and District Legal Services Authorities (DLSA) for free legal support.',
      color: 'purple'
    }
  ];

  // Core Principles
  principles = [
    {
      title: 'Absolute Verification',
      desc: 'Every advocate listed on LegalConnect undergoes Bar Council registration validation before their profile is published.',
      icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
      badge: 'BCI Compliant',
      color: 'blue'
    },
    {
      title: 'Privacy First Focus',
      desc: 'Guided by India\'s DPDP Act 2023, we preserve client information and securely route communication without selling data to advertising networks.',
      icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
      badge: 'DPDP 2023',
      color: 'emerald'
    },
    {
      title: 'Transparency of Fees',
      desc: 'Consultation rates and practice domain disclosures are published upfront by advocates to eliminate unexpected retainers or hidden broker charges.',
      icon: 'M9 8h6m-5 0a3 3 0 110 6H9l3 3m-3-6h6m6 1a9 9 0 11-18 0 9 9 0 0118 0z',
      badge: 'Zero Commission',
      color: 'purple'
    }
  ];

  // Our Goals (Where We Are Heading)
  goals = [
    {
      title: 'Universal Legal Literacy',
      desc: 'Translating complex statutory provisions into easy-to-understand guides and regional language roadmaps.',
      icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
      color: 'blue'
    },
    {
      title: 'Faster Case Resolution',
      desc: 'Equipping advocates with digitized case research dossiers and pre-formatted drafting templates to save hundreds of billable hours.',
      icon: 'M13 10V3L4 14h7v7l9-11h-7z',
      color: 'amber'
    },
    {
      title: 'Pan-India Coverage',
      desc: 'Connecting tier-2, tier-3 cities, and rural litigants with specialized High Court and Supreme Court practitioners.',
      icon: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
      color: 'emerald'
    },
    {
      title: 'Trust-First Ecosystem',
      desc: 'Enforcing strict compliance, verified feedback audits, and zero-spam directory listings.',
      icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
      color: 'purple'
    }
  ];

  // Governance Grid
  governance = [
    { role: 'Judicial Compliance', entity: 'Supreme Court & High Court Advisors', desc: 'Reviewing directory practices against Bar Council of India guidelines.' },
    { role: 'Technical Security', entity: 'Secured Cloud Infrastructure', desc: 'AES-256 end-to-end data encryption with TLS 1.3 protocol standards.' },
    { role: 'Public Advocacy', entity: 'Civil Legal Reform Panel', desc: 'Ensuring pro-bono resources and DLSA contact paths remain freely accessible.' }
  ];

  // Milestones Timeline
  milestones = [
    { year: '2024', title: 'Platform Conception & Vision', desc: 'Conceived to bridge the systemic gap between public citizens, legal statutory resources, and verified legal advocates.' },
    { year: '2025', title: 'Bare Act Indexing & BCI Verification Engine', desc: 'Indexed 850+ Central and State Bare Acts while building automated State Bar Council credential verification audits.' },
    { year: '2026', title: 'DPDP Act 2023 Compliance & Nationwide Rollout', desc: 'Deployed full consent withdrawal workflows, encrypted dossier sharing, and expanding directory access across 35+ Indian cities.' }
  ];

  constructor(
    private snackbar: SnackbarService,
    private infoApi: InfoApiService
  ) { }

  ngOnInit() {
    this.infoApi.getAboutData().subscribe(res => {
      if (res && res.success && res.stats) {
        this.stats[0].value = res.stats.bareActsIndexed || '1,250+';
        this.stats[1].value = res.stats.registeredAdvocates || '14,850+';
      }
    });
  }

  copySectionLink(id: string) {
    if (typeof window === 'undefined') return;
    const url = `${window.location.origin}${window.location.pathname}#${id}`;
    navigator.clipboard.writeText(url).then(() => {
      this.snackbar.show('Section anchor link copied to clipboard!', 'success');
    }).catch(() => {
      this.snackbar.show('Failed to copy section link.', 'error');
    });
  }

  trackByLabel(index: number, item: any) {
    return item.label || item.title || item.year || item.problem;
  }
}