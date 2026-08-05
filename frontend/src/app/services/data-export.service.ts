import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class DataExportService {

  /**
   * Helper to escape HTML characters to prevent XSS injection in HTML-based reports.
   */
  private escapeHtml(str: string | null | undefined): string {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Helper to format raw date strings safely.
   */
  private formatDate(dateVal: any): string {
    if (!dateVal) return 'N/A';
    try {
      const d = new Date(dateVal);
      return isNaN(d.getTime()) ? String(dateVal) : d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return String(dateVal);
    }
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
      txt += `Consultation Fee: ${lawyerProfile.consultationFee ? '$' + lawyerProfile.consultationFee : 'Free'}\n`;
      txt += `Office Address: ${lawyerProfile.officeAddress || 'N/A'}\n`;
      txt += `Education: ${lawyerProfile.education || 'N/A'}\n`;
      txt += `Languages Spoken: ${lawyerProfile.languagesSpoken || 'N/A'}\n`;
      txt += `Availability: ${lawyerProfile.isAvailable ? 'Available for Consultations' : 'Unavailable'}\n\n`;
    }

    txt += `-- BOOKMARKS & SAVED STATUTES (${safeBookmarks.length}) --\n`;
    if (safeBookmarks.length === 0) {
      txt += `No saved bookmarks found.\n`;
    } else {
      safeBookmarks.forEach((b, i) => {
        txt += `[${i + 1}] Act: ${b.actShortName || b.ActShortName || 'N/A'} | Chapter: ${b.chapterNumber || b.ChapterNumber || 'N/A'} | Section: ${b.sectionNumber || b.SectionNumber || 'N/A'}\n`;
        txt += `    Title: ${b.sectionTitle || b.SectionTitle || 'N/A'}\n`;
        txt += `    Content: ${b.sectionContent || b.SectionContent || 'N/A'}\n`;
        txt += `    Saved At: ${this.formatDate(b.savedAt || b.SavedAt)}\n\n`;
      });
    }

    txt += `-- CASES & CONSULTATIONS (${safeConsultations.length}) --\n`;
    if (safeConsultations.length === 0) {
      txt += `No consultations found.\n`;
    } else {
      safeConsultations.forEach((c, i) => {
        txt += `[${i + 1}] Consultation ID: ${c.id || c.Id}\n`;
        txt += `    Contact: ${c.clientName || c.ClientName || 'N/A'} (${c.clientEmail || c.ClientEmail || 'N/A'})\n`;
        txt += `    Message: ${c.message || c.Message || 'N/A'}\n`;
        txt += `    Status: ${c.status || c.Status || 'Pending'}\n`;
        txt += `    Date: ${this.formatDate(c.createdAt || c.CreatedAt)}\n\n`;
      });
    }

    txt += `-- USER REVIEWS (${safeReviews.length}) --\n`;
    if (safeReviews.length === 0) {
      txt += `No reviews logged.\n`;
    } else {
      safeReviews.forEach((r, i) => {
        txt += `[${i + 1}] Review for: ${r.targetName || r.TargetName || 'N/A'}\n`;
        txt += `    Rating: ${r.rating || r.Rating || 0} / 5 Stars\n`;
        txt += `    Content: ${r.content || r.Content || 'N/A'}\n`;
        txt += `    Date: ${this.formatDate(r.createdAt || r.CreatedAt)}\n\n`;
      });
    }

    txt += `========================================================================\n`;
    txt += `End of LegalConnect Report\n`;
    txt += `========================================================================\n`;
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
    html += `.info-label { font-weight: bold; background-color: #f8fafc; width: 30%; }`;
    html += `.data-table { width: 100%; border-collapse: collapse; margin-top: 15px; }`;
    html += `.data-table th { background-color: #0f172a; color: #ffffff; padding: 8px 12px; text-align: left; font-size: 12px; }`;
    html += `.data-table td { padding: 8px 12px; border: 1px solid #e2e8f0; font-size: 11px; }`;
    html += `.footer { text-align: center; font-size: 11px; color: #94a3b8; margin-top: 40px; }`;
    html += `</style></head><body>`;

    html += `<div class="header">`;
    html += `<div class="title">LegalConnect Export Report</div>`;
    html += `<div class="tagline">LEGAL HELP, SIMPLIFIED. | Generated: ${e(dateStr)}</div>`;
    html += `</div>`;

    html += `<div class="section"><div class="section-title">User Profile Details</div></div>`;
    html += `<table class="info-table">`;
    html += `<tr><td class="info-label">Full Name</td><td>${e(profile.fullName || profile.FullName || 'N/A')}</td></tr>`;
    html += `<tr><td class="info-label">Email Address</td><td>${e(profile.email || profile.Email || 'N/A')}</td></tr>`;
    html += `<tr><td class="info-label">Account Role</td><td>${e(profile.role || profile.Role || 'N/A')}</td></tr>`;
    html += `<tr><td class="info-label">Contact Phone</td><td>${e(profile.phone || profile.Phone || 'N/A')}</td></tr>`;
    html += `<tr><td class="info-label">Preferred Language</td><td>${e(profile.clientLanguage || profile.ClientLanguage || 'N/A')}</td></tr>`;
    html += `<tr><td class="info-label">User Location</td><td>${e(profile.clientCity || profile.ClientCity || 'N/A')}, ${e(profile.clientState || profile.ClientState || 'N/A')}</td></tr>`;
    html += `<tr><td class="info-label">Bio Description</td><td>${e(profile.clientBio || profile.ClientBio || 'N/A')}</td></tr>`;
    html += `</table>`;

    if ((profile.role === 'Lawyer' || profile.Role === 'Lawyer') && lawyerProfile) {
      html += `<div class="section"><div class="section-title">Professional Credentials</div></div>`;
      html += `<table class="info-table">`;
      html += `<tr><td class="info-label">Bar Council Number</td><td>${e(lawyerProfile.barCouncilNumber || 'N/A')}</td></tr>`;
      html += `<tr><td class="info-label">Specialization</td><td>${e(lawyerProfile.specialization || 'N/A')}</td></tr>`;
      html += `<tr><td class="info-label">Practice Experience</td><td>${lawyerProfile.experienceYears || 0} Years</td></tr>`;
      html += `<tr><td class="info-label">Consultation Fee</td><td>${lawyerProfile.consultationFee ? '$' + lawyerProfile.consultationFee : 'Free'}</td></tr>`;
      html += `<tr><td class="info-label">Office Address</td><td>${e(lawyerProfile.officeAddress || 'N/A')}</td></tr>`;
      html += `<tr><td class="info-label">Education & Background</td><td>${e(lawyerProfile.education || 'N/A')}</td></tr>`;
      html += `<tr><td class="info-label">Languages Spoken</td><td>${e(lawyerProfile.languagesSpoken || 'N/A')}</td></tr>`;
      html += `<tr><td class="info-label">Availability</td><td>${lawyerProfile.isAvailable ? 'Available' : 'Unavailable'}</td></tr>`;
      html += `</table>`;
    }

    html += `<div class="section"><div class="section-title">Saved Laws & Statutes (${safeBookmarks.length})</div></div>`;
    if (safeBookmarks.length === 0) {
      html += `<p>No bookmarks saved in your account.</p>`;
    } else {
      html += `<table class="data-table">`;
      html += `<tr><th>Act Name</th><th>Chapter/Section</th><th>Title</th><th>Date Saved</th></tr>`;
      safeBookmarks.forEach(b => {
        html += `<tr><td>${e(b.actShortName || b.ActShortName || 'N/A')}</td><td>Ch. ${e(b.chapterNumber || b.ChapterNumber || 'N/A')} Sec. ${e(b.sectionNumber || b.SectionNumber || 'N/A')}</td><td>${e(b.sectionTitle || b.SectionTitle || 'N/A')}</td><td>${e(this.formatDate(b.savedAt || b.SavedAt))}</td></tr>`;
      });
      html += `</table>`;
    }

    html += `<div class="section"><div class="section-title">Cases & Consultations (${safeConsultations.length})</div></div>`;
    if (safeConsultations.length === 0) {
      html += `<p>No consultations logged in your account.</p>`;
    } else {
      html += `<table class="data-table">`;
      html += `<tr><th>ID</th><th>Contact Info</th><th>Consultation Message</th><th>Status</th><th>Date</th></tr>`;
      safeConsultations.forEach(c => {
        html += `<tr><td>#${e(c.id || c.Id)}</td><td>${e(c.clientName || c.ClientName || 'N/A')}<br/>${e(c.clientEmail || c.ClientEmail || 'N/A')}</td><td>${e(c.message || c.Message || '')}</td><td>${e(c.status || c.Status || 'Pending')}</td><td>${e(this.formatDate(c.createdAt || c.CreatedAt))}</td></tr>`;
      });
      html += `</table>`;
    }

    html += `<div class="section"><div class="section-title">Client Reviews (${safeReviews.length})</div></div>`;
    if (safeReviews.length === 0) {
      html += `<p>No reviews posted.</p>`;
    } else {
      html += `<table class="data-table">`;
      html += `<tr><th>Recipient</th><th>Rating</th><th>Content</th><th>Date Posted</th></tr>`;
      safeReviews.forEach(r => {
        html += `<tr><td>${e(r.targetName || r.TargetName || 'N/A')}</td><td>${r.rating || r.Rating || 0} / 5 Stars</td><td>${e(r.content || r.Content || '')}</td><td>${e(this.formatDate(r.createdAt || r.CreatedAt))}</td></tr>`;
      });
      html += `</table>`;
    }

    html += `<div class="footer">Generated by LegalConnect. All rights reserved. &copy; 2026</div>`;
    html += `</body></html>`;
    return html;
  }

  /**
   * Opens styled PDF document print preview window.
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
    if (typeof window === 'undefined') return false;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      if (onPopupBlocked) onPopupBlocked();
      return false;
    }

    // Security Hardening: Prevent opener reference vulnerability
    try {
      (printWindow as any).opener = null;
    } catch { }

    const e = this.escapeHtml.bind(this);
    const safeBookmarks = Array.isArray(bookmarks) ? bookmarks : [];
    const safeConsultations = Array.isArray(consultations) ? consultations : [];
    const safeReviews = Array.isArray(reviews) ? reviews : [];

    const svgLogo = `
      <div style="width: 44px; height: 44px; border-radius: 11px; background: #2563eb; background: linear-gradient(135deg, #2563eb, #4f46e5); display: flex; align-items: center; justify-content: center; color: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; flex-shrink: 0;">
        <svg viewBox="0 0 24 24" fill="none" style="width: 26px; height: 26px;" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 4v16M8 20h8" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          <path d="M5 8h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          <path d="M5 8l-2 5M5 8l2 5M2 13c0 2 6 2 6 0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M19 8l-2 5M19 8l2 5M16 13c0 2 6 2 6 0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
          <circle cx="12" cy="11" r="2.2" fill="currentColor" />
        </svg>
      </div>
    `;

    const fullName = e(profile.fullName || profile.FullName || 'User');
    const email = e(profile.email || profile.Email || 'N/A');
    const role = e(profile.role || profile.Role || 'N/A');
    const phone = e(profile.phone || profile.Phone || 'N/A');
    const location = e((profile.clientCity || profile.ClientCity || 'N/A') + ', ' + (profile.clientState || profile.ClientState || 'N/A'));
    const createdAt = this.formatDate(profile.createdAt || profile.CreatedAt);
    const clientLanguage = e(profile.clientLanguage || profile.ClientLanguage || 'N/A');
    const clientBio = e(profile.clientBio || profile.ClientBio || 'No biography details provided.');
    const avatarUrl = profile.avatarUrl || profile.AvatarUrl;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>LegalConnect Report - ${fullName}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700;800&display=swap');
            body { 
              font-family: 'Outfit', sans-serif; 
              color: #1e293b; 
              padding: 40px; 
              margin: 0; 
              background-color: #ffffff;
            }
            .header-banner { 
              display: flex; 
              justify-content: space-between; 
              align-items: center; 
              border-bottom: 4px solid #2563eb; 
              padding-bottom: 25px; 
              margin-bottom: 35px; 
            }
            .brand-wrapper { 
              display: flex; 
              align-items: center; 
              gap: 15px; 
            }
            .brand-details h1 { 
              margin: 0; 
              font-size: 26px; 
              font-weight: 800; 
              color: #0f172a; 
              letter-spacing: -0.02em;
            }
            .brand-details p { 
              margin: 2px 0 0 0; 
              font-size: 11px; 
              color: #64748b; 
              text-transform: uppercase;
              letter-spacing: 0.05em;
            }
            .export-meta { 
              text-align: right; 
            }
            .export-meta h2 { 
              margin: 0; 
              font-size: 13px; 
              font-weight: 700; 
              color: #2563eb; 
              text-transform: uppercase; 
              letter-spacing: 0.1em; 
            }
            .export-meta p { 
              margin: 4px 0 0 0; 
              font-size: 11px; 
              color: #64748b; 
            }
            .profile-card { 
              display: flex; 
              align-items: center; 
              gap: 25px; 
              background: #f8fafc; 
              border: 1px solid #e2e8f0; 
              padding: 24px; 
              border-radius: 16px; 
              margin-bottom: 40px; 
            }
            .profile-avatar { 
              width: 80px; 
              height: 80px; 
              border-radius: 50%; 
              object-fit: cover; 
              border: 3px solid #2563eb;
              box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
            }
            .profile-details { 
              flex: 1; 
            }
            .profile-details h3 { 
              margin: 0; 
              font-size: 20px; 
              font-weight: 700; 
              color: #0f172a; 
            }
            .profile-details p { 
              margin: 5px 0 0 0; 
              font-size: 12px; 
              color: #64748b; 
            }
            .grid-details {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 10px 20px;
              margin-top: 15px;
              font-size: 12px;
              color: #475569;
            }
            .grid-item strong {
              color: #0f172a;
            }
            .section-block { 
              margin-bottom: 40px; 
              page-break-inside: avoid; 
            }
            .section-header { 
              font-size: 15px; 
              font-weight: 700; 
              color: #0f172a; 
              border-bottom: 2px solid #e2e8f0; 
              padding-bottom: 8px; 
              margin-bottom: 15px; 
              text-transform: uppercase;
              letter-spacing: 0.05em;
            }
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin-top: 10px; 
            }
            th { 
              background: #0f172a; 
              color: #ffffff; 
              font-size: 11px; 
              text-transform: uppercase; 
              font-weight: 600; 
              padding: 10px 14px; 
              text-align: left; 
            }
            td { 
              border-bottom: 1px solid #e2e8f0; 
              padding: 10px 14px; 
              font-size: 12px; 
              color: #334155; 
            }
            tr:nth-child(even) { 
              background: #f8fafc; 
            }
            .status-badge {
              display: inline-block;
              padding: 2px 8px;
              font-size: 10px;
              font-weight: 700;
              text-transform: uppercase;
              border-radius: 4px;
              border: 1px solid currentColor;
            }
            .status-Success, .status-Success { background: #f0fdf4; color: #166534; }
            .status-Failed, .status-Failed { background: #fef2f2; color: #991b1b; }
            .status-Pending { background: #fffbeb; color: #92400e; }
            .footer-info { 
              margin-top: 60px; 
              border-top: 1px solid #e2e8f0; 
              padding-top: 20px; 
              font-size: 11px; 
              color: #94a3b8; 
              text-align: center; 
            }
            @media print {
              body { padding: 10px; }
            }
          </style>
        </head>
        <body>
          <div class="header-banner">
            <div class="brand-wrapper">
              ${svgLogo}
              <div class="brand-details">
                <h1>LegalConnect</h1>
                <p>LEGAL HELP, SIMPLIFIED.</p>
              </div>
            </div>
            <div class="export-meta">
              <h2>Data Export Report</h2>
              <p>Generated: ${e(dateStr)}</p>
            </div>
          </div>

          <div class="profile-card">
            ${avatarUrl ? `
              <img class="profile-avatar" src="${e(avatarUrl)}" alt="User Avatar" />
            ` : `
              <div class="profile-avatar" style="display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #2563eb, #4f46e5); color: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); flex-shrink: 0; width: 80px; height: 80px; border-radius: 50%; border: 3px solid #2563eb;">
                <svg viewBox="0 0 24 24" fill="none" style="width: 44px; height: 44px;" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 4v16M8 20h8" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                  <path d="M5 8h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                  <path d="M5 8l-2 5M5 8l2 5M2 13c0 2 6 2 6 0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                  <path d="M19 8l-2 5M19 8l2 5M16 13c0 2 6 2 6 0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                  <circle cx="12" cy="11" r="2.2" fill="currentColor" />
                </svg>
              </div>
            `}
            <div class="profile-details">
              <h3>${fullName}</h3>
              <p>${clientBio}</p>
              <div class="grid-details">
                <div class="grid-item"><strong>Email:</strong> ${email}</div>
                <div class="grid-item"><strong>Account Role:</strong> ${role}</div>
                <div class="grid-item"><strong>Contact Phone:</strong> ${phone}</div>
                <div class="grid-item"><strong>Location:</strong> ${location}</div>
                <div class="grid-item"><strong>Member Since:</strong> ${createdAt}</div>
                <div class="grid-item"><strong>Language Pref:</strong> ${clientLanguage}</div>
              </div>
            </div>
          </div>

          ${(profile.role === 'Lawyer' || profile.Role === 'Lawyer') && lawyerProfile ? `
            <div class="section-block">
              <div class="section-header">Professional Credentials</div>
              <table>
                <tbody>
                  <tr>
                    <td style="width: 30%; font-weight: 600;">Bar Council Number</td>
                    <td>${e(lawyerProfile.barCouncilNumber || 'N/A')}</td>
                  </tr>
                  <tr>
                    <td style="font-weight: 600;">Specialization</td>
                    <td>${e(lawyerProfile.specialization || 'N/A')}</td>
                  </tr>
                  <tr>
                    <td style="font-weight: 600;">Practice Experience</td>
                    <td>${lawyerProfile.experienceYears || 0} Years</td>
                  </tr>
                  <tr>
                    <td style="font-weight: 600;">Consultation Fee</td>
                    <td>${lawyerProfile.consultationFee ? '$' + lawyerProfile.consultationFee : 'Free'}</td>
                  </tr>
                  <tr>
                    <td style="font-weight: 600;">Office Address</td>
                    <td>${e(lawyerProfile.officeAddress || 'N/A')}</td>
                  </tr>
                  <tr>
                    <td style="font-weight: 600;">Education & Background</td>
                    <td>${e(lawyerProfile.education || 'N/A')}</td>
                  </tr>
                  <tr>
                    <td style="font-weight: 600;">Languages Spoken</td>
                    <td>${e(lawyerProfile.languagesSpoken || 'N/A')}</td>
                  </tr>
                  <tr>
                    <td style="font-weight: 600;">Availability Status</td>
                    <td>
                      <span class="status-badge status-${lawyerProfile.isAvailable ? 'Success' : 'Failed'}">
                        ${lawyerProfile.isAvailable ? 'Available' : 'Unavailable'}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ` : ''}

          <div class="section-block">
            <div class="section-header">Saved Laws & Statutes (${safeBookmarks.length})</div>
            ${safeBookmarks.length === 0 ? '<p style="font-size:12px;color:#64748b;">No saved laws or bookmarked codes found in this account.</p>' : `
              <table>
                <thead>
                  <tr>
                    <th>Act Name</th>
                    <th>Reference</th>
                    <th>Statute Title</th>
                    <th>Saved On</th>
                  </tr>
                </thead>
                <tbody>
                  ${safeBookmarks.map(b => `
                    <tr>
                      <td style="font-weight:600;">${e(b.actShortName || b.ActShortName || 'N/A')}</td>
                      <td>Ch. ${e(b.chapterNumber || b.ChapterNumber || 'N/A')} Sec. ${e(b.sectionNumber || b.SectionNumber || 'N/A')}</td>
                      <td>${e(b.sectionTitle || b.SectionTitle || 'N/A')}</td>
                      <td>${e(this.formatDate(b.savedAt || b.SavedAt))}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            `}
          </div>

          <div class="section-block">
            <div class="section-header">Consultation & Case History (${safeConsultations.length})</div>
            ${safeConsultations.length === 0 ? '<p style="font-size:12px;color:#64748b;">No active case consultations or booked legal reviews found.</p>' : `
              <table>
                <thead>
                  <tr>
                    <th>Case ID</th>
                    <th>Representative / Contact</th>
                    <th>Message Details</th>
                    <th>Status</th>
                    <th>Date Lodged</th>
                  </tr>
                </thead>
                <tbody>
                  ${safeConsultations.map(c => `
                    <tr>
                      <td>#${e(c.id || c.Id)}</td>
                      <td><strong>${e(c.clientName || c.ClientName || 'N/A')}</strong><br/><span style="color:#64748b;font-size:10px;">${e(c.clientEmail || c.ClientEmail || '')}</span></td>
                      <td style="max-width:200px;font-size:11px;">${e(c.message || c.Message || '')}</td>
                      <td><span class="status-badge status-${e(c.status || c.Status || 'Pending')}">${e(c.status || c.Status || 'Pending')}</span></td>
                      <td>${e(this.formatDate(c.createdAt || c.CreatedAt))}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            `}
          </div>

          <div class="section-block">
            <div class="section-header">Reviews Left (${safeReviews.length})</div>
            ${safeReviews.length === 0 ? '<p style="font-size:12px;color:#64748b;">No professional reviews have been logged by this account.</p>' : `
              <table>
                <thead>
                  <tr>
                    <th>Reviewed Specialist</th>
                    <th>Rating</th>
                    <th>Feedback Details</th>
                    <th>Logged Date</th>
                  </tr>
                </thead>
                <tbody>
                  ${safeReviews.map(r => `
                    <tr>
                      <td style="font-weight:600;">${e(r.targetName || r.TargetName || 'N/A')}</td>
                      <td style="color:#f59e0b;font-weight:600;">${r.rating || r.Rating || 0} / 5 Stars</td>
                      <td style="font-style:italic;">"${e(r.content || r.Content || '')}"</td>
                      <td>${e(this.formatDate(r.createdAt || r.CreatedAt))}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            `}
          </div>

          <div class="footer-info">
            This document is a certified archive generated automatically by LegalConnect. &copy; 2026 LegalConnect Network Inc.
          </div>

          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 300);
            };
          </script>
        </body>
      </html>
    `);

    try {
      printWindow.document.close();
    } catch { }

    return true;
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
}