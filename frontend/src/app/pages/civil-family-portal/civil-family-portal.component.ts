import { Component, OnInit } from '@angular/core';
import { NgIf, NgFor, SlicePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LegalService } from '../../services/legal.service';

@Component({
  selector: 'app-civil-family-portal',
  standalone: true,
  imports: [NgIf, NgFor, RouterLink, SlicePipe],
  templateUrl: './civil-family-portal.component.html',
  styleUrls: ['./civil-family-portal.component.scss']
})
export class CivilFamilyPortalComponent implements OnInit {
  acts: any[] = [];
  loading = true;

  // Static categorization definitions to group civil acts on the dashboard
  categories = [
    {
      title: 'Family & Matrimonial Law',
      icon: '🏠',
      description: 'Laws relating to marriage, divorce, alimony, and custody rights in India.',
      actShortNames: ['HMA', 'IDA']
    },
    {
      title: 'Commercial & Financial Law',
      icon: '💼',
      description: 'Commercial disputes, banking laws, contracts, and negotiable instruments.',
      actShortNames: ['NIA']
    },
    {
      title: 'Civil Procedure & Disputes',
      icon: '⚖️',
      description: 'Procedural rules governing civil litigation, appeals, and property disputes.',
      actShortNames: ['CPC']
    },
    {
      title: 'Transport & Accident Claims',
      icon: '🚗',
      description: 'Road safety rules, transport licensing, and accident compensation claims.',
      actShortNames: ['MVA']
    }
  ];

  guides = [
    {
      title: 'Cheque Bounce Resolution (NIA Section 138)',
      category: 'Commercial',
      summary: 'Steps to take if a cheque is dishonoured for insufficient funds.',
      steps: [
        'Obtain a Cheque Return Memo from the bank specifying the reason for dishonour.',
        'Issue a formal Demand Notice to the drawer within 30 days of receiving the return memo.',
        'Give the drawer 15 days from the receipt of notice to pay the cheque amount.',
        'If payment is not received, file a criminal complaint in the Magistrate Court within 30 days.'
      ],
      actRef: 'NIA',
      sectionRef: '138'
    },
    {
      title: 'Applying for Mutual Divorce (HMA Section 13B)',
      category: 'Family',
      summary: 'Procedural guide for couples seeking mutual divorce under Hindu marriage laws.',
      steps: [
        'Ensure both parties have been living separately for at least one year.',
        'Draft a joint petition outlining terms of settlement (alimony, custody, assets).',
        'File the First Motion petition in the Family Court.',
        'Wait for the statutory 6-month cooling period (can be waived under special circumstances).',
        'Appear for the Second Motion within 18 months of filing to receive the final decree.'
      ],
      actRef: 'HMA',
      sectionRef: '13B'
    },
    {
      title: 'Claiming Motor Accident Compensation (MVA Section 166)',
      category: 'Transport',
      summary: 'How victims or relatives can claim compensation after road accidents.',
      steps: [
        'Ensure an FIR is registered by the police cell mentioning details of the accident.',
        'Obtain a copy of the Detailed Accident Report (DAR) filed by the police.',
        'File a compensation petition in the Motor Accident Claims Tribunal (MACT) in your district.',
        'Present medical records, vehicle insurance details, and income certificates of the victim.'
      ],
      actRef: 'MVA',
      sectionRef: '166'
    }
  ];

  constructor(private legalService: LegalService) {}

  ngOnInit() {
    this.legalService.getActs().subscribe({
      next: (res) => {
        this.loading = false;
        if (res.success) {
          // Filter out the acts that belong to civil/family portal
          const civilActShortNames = ['HMA', 'IDA', 'NIA', 'CPC', 'MVA'];
          this.acts = res.data.filter(act => civilActShortNames.includes(act.shortName));
        }
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  getActsForCategory(shortNames: string[]): any[] {
    return this.acts.filter(act => shortNames.includes(act.shortName));
  }
}
