import { Injectable, inject } from '@angular/core';
import { PrintService } from './print.service';

@Injectable({ providedIn: 'root' })
export class DataExportService {
  private printService = inject(PrintService);

  /**
   * Helper to escape HTML characters to prevent XSS injection.
   */
  private escapeHtml(str: string | null | undefined): string {
    return this.printService.escapeHtml(str);
  }

  /**
   * Helper to format raw date strings safely.
   */
  private formatDate(dateVal: any): string {
    return this.printService.formatDate(dateVal);
  }

  /**
   * Memory-optimized blob downloader with auto-revoking object URLs.
   */
  downloadBlob(content: string, mimeType: string, fileName: string): void {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Revoke object URL after short delay to free memory in browser engine
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  /**
   * Generates lightweight ASCII Plain Text (.txt) export.
   */
  generateTxtFormat(
    profile: any = {},
    bookmarks: any[] = [],
    consultations: any[] = [],
    reviews: any[] = [],
    dateStr: string,
    lawyerProfile: any = null
  ): string {
    const safeBookmarks = Array.isArray(bookmarks) ? bookmarks : [];
    const safeConsultations = Array.isArray(consultations) ? consultations : [];
    const safeReviews = Array.isArray(reviews) ? reviews : [];

    let txt = `========================================================================\n`;
    txt += `                            LEGALCONNECT REPORT\n`;
    txt += `========================================================================\n`;
    txt += `Generated On: ${dateStr}\n\n`;

    txt += `-- USER PROFILE INFORMATION --\n`;
    txt += `ID: ${profile.id || profile.Id || 'N/A'}\n`;
    txt += `Full Name: ${profile.fullName || profile.FullName || 'N/A'}\n`;
    txt += `Email: ${profile.email || profile.Email || 'N/A'}\n`;
    txt += `Role: ${profile.role || profile.Role || 'N/A'}\n`;
    txt += `Created At: ${this.formatDate(profile.createdAt || profile.CreatedAt)}\n`;
    txt += `Phone: ${profile.phone || profile.Phone || 'N/A'}\n`;
    txt += `Language: ${profile.clientLanguage || profile.ClientLanguage || 'N/A'}\n`;
    txt += `City: ${profile.clientCity || profile.ClientCity || 'N/A'}\n`;
    txt += `Interest Area: ${profile.clientInterest || profile.ClientInterest || 'N/A'}\n`;
    txt += `Bio: ${profile.clientBio || profile.ClientBio || 'N/A'}\n\n`;

    if ((profile.role === 'Lawyer' || profile.Role === 'Lawyer') && lawyerProfile) {
      txt += `-- PROFESSIONAL CREDENTIALS --\n`;
      txt += `Bar Council Number: ${lawyerProfile.barCouncilNumber || 'N/A'}\n`;
      txt += `Specialization: ${lawyerProfile.specialization || 'N/A'}\n`;
      txt += `Experience: ${lawyerProfile.experienceYears || 0} Years\n`;
      txt += `Consultation Fee: ${lawyerProfile.consultationFee ? '₹' + lawyerProfile.consultationFee : 'Free'}\n`;
      txt += `Office Address: ${lawyerProfile.officeAddress || 'N/A'}\n`;
      txt += `Education: ${lawyerProfile.education || 'N/A'}\n`;
      txt += `Languages Spoken: ${lawyerProfile.languagesSpoken || 'N/A'}\n`;
      txt += `Availability: ${lawyerProfile.isAvailable ? 'Available for Consultations' : 'Unavailable'}\n\n`;
    }

    txt += `-- SAVED BOOKMARKS (${safeBookmarks.length}) --\n`;
    if (safeBookmarks.length === 0) {
      txt += `No bookmarks saved.\n\n`;
    } else {
      safeBookmarks.forEach((b, i) => {
        txt += `${i + 1}. [${b.actShortName || b.ActShortName || 'ACT'}] Section ${b.section?.section_number || b.sectionNumber || 'N/A'}: ${b.section?.title || b.title || 'Untitled'}\n`;
        if (b.notes || b.Notes) txt += `   Note: ${b.notes || b.Notes}\n`;
      });
      txt += `\n`;
    }

    txt += `-- CONSULTATION INQUIRIES (${safeConsultations.length}) --\n`;
    if (safeConsultations.length === 0) {
      txt += `No consultations booked.\n\n`;
    } else {
      safeConsultations.forEach((c, i) => {
        txt += `${i + 1}. Case/Query: ${c.legalIssue || c.LegalIssue || 'General Consultation'}\n`;
        txt += `   Target: ${c.targetName || c.TargetName || 'LegalConnect Specialist'} | Status: ${c.status || c.Status || 'Pending'} | Date: ${this.formatDate(c.createdAt || c.CreatedAt)}\n`;
        if (c.message || c.Message) txt += `   Details: ${c.message || c.Message}\n`;
      });
      txt += `\n`;
    }

    txt += `-- REVIEWS & RATINGS (${safeReviews.length}) --\n`;
    if (safeReviews.length === 0) {
      txt += `No reviews submitted.\n\n`;
    } else {
      safeReviews.forEach((r, i) => {
        txt += `${i + 1}. Rating: ${r.rating || r.Rating || 0}/5 for ${r.targetName || r.TargetName || 'N/A'}\n`;
        txt += `   Review: "${r.content || r.Content || ''}"\n`;
        txt += `   Date: ${this.formatDate(r.createdAt || r.CreatedAt)}\n`;
      });
      txt += `\n`;
    }

    txt += `========================================================================\n`;
    txt += `LegalConnect Network Inc. - Confidential User Telemetry & Data Archive\n`;
    return txt;
  }

  /**
   * Generates HTML formatted file suitable for MS Word / Pages (.doc).
   */
  generateWordHtml(
    profile: any = {},
    bookmarks: any[] = [],
    consultations: any[] = [],
    reviews: any[] = [],
    dateStr: string,
    lawyerProfile: any = null
  ): string {
    const e = this.escapeHtml.bind(this);
    const safeBookmarks = Array.isArray(bookmarks) ? bookmarks : [];
    const safeConsultations = Array.isArray(consultations) ? consultations : [];
    const safeReviews = Array.isArray(reviews) ? reviews : [];

    let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">`;
    html += `<head><meta charset="utf-8"><title>LegalConnect Data Export</title>`;
    html += `<style>`;
    html += `body { font-family: Arial, sans-serif; color: #1e293b; line-height: 1.6; }`;
    html += `.header { background-color: #0f172a; padding: 20px; color: #ffffff; text-align: center; border-bottom: 4px solid #3b82f6; }`;
    html += `.title { font-size: 26px; font-weight: bold; margin: 0; color: #3b82f6; }`;
    html += `.tagline { font-size: 12px; margin-top: 5px; color: #cbd5e1; }`;
    html += `.section { margin-top: 30px; border-bottom: 2px solid #e2e8f0; padding-bottom: 5px; }`;
    html += `.section-title { font-size: 18px; color: #0f172a; font-weight: bold; }`;
    html += `.info-table { width: 100%; border-collapse: collapse; margin-top: 15px; }`;
    html += `.info-table td { padding: 8px 12px; border: 1px solid #e2e8f0; }`;
    html += `.info-table th { background-color: #f1f5f9; padding: 8px 12px; border: 1px solid #e2e8f0; text-align: left; }`;
    html += `</style></head><body>`;

    html += `<div class="header">`;
    html += `<div class="title">LegalConnect</div>`;
    html += `<div class="tagline">LEGAL HELP, SIMPLIFIED. &bull; DATA EXPORT REPORT</div>`;
    html += `<p style="font-size: 11px; margin-top: 8px;">Generated on ${e(dateStr)}</p>`;
    html += `</div>`;

    html += `<div class="section"><div class="section-title">User Profile</div></div>`;
    html += `<table class="info-table">`;
    html += `<tr><th style="width: 30%;">Full Name</th><td>${e(profile.fullName || profile.FullName || 'N/A')}</td></tr>`;
    html += `<tr><th>Email Address</th><td>${e(profile.email || profile.Email || 'N/A')}</td></tr>`;
    html += `<tr><th>Account Role</th><td>${e(profile.role || profile.Role || 'N/A')}</td></tr>`;
    html += `<tr><th>Phone Number</th><td>${e(profile.phone || profile.Phone || 'N/A')}</td></tr>`;
    html += `<tr><th>Location</th><td>${e((profile.clientCity || profile.ClientCity || 'N/A') + ', ' + (profile.clientState || profile.ClientState || 'N/A'))}</td></tr>`;
    html += `<tr><th>Account Created</th><td>${e(this.formatDate(profile.createdAt || profile.CreatedAt))}</td></tr>`;
    html += `<tr><th>Bio / Overview</th><td>${e(profile.clientBio || profile.ClientBio || 'N/A')}</td></tr>`;
    html += `</table>`;

    if ((profile.role === 'Lawyer' || profile.Role === 'Lawyer') && lawyerProfile) {
      html += `<div class="section"><div class="section-title">Professional Credentials</div></div>`;
      html += `<table class="info-table">`;
      html += `<tr><th style="width: 30%;">Bar Council Number</th><td>${e(lawyerProfile.barCouncilNumber || 'N/A')}</td></tr>`;
      html += `<tr><th>Specialization</th><td>${e(lawyerProfile.specialization || 'N/A')}</td></tr>`;
      html += `<tr><th>Experience</th><td>${lawyerProfile.experienceYears || 0} Years</td></tr>`;
      html += `<tr><th>Office Address</th><td>${e(lawyerProfile.officeAddress || 'N/A')}</td></tr>`;
      html += `<tr><th>Education</th><td>${e(lawyerProfile.education || 'N/A')}</td></tr>`;
      html += `</table>`;
    }

    html += `<div class="section"><div class="section-title">Saved Bookmarks (${safeBookmarks.length})</div></div>`;
    if (safeBookmarks.length === 0) {
      html += `<p style="font-style: italic; color: #64748b;">No saved research bookmarks.</p>`;
    } else {
      html += `<table class="info-table"><thead><tr><th>Act</th><th>Section</th><th>Title</th><th>Notes</th></tr></thead><tbody>`;
      safeBookmarks.forEach(b => {
        html += `<tr><td>${e(b.actShortName || b.ActShortName || 'N/A')}</td><td>${e(b.section?.section_number || b.sectionNumber || 'N/A')}</td><td>${e(b.section?.title || b.title || 'Untitled')}</td><td>${e(b.notes || b.Notes || '')}</td></tr>`;
      });
      html += `</tbody></table>`;
    }

    html += `<div class="section"><div class="section-title">Consultation Inquiries (${safeConsultations.length})</div></div>`;
    if (safeConsultations.length === 0) {
      html += `<p style="font-style: italic; color: #64748b;">No consultation records.</p>`;
    } else {
      html += `<table class="info-table"><thead><tr><th>Target Specialist</th><th>Issue / Matter</th><th>Status</th><th>Date</th></tr></thead><tbody>`;
      safeConsultations.forEach(c => {
        html += `<tr><td>${e(c.targetName || c.TargetName || 'LegalConnect Specialist')}</td><td>${e(c.legalIssue || c.LegalIssue || 'General')}</td><td>${e(c.status || c.Status || 'Pending')}</td><td>${e(this.formatDate(c.createdAt || c.CreatedAt))}</td></tr>`;
      });
      html += `</tbody></table>`;
    }

    html += `<div class="section"><div class="section-title">Reviews & Feedback (${safeReviews.length})</div></div>`;
    if (safeReviews.length === 0) {
      html += `<p style="font-style: italic; color: #64748b;">No reviews submitted.</p>`;
    } else {
      html += `<table class="info-table"><thead><tr><th>Target Name</th><th>Rating</th><th>Review Content</th><th>Date</th></tr></thead><tbody>`;
      safeReviews.forEach(r => {
        html += `<tr><td>${e(r.targetName || r.TargetName || 'N/A')}</td><td>${r.rating || r.Rating || 0} / 5 Stars</td><td>${e(r.content || r.Content || '')}</td><td>${e(this.formatDate(r.createdAt || r.CreatedAt))}</td></tr>`;
      });
      html += `</tbody></table>`;
    }

    html += `<div style="margin-top: 40px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 15px;">`;
    html += `This document is a certified archive generated automatically by LegalConnect. &copy; 2026 LegalConnect Network Inc.`;
    html += `</div>`;
    html += `</body></html>`;
    return html;
  }

  /**
   * Generates a PDF report using the unified PrintService.
   */
  generatePdfReport(
    profile: any = {},
    bookmarks: any[] = [],
    consultations: any[] = [],
    reviews: any[] = [],
    dateStr: string,
    lawyerProfile: any = null,
    onPopupBlocked?: () => void
  ): boolean {
    const e = this.escapeHtml.bind(this);
    const fullName = profile.fullName || profile.FullName || 'User';
    const safeBookmarks = Array.isArray(bookmarks) ? bookmarks : [];
    const safeConsultations = Array.isArray(consultations) ? consultations : [];
    const safeReviews = Array.isArray(reviews) ? reviews : [];

    let contentHtml = this.printService.buildProfileCard(profile);

    // Bookmarks table
    if (safeBookmarks.length > 0) {
      contentHtml += this.printService.buildTable({
        title: 'Saved Research Bookmarks',
        badge: `${safeBookmarks.length} Items`,
        columns: [
          { key: 'act', label: 'Act' },
          { key: 'sec', label: 'Section', mono: true, bold: true },
          { key: 'title', label: 'Title' },
          { key: 'notes', label: 'Personal Notes' },
        ],
        rows: safeBookmarks.map(b => ({
          act: b.actShortName || b.ActShortName || 'N/A',
          sec: b.section?.section_number || b.sectionNumber || 'N/A',
          title: b.section?.title || b.title || 'Untitled',
          notes: b.notes || b.Notes || '—',
        })),
      });
    }

    // Consultations table
    if (safeConsultations.length > 0) {
      contentHtml += this.printService.buildTable({
        title: 'Consultation & Inquiry Records',
        badge: `${safeConsultations.length} Consultations`,
        columns: [
          { key: 'target', label: 'Specialist / Advocate', bold: true },
          { key: 'issue', label: 'Legal Matter / Subject' },
          { key: 'status', label: 'Status' },
          { key: 'date', label: 'Booked Date', align: 'right' },
        ],
        rows: safeConsultations.map(c => ({
          target: c.targetName || c.TargetName || 'LegalConnect Specialist',
          issue: c.legalIssue || c.LegalIssue || 'General Consultation',
          status: c.status || c.Status || 'Pending',
          date: this.formatDate(c.createdAt || c.CreatedAt),
        })),
      });
    }

    // Reviews table
    if (safeReviews.length > 0) {
      contentHtml += this.printService.buildTable({
        title: 'Verified Reviews & Feedback',
        badge: `${safeReviews.length} Reviews`,
        columns: [
          { key: 'target', label: 'Specialist', bold: true },
          { key: 'rating', label: 'Rating', align: 'center' },
          { key: 'content', label: 'Review Commentary' },
          { key: 'date', label: 'Date', align: 'right' },
        ],
        rows: safeReviews.map(r => ({
          target: r.targetName || r.TargetName || 'N/A',
          rating: `${r.rating || r.Rating || 0} / 5 ${this.printService.getSvg('star', { size: 10, color: '#f59e0b', style: 'margin-left:2px;' })}`,
          content: `"${r.content || r.Content || ''}"`,
          date: this.formatDate(r.createdAt || r.CreatedAt),
        })),
      });
    }

    return this.printService.print({
      title: `Data Export Report — ${fullName}`,
      subtitle: `Account Telemetry & Complete Data Archive`,
      content: contentHtml,
      sealText: 'Certified Data Archive • LegalConnect Network Inc.',
      accentColor: '#2563eb',
      onPopupBlocked,
      extraMeta: [
        { label: 'User Role', value: profile.role || profile.Role || 'Citizen' },
        { label: 'Export Date', value: dateStr },
      ],
    });
  }

  /**
   * Generates a Top-Tier MNC Executive Dossier for Advocates & Law Practices.
   */
  printAdvocateAnalyticsDossier(
    advocate: any,
    data: any,
    range: string,
    onPopupBlocked?: () => void,
    chartImages?: { label: string; base64: string }[]
  ): boolean {
    const e = this.escapeHtml.bind(this);
    const rangeLabel = range === '7d' ? 'Last 7 Days' : (range === '90d' ? 'Last 90 Days' : (range === '1y' ? 'Past Year' : 'Last 30 Days'));

    const gross = Number(data?.grossEarned || 0).toLocaleString('en-IN');
    const retainers = Number(data?.projectedRetainers || 0).toLocaleString('en-IN');
    const impressions = Number(data?.funnel?.impressions || 0).toLocaleString('en-IN');
    const inquiries = Number(data?.funnel?.inquiries || 0).toLocaleString('en-IN');
    const conversion = data?.funnel?.conversionRate || 0;
    const avgRating = data?.slaAndReputation?.averageRating || 5.0;
    const avgResponse = data?.slaAndReputation?.avgResponseMinutes || 0;
    const peerResponse = data?.slaAndReputation?.peerAvgResponseMinutes || 45;
    const grade = data?.slaAndReputation?.responseGrade || 'Active Practitioner';
    const practiceBreakdown = data?.practiceBreakdown || [];
    const trajectory = data?.trajectory || [];

    const subjectStrip = this.printService.buildSubjectStrip({
      name: advocate?.fullName || 'Advocate Practitioner',
      subtitle: `${advocate?.email || ''} • Specialization: ${advocate?.specialization || 'Advocate & Legal Counsel'}`,
      badge: 'Verified Practitioner',
    });

    const kpiCards = [
      { label: 'Realized Revenue', value: `₹${gross}`, sub: 'Settled Disbursals', accent: 'green' },
      { label: 'Retainer Pipeline', value: `₹${retainers}`, sub: 'Committed Engagements', accent: 'amber' },
      { label: 'Client Discovery', value: `${impressions}`, sub: `${inquiries} Inquiries (${conversion}%)`, accent: 'indigo' },
      { label: 'SLA & Rating', value: `${avgRating} ${this.printService.getSvg('star', { size: 13, color: '#f59e0b', style: 'margin-left:2px;' })}`, sub: `${avgResponse}m avg (${grade})`, accent: 'blue' },
    ];

    let contentHtml = this.printService.buildKpiGrid(kpiCards);

    // Chart snapshot images (if provided)
    if (chartImages && chartImages.length > 0) {
      for (const ci of chartImages) {
        contentHtml += this.printService.buildSection(
          ci.label,
          this.printService.buildChartImage(ci.base64, ci.label),
          'Visual Telemetry'
        );
      }
    }

    // Practice breakdown table
    if (practiceBreakdown.length > 0) {
      contentHtml += this.printService.buildTable({
        title: 'Practice Area Distribution & Case Volume',
        badge: `${practiceBreakdown.length} Categories`,
        columns: [
          { key: 'category', label: 'Practice Domain', bold: true },
          { key: 'percentage', label: 'Share', align: 'center', mono: true },
          { key: 'bar', label: 'Volume Distribution' },
        ],
        rows: practiceBreakdown.map((p: any) => ({
          category: p.category || 'General Practice',
          percentage: `${p.percentage || 0}%`,
          bar: this.printService.buildProgressBar(p.percentage || 0, '#d97706'),
        })),
      });
    }

    // Trajectory table
    if (trajectory.length > 0) {
      contentHtml += this.printService.buildTable({
        title: 'Revenue & Retainer Velocity Timeline',
        badge: `${trajectory.length} Milestones`,
        columns: [
          { key: 'label', label: 'Timeline Point', bold: true },
          { key: 'actual', label: 'Realized Cashflow (₹)', align: 'right', mono: true },
          { key: 'projected', label: 'Projected Retainers (₹)', align: 'right', mono: true },
          { key: 'views', label: 'Discovery Views', align: 'right', mono: true },
        ],
        rows: trajectory.map((t: any) => ({
          label: t.label,
          actual: `₹${Number(t.actual || 0).toLocaleString('en-IN')}`,
          projected: `₹${Number(t.projected || 0).toLocaleString('en-IN')}`,
          views: String(t.views || 0),
        })),
      });
    }

    return this.printService.print({
      title: 'Practice Intelligence & Revenue Dossier',
      subtitle: `Certified Telemetry Report • ${rangeLabel}`,
      subjectStrip,
      content: contentHtml,
      sealText: 'Certified LegalConnect Telemetry • Confidential & Attorney-Client Privileged',
      accentColor: '#b45309',
      onPopupBlocked,
      extraMeta: [
        { label: 'Advocate', value: advocate?.fullName || 'Advocate' },
        { label: 'Report Period', value: rangeLabel },
      ],
    });
  }

  /**
   * Generates a Top-Tier MNC Executive Dossier for Clients (Spend & Case Transparency).
   */
  printClientInsightsDossier(
    client: any,
    data: any,
    onPopupBlocked?: () => void
  ): boolean {
    const totalSpend = Number(data?.totalSpend || 0).toLocaleString('en-IN');
    const inEscrow = Number(data?.inEscrow || 0).toLocaleString('en-IN');
    const budgetCap = data?.isBudgetUserSet ? `₹${Number(data?.budgetCap || 0).toLocaleString('en-IN')}` : 'Not Configured';
    const remaining = data?.isBudgetUserSet ? `₹${Number(data?.remainingBudget || 0).toLocaleString('en-IN')}` : '—';
    const advocateName = data?.counselSla?.advocateName || 'No Advocate Assigned';
    const avgResponse = data?.counselSla?.avgResponseTime || 'N/A';
    const daysEngaged = data?.counselSla?.daysEngaged || 0;
    const prepScore = data?.documentReadiness?.readinessPercentage || 0;
    const prepLabel = data?.documentReadiness?.statusLabel || 'Not Started';
    const prepVerified = data?.documentReadiness?.verifiedCount || 0;
    const prepTotal = data?.documentReadiness?.totalRequired || 6;
    const pipeline = data?.casePipeline || [];

    const subjectStrip = this.printService.buildSubjectStrip({
      name: client?.fullName || 'Client',
      subtitle: `${client?.email || 'N/A'} • Primary Counsel: ${advocateName} (${avgResponse} response)`,
      badge: 'Active Legal Client',
    });

    const kpiCards = [
      { label: 'Settled Spend', value: `₹${totalSpend}`, sub: 'Invoiced & Disbursed', accent: 'green' },
      { label: 'In Escrow', value: `₹${inEscrow}`, sub: 'Retained on Milestones', accent: 'amber' },
      { label: 'Legal Budget', value: budgetCap, sub: 'Client Outlay Ceiling', accent: 'slate' },
      { label: 'Remaining Balance', value: remaining, sub: 'Uncommitted Reserve', accent: 'emerald' },
    ];

    let contentHtml = this.printService.buildKpiGrid(kpiCards);

    // Case pipeline table
    if (pipeline.length > 0) {
      contentHtml += this.printService.buildTable({
        title: 'Case Pipeline & Procedural Progression',
        badge: `${pipeline.length} Active Matters`,
        columns: [
          { key: 'caseId', label: 'Matter ID', mono: true, bold: true },
          { key: 'title', label: 'Matter Title' },
          { key: 'advocate', label: 'Assigned Counsel' },
          { key: 'stage', label: 'Current Stage' },
          { key: 'status', label: 'Status' },
        ],
        rows: pipeline.map((c: any) => ({
          caseId: c.caseId || 'LC-MATTER',
          title: c.title || 'Legal Consultation',
          advocate: c.advocateName || advocateName,
          stage: c.stage || 'In Progress',
          status: `<span class="lc-pill lc-pill-${c.status === 'Completed' ? 'success' : (c.status === 'In Progress' ? 'warning' : 'neutral')}">${c.status || 'Active'}</span>`,
        })),
      });
    }

    // Document readiness & SLA section
    const metricRows = [
      { metric: 'Research Preparedness Score', value: `${prepScore}% (${prepLabel})` },
      { metric: 'Knowledge Base Depth', value: `${prepVerified} of ${prepTotal} items completed` },
      { metric: 'Assigned Primary Counsel', value: advocateName },
      { metric: 'Average Counsel Response SLA', value: String(avgResponse) },
      { metric: 'Engagement Duration', value: `${daysEngaged} Days` },
    ];

    contentHtml += this.printService.buildTable({
      title: 'Matter Preparedness & Service Level Performance',
      badge: 'Client Audit Metrics',
      columns: [
        { key: 'metric', label: 'Metric', bold: true },
        { key: 'value', label: 'Score / Status', align: 'right' },
      ],
      rows: metricRows,
    });

    return this.printService.print({
      title: 'Client Legal Spend & Matter Transparency Report',
      subtitle: 'Certified Financial & Case Progress Dossier',
      subjectStrip,
      content: contentHtml,
      sealText: 'LegalConnect Client Matter Dossier • Certified Itemized Record & Escrow Transparency',
      accentColor: '#059669',
      onPopupBlocked,
      extraMeta: [
        { label: 'Assigned Counsel', value: advocateName },
        { label: 'Audit Status', value: 'Audited & Verified' },
      ],
    });
  }

  /**
   * Main entry point for processing export format choices.
   */
  processExport(data: any, format: string, onPopupBlocked?: () => void): { status: string; message: string } {
    const dateStr = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const dateFileStr = new Date().toISOString().slice(0, 10);

    const profile = data?.user || data?.profile || {};
    const bookmarks = data?.bookmarks || [];
    const consultations = data?.consultations || [];
    const reviews = data?.reviews || [];
    const lawyerProfile = data?.lawyerProfile || null;

    if (format === 'pdf') {
      const opened = this.generatePdfReport(profile, bookmarks, consultations, reviews, dateStr, lawyerProfile, onPopupBlocked);
      if (opened) {
        return { status: 'pdf', message: 'PDF Report opened for printing.' };
      } else {
        return { status: 'error', message: 'Popups are blocked! Please enable popups to download PDF.' };
      }
    } else if (format === 'word') {
      const wordHtml = this.generateWordHtml(profile, bookmarks, consultations, reviews, dateStr, lawyerProfile);
      this.downloadBlob(wordHtml, 'application/msword;charset=utf-8', `LegalConnect-DataExport-${dateFileStr}.doc`);
      return { status: 'word', message: 'Word document downloaded successfully!' };
    } else if (format === 'text') {
      const txtContent = this.generateTxtFormat(profile, bookmarks, consultations, reviews, dateStr, lawyerProfile);
      this.downloadBlob(txtContent, 'text/plain;charset=utf-8', `LegalConnect-DataExport-${dateFileStr}.txt`);
      return { status: 'text', message: 'Text report downloaded successfully!' };
    } else {
      this.downloadBlob(JSON.stringify(data, null, 2), 'application/json;charset=utf-8', `LegalConnect-DataExport-${dateFileStr}.json`);
      return { status: 'json', message: 'JSON archive downloaded successfully!' };
    }
  }

  /**
   * Universal client dossier exporter with dynamic scope awareness.
   */
  exportClientData(format: 'json' | 'csv' | 'txt', data?: any, scopeName: string = 'Dossier'): void {
    const payload = data || {
      exportedAt: new Date().toISOString(),
      platform: 'LegalConnect Platform'
    };
    const dateFileStr = new Date().toISOString().slice(0, 10);
    const sanitizedScope = scopeName.replace(/[^a-zA-Z0-9_-]/g, '-');

    if (format === 'json') {
      this.downloadBlob(
        JSON.stringify(payload, null, 2),
        'application/json;charset=utf-8;',
        `LegalConnect-${sanitizedScope}-${dateFileStr}.json`
      );
    } else if (format === 'csv') {
      const rows = Array.isArray(payload) ? payload : [payload];
      const headerRow = Object.keys(rows[0] || { export: 'Data' }).join(',');
      const dataRows = rows.map(r => Object.values(r).map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(',')).join('\n');
      this.downloadBlob(
        `${headerRow}\n${dataRows}`,
        'text/csv;charset=utf-8;',
        `LegalConnect-${sanitizedScope}-${dateFileStr}.csv`
      );
    } else {
      if (typeof payload === 'string') {
        this.downloadBlob(payload, 'text/plain;charset=utf-8;', `LegalConnect-${sanitizedScope}-${dateFileStr}.txt`);
      } else {
        const txt = this.generateTxtFormat(payload.user || {}, payload.bookmarks || [], payload.consultations || [], payload.reviews || [], new Date().toLocaleDateString());
        this.downloadBlob(txt, 'text/plain;charset=utf-8;', `LegalConnect-${sanitizedScope}-${dateFileStr}.txt`);
      }
    }
  }
}