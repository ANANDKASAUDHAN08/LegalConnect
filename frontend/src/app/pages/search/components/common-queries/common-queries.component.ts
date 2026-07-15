import { Component, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface CommonQuery {
  readonly label: string;
  readonly subtitle: string;
  readonly query: string;
  readonly icon: string;
  readonly btnClass: string;
  readonly iconBoxClass: string;
  readonly iconClass: string;
  readonly labelClass: string;
}

@Component({
  selector: 'app-common-queries',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './common-queries.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CommonQueriesComponent {
  @Output() selectQuery = new EventEmitter<string>();

  readonly commonQueries: CommonQuery[] = [
    {
      label: 'Cheque Bounce Notice', subtitle: 'Section 138 NI Act',
      query: 'cheque bounce notice section 138',
      icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
      btnClass: 'border-amber-500/20 bg-amber-500/5 hover:border-amber-500/50 hover:bg-amber-500/10 hover:shadow-amber-500/10',
      iconBoxClass: 'bg-amber-500/15', iconClass: 'text-amber-500',
      labelClass: 'text-amber-700 dark:text-amber-400',
    },
    {
      label: 'Eviction Protection', subtitle: 'Tenant rights & deposit',
      query: 'tenant eviction security deposit protection',
      icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
      btnClass: 'border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:shadow-emerald-500/10',
      iconBoxClass: 'bg-emerald-500/15', iconClass: 'text-emerald-500',
      labelClass: 'text-emerald-700 dark:text-emerald-400',
    },
    {
      label: 'Arrest Rights Guide', subtitle: 'Bail & custody law',
      query: 'arrest warrant bail guidelines police custody',
      icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
      btnClass: 'border-red-500/20 bg-red-500/5 hover:border-red-500/50 hover:bg-red-50/10 hover:shadow-red-550/10',
      iconBoxClass: 'bg-red-500/15', iconClass: 'text-red-500',
      labelClass: 'text-red-700 dark:text-red-400',
    },
    {
      label: 'Mutual Divorce Deed', subtitle: 'Consent petition draft',
      query: 'mutual consent divorce deed petition',
      icon: 'M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7V2m0 2h12m0 0h3m-3 0l-3 1m0 0l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9V2',
      btnClass: 'border-violet-500/20 bg-violet-500/5 hover:border-violet-500/50 hover:bg-violet-500/10 hover:shadow-violet-500/10',
      iconBoxClass: 'bg-violet-500/15', iconClass: 'text-violet-500',
      labelClass: 'text-violet-700 dark:text-violet-400',
    },
    {
      label: 'Cyber Crime / Fraud', subtitle: 'BNS & IT Act sections',
      query: 'cyber crime phishing fraud BNS',
      icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
      btnClass: 'border-cyan-500/20 bg-cyan-500/5 hover:border-cyan-500/50 hover:bg-cyan-500/10 hover:shadow-cyan-500/10',
      iconBoxClass: 'bg-cyan-500/15', iconClass: 'text-cyan-500',
      labelClass: 'text-cyan-700 dark:text-cyan-400',
    },
    {
      label: 'Motor Vehicle Fine', subtitle: 'MV Act & traffic rules',
      query: 'drunk driving penalty overspeeding fine',
      icon: 'M13 10V3L4 14h7v7l9-11h-7z',
      btnClass: 'border-orange-500/20 bg-orange-500/5 hover:border-orange-500/50 hover:bg-orange-500/10 hover:shadow-orange-500/10',
      iconBoxClass: 'bg-orange-500/15', iconClass: 'text-orange-500',
      labelClass: 'text-orange-700 dark:text-orange-400',
    },
    {
      label: 'Domestic Violence', subtitle: 'Protection orders & rights',
      query: 'domestic violence protection order complaint FIR',
      icon: 'M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.105-2.59-.308-3.836A11.956 11.956 0 0112 2.714zM12 15h.008v.008H12V15z',
      btnClass: 'border-fuchsia-500/20 bg-fuchsia-500/5 hover:border-fuchsia-500/50 hover:bg-fuchsia-500/10 hover:shadow-fuchsia-500/10',
      iconBoxClass: 'bg-fuchsia-500/15', iconClass: 'text-fuchsia-500',
      labelClass: 'text-fuchsia-700 dark:text-fuchsia-400',
    },
    {
      label: 'Right to Information', subtitle: 'RTI filing & procedure',
      query: 'RTI application filing guide procedure fee',
      icon: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z',
      btnClass: 'border-slate-400/20 bg-slate-400/5 hover:border-slate-400/50 hover:bg-slate-400/10 hover:shadow-slate-400/10',
      iconBoxClass: 'bg-slate-400/15', iconClass: 'text-slate-400',
      labelClass: 'text-slate-700 dark:text-slate-300',
    },
    {
      label: 'Consumer Dispute', subtitle: 'Goods & services claim',
      query: 'consumer court complaint unfair trade practices',
      icon: 'M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z',
      btnClass: 'border-indigo-500/20 bg-indigo-50/5 hover:border-indigo-500/50 hover:bg-indigo-50/10 hover:shadow-indigo-500/10',
      iconBoxClass: 'bg-indigo-500/15', iconClass: 'text-indigo-500',
      labelClass: 'text-indigo-700 dark:text-indigo-400',
    },
    {
      label: 'Property Inheritance', subtitle: 'Will draft & succession',
      query: 'will draft inheritance family property rights succession',
      icon: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9zM2.25 12h19.5M2.25 16.5h19.5',
      btnClass: 'border-sky-500/20 bg-sky-500/5 hover:border-sky-500/50 hover:bg-sky-500/10 hover:shadow-sky-500/10',
      iconBoxClass: 'bg-sky-500/15', iconClass: 'text-sky-500',
      labelClass: 'text-sky-700 dark:text-sky-400',
    },
  ];

  trackByQueryLabel(_index: number, item: CommonQuery): string {
    return item.label;
  }
}
