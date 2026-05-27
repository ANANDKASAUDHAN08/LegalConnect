import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-rights-checker',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './rights-checker.component.html',
  styleUrls: ['./rights-checker.component.scss']
})
export class RightsCheckerComponent {
  selectedRightsCard: number | null = null;

  rightsCards = [
    {
      title: 'Tenant Protection',
      icon: 'tenant',
      summary: 'Landlords cannot evict you without a 30-day notice and a court order. Under the Rent Control Acts, you are protected against arbitrary rent increases.',
      lawRef: 'Rent Control Act / Transfer of Property Act Sec 106',
      link: '/laws'
    },
    {
      title: 'Police Detainment Rules',
      icon: 'police',
      summary: 'If detained, you must be produced before a magistrate within 24 hours. Women cannot be arrested after sunset or before sunrise without a judicial warrant.',
      lawRef: 'Constitution of India Art 22 & BNSS Sec 46',
      link: '/laws/Constitution'
    },
    {
      title: 'Consumer Remedies',
      icon: 'consumer',
      summary: 'If sold defective goods or deficient services, you can file a complaint in the Consumer Forum. You are entitled to a full refund or compensation.',
      lawRef: 'Consumer Protection Act, 2019 Sec 38',
      link: '/laws'
    },
    {
      title: 'Right to Information (RTI)',
      icon: 'rti',
      summary: 'Every citizen can request details from public authorities. Government departments must respond within 30 days under penalty.',
      lawRef: 'RTI Act, 2005 Sec 6',
      link: '/laws'
    }
  ];

  toggleRightsCard(index: number) {
    if (this.selectedRightsCard === index) {
      this.selectedRightsCard = null;
    } else {
      this.selectedRightsCard = index;
    }
  }

  get activeRightsCard() {
    return this.selectedRightsCard !== null ? this.rightsCards[this.selectedRightsCard] : null;
  }
}
