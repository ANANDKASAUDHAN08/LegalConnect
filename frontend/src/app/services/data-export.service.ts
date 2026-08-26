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
   * Universal, bulletproof print renderer with popup and iframe fallback.
   */
  private printHtmlDocument(htmlContent: string, documentTitle: string, onPopupBlocked?: () => void): boolean {
    if (typeof window === 'undefined') return false;

    try {
      const printWindow = window.open('', '_blank', 'width=950,height=800,scrollbars=yes,status=no,menubar=no,toolbar=no');
      if (printWindow && !printWindow.closed) {
        printWindow.document.open();
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        return true;
      }
    } catch {
      // If popup blocked or threw error, proceed to iframe fallback
    }

    // Fallback: Use hidden iframe to trigger print dialog without popup permission
    try {
      const existingIframe = document.getElementById('lc-print-iframe');
      if (existingIframe) existingIframe.remove();

      const iframe = document.createElement('iframe');
      iframe.id = 'lc-print-iframe';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(htmlContent);
        doc.close();
        setTimeout(() => {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          setTimeout(() => iframe.remove(), 2000);
        }, 500);
        return true;
      }
    } catch (err) {
      console.error('Print failed:', err);
    }

    if (onPopupBlocked) onPopupBlocked();
    return false;
  }

  /**
   * Generates a Top-Tier MNC Executive Dossier for Advocates & Law Practices.
   */
  printAdvocateAnalyticsDossier(advocate: any, data: any, range: string, onPopupBlocked?: () => void): boolean {
    const e = (val: any) => this.escapeHtml(val);
    const dateStr = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const refCode = `LC-ADV-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

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
    const starBreakdown = data?.slaAndReputation?.starBreakdown || [];

    const rangeLabel = range === '7d' ? 'Last 7 Days' : (range === '90d' ? 'Last 90 Days' : (range === '1y' ? 'Past Year' : 'Last 30 Days'));

    const html = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8">
          <title>${e(advocate?.fullName || 'Advocate')} - Practice Intelligence Dossier | LegalConnect</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 12mm 15mm 12mm 15mm;
            }
            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              color: #0f172a;
              background: #ffffff;
              line-height: 1.4;
              font-size: 12px;
              margin: 0;
              padding: 0;
            }
            .header-wrap {
              border-top: 4px solid #b45309;
              padding: 16px 0 12px 0;
              border-bottom: 2px solid #0f172a;
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              margin-bottom: 20px;
            }
            .brand-logo {
              font-size: 16px;
              font-weight: 900;
              letter-spacing: 0.12em;
              color: #0f172a;
              text-transform: uppercase;
              display: flex;
              align-items: center;
              gap: 6px;
            }
            .brand-logo .crest {
              background: #0f172a;
              color: #f59e0b;
              font-size: 11px;
              padding: 3px 6px;
              border-radius: 4px;
              font-weight: 900;
            }
            .doc-title {
              font-family: Georgia, serif;
              font-size: 20px;
              font-weight: 700;
              color: #0f172a;
              margin: 4px 0 2px 0;
            }
            .doc-subtitle {
              font-size: 11px;
              color: #64748b;
              text-transform: uppercase;
              letter-spacing: 0.08em;
              font-weight: 600;
            }
            .meta-box {
              text-align: right;
              font-size: 11px;
              color: #475569;
            }
            .meta-box .ref-tag {
              font-family: monospace;
              font-weight: 700;
              color: #0f172a;
              background: #f1f5f9;
              padding: 2px 6px;
              border-radius: 4px;
              display: inline-block;
              margin-bottom: 4px;
            }
            .advocate-strip {
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 10px;
              padding: 12px 16px;
              margin-bottom: 20px;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            .adv-name {
              font-size: 15px;
              font-weight: 700;
              color: #0f172a;
            }
            .adv-sub {
              font-size: 11px;
              color: #64748b;
              margin-top: 2px;
            }
            .badge-verified {
              background: #ecfdf5;
              border: 1px solid #10b981;
              color: #047857;
              padding: 3px 10px;
              border-radius: 20px;
              font-size: 10px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.05em;
            }
            .kpi-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 12px;
              margin-bottom: 22px;
            }
            .kpi-card {
              border: 1px solid #e2e8f0;
              border-radius: 10px;
              padding: 12px;
              background: #ffffff;
              position: relative;
            }
            .kpi-card::before {
              content: '';
              position: absolute;
              top: 0; left: 0; right: 0;
              height: 3px;
              border-radius: 10px 10px 0 0;
            }
            .kpi-card.c-green::before { background: #10b981; }
            .kpi-card.c-amber::before { background: #f59e0b; }
            .kpi-card.c-indigo::before { background: #6366f1; }
            .kpi-card.c-blue::before { background: #0284c7; }
            .kpi-label {
              font-size: 9px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 0.08em;
              color: #64748b;
            }
            .kpi-val {
              font-size: 18px;
              font-weight: 700;
              color: #0f172a;
              margin-top: 4px;
            }
            .kpi-sub {
              font-size: 10px;
              color: #64748b;
              margin-top: 2px;
            }
            .section-box {
              border: 1px solid #e2e8f0;
              border-radius: 10px;
              padding: 14px;
              margin-bottom: 18px;
              page-break-inside: avoid;
              background: #ffffff;
            }
            .section-title {
              font-size: 12px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 0.06em;
              color: #0f172a;
              border-bottom: 1px solid #f1f5f9;
              padding-bottom: 6px;
              margin-bottom: 10px;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            table.report-table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 6px;
            }
            table.report-table th {
              background: #0f172a;
              color: #ffffff;
              font-size: 10px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              padding: 7px 10px;
              text-align: left;
            }
            table.report-table td {
              padding: 7px 10px;
              border-bottom: 1px solid #f1f5f9;
              font-size: 11px;
              color: #334155;
            }
            table.report-table tr:nth-child(even) td {
              background: #f8fafc;
            }
            .bar-wrap {
              width: 100%;
              height: 6px;
              background: #f1f5f9;
              border-radius: 4px;
              overflow: hidden;
              margin-top: 3px;
            }
            .bar-fill {
              height: 100%;
              background: #d97706;
              border-radius: 4px;
            }
            .two-col-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 14px;
            }
            .footer-strip {
              border-top: 1px solid #e2e8f0;
              padding-top: 10px;
              margin-top: 24px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              font-size: 9px;
              color: #94a3b8;
              page-break-inside: avoid;
            }
            .seal-box {
              border-left: 2px solid #b45309;
              padding-left: 8px;
              font-style: italic;
            }
            @media print {
              body { margin: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <!-- Executive Header -->
          <div class="header-wrap">
            <div>
              <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
                <div style="width: 38px; height: 38px; border-radius: 50%; background: linear-gradient(135deg, #2563eb, #4f46e5); display: flex; align-items: center; justify-content: center; color: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; flex-shrink: 0; box-shadow: 0 3px 8px rgba(79, 70, 229, 0.25);">
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 22px; height: 22px; color: white; display: block;">
                    <path d="M12 4v16M8 20h8" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                    <path d="M5 8h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                    <path d="M5 8l-2 5M5 8l2 5M2 13c0 2 6 2 6 0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                    <path d="M19 8l-2 5M19 8l2 5M16 13c0 2 6 2 6 0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                    <circle cx="12" cy="11" r="2.2" fill="currentColor" />
                  </svg>
                </div>
                <div>
                  <div style="font-size: 22px; font-weight: 800; color: #0f172a; letter-spacing: -0.03em; line-height: 1.1; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                    Legal<span style="color: #4f46e5;">Connect</span>
                  </div>
                  <div style="font-size: 9px; font-weight: 800; color: #64748b; letter-spacing: 0.1em; text-transform: uppercase; margin-top: 1px;">
                    LEGAL HELP, SIMPLIFIED.
                  </div>
                </div>
              </div>
              <div class="doc-title">Practice Intelligence &amp; Revenue Dossier</div>
              <div class="doc-subtitle">Certified Telemetry Report • ${e(rangeLabel)}</div>
            </div>
            <div class="meta-box">
              <div class="ref-tag">${e(refCode)}</div>
              <div><strong>Generated:</strong> ${e(dateStr)} • ${e(timeStr)}</div>
              <div><strong>Window:</strong> ${e(rangeLabel)}</div>
              <div><strong>Status:</strong> Certified Record</div>
            </div>
          </div>

          <!-- Advocate Profile Strip -->
          <div class="advocate-strip">
            <div>
              <div class="adv-name">${e(advocate?.fullName || 'Advocate')}</div>
              <div class="adv-sub">${e(advocate?.email || 'N/A')} • ${e(advocate?.clientCity || advocate?.city || 'India')} • LegalConnect Verified Counsel</div>
            </div>
            <div>
              <span class="badge-verified">✓ Verified Practitioner</span>
            </div>
          </div>

          <!-- Top Executive KPI Grid -->
          <div class="kpi-grid">
            <div class="kpi-card c-green">
              <div class="kpi-label">Realized Cashflow</div>
              <div class="kpi-val">₹${e(gross)}</div>
              <div class="kpi-sub">Invoiced &amp; Settled</div>
            </div>
            <div class="kpi-card c-amber">
              <div class="kpi-label">Projected Retainers</div>
              <div class="kpi-val">₹${e(retainers)}</div>
              <div class="kpi-sub">Active Matter Pipeline</div>
            </div>
            <div class="kpi-card c-indigo">
              <div class="kpi-label">Lead Conversion</div>
              <div class="kpi-val">${e(conversion)}%</div>
              <div class="kpi-sub">${e(inquiries)} Leads / ${e(impressions)} Views</div>
            </div>
            <div class="kpi-card c-blue">
              <div class="kpi-label">Reputation Index</div>
              <div class="kpi-val">${e(avgRating)} ★</div>
              <div class="kpi-sub">${e(avgResponse)}m avg response (${e(grade)})</div>
            </div>
          </div>

          <!-- Practice Distribution & Acquisition Funnel (Two Column) -->
          <div class="two-col-grid">
            <!-- Left: Practice Areas -->
            <div class="section-box">
              <div class="section-title">
                <span>Practice Area Distribution</span>
                <span>${practiceBreakdown.length} Categories</span>
              </div>
              <table class="report-table">
                <thead>
                  <tr>
                    <th>Law Category</th>
                    <th style="text-align:right;">Matters</th>
                    <th style="text-align:right;">Share</th>
                  </tr>
                </thead>
                <tbody>
                  ${practiceBreakdown.length > 0 ? practiceBreakdown.map((p: any) => `
                    <tr>
                      <td style="font-weight:600;">${e(p.category || 'General Practice')}</td>
                      <td style="text-align:right;font-family:monospace;">${p.count || 0}</td>
                      <td style="text-align:right;font-weight:700;">${p.percentage || 0}%</td>
                    </tr>
                  `).join('') : `
                    <tr>
                      <td colspan="3" style="text-align:center;color:#94a3b8;">General Legal Practice (100%)</td>
                    </tr>
                  `}
                </tbody>
              </table>
            </div>

            <!-- Right: Funnel & SLA -->
            <div class="section-box">
              <div class="section-title">
                <span>Acquisition Funnel &amp; Benchmarks</span>
                <span>${e(grade)}</span>
              </div>
              <table class="report-table">
                <thead>
                  <tr>
                    <th>Funnel Milestone</th>
                    <th style="text-align:right;">Volume</th>
                    <th style="text-align:right;">Benchmark</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>1. Profile Discovery Impressions</td>
                    <td style="text-align:right;font-weight:700;">${e(impressions)}</td>
                    <td style="text-align:right;color:#059669;">Top Tier</td>
                  </tr>
                  <tr>
                    <td>2. Consultation Inquiries</td>
                    <td style="text-align:right;font-weight:700;">${e(inquiries)}</td>
                    <td style="text-align:right;color:#059669;">${e(conversion)}% Conv.</td>
                  </tr>
                  <tr>
                    <td>3. Advocate Response SLA</td>
                    <td style="text-align:right;font-weight:700;">${e(avgResponse)} mins</td>
                    <td style="text-align:right;color:#64748b;">Peer: ${e(peerResponse)}m</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Activity & Trajectory Table (if available) -->
          ${trajectory.length > 0 ? `
            <div class="section-box">
              <div class="section-title">
                <span>Revenue &amp; Retainer Velocity Timeline</span>
                <span>${trajectory.length} Timeline Milestones</span>
              </div>
              <table class="report-table">
                <thead>
                  <tr>
                    <th>Timeline Point</th>
                    <th style="text-align:right;">Realized Cashflow (₹)</th>
                    <th style="text-align:right;">Projected Retainers (₹)</th>
                    <th style="text-align:right;">Discovery Views</th>
                  </tr>
                </thead>
                <tbody>
                  ${trajectory.map((t: any) => `
                    <tr>
                      <td style="font-weight:600;">${e(t.label)}</td>
                      <td style="text-align:right;font-family:monospace;font-weight:700;color:#059669;">₹${Number(t.actual || 0).toLocaleString('en-IN')}</td>
                      <td style="text-align:right;font-family:monospace;color:#b45309;">₹${Number(t.projected || 0).toLocaleString('en-IN')}</td>
                      <td style="text-align:right;font-family:monospace;">${t.views || 0}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : ''}

          <!-- Footer -->
          <div class="footer-strip">
            <div class="seal-box">
              Certified LegalConnect Telemetry • Confidential &amp; Attorney-Client Privileged Transcript
            </div>
            <div>
              &copy; ${new Date().getFullYear()} LegalConnect Network Inc. • Document ID: ${e(refCode)}
            </div>
          </div>

          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 350);
            };
          </script>
        </body>
      </html>
    `;

    return this.printHtmlDocument(html, `LegalConnect-Practice-Intelligence-${refCode}`, onPopupBlocked);
  }

  /**
   * Generates a Top-Tier MNC Executive Dossier for Clients (Spend & Case Transparency).
   */
  printClientInsightsDossier(client: any, data: any, onPopupBlocked?: () => void): boolean {
    const e = (val: any) => this.escapeHtml(val);
    const dateStr = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const refCode = `LC-CLI-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

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
    const milestones = data?.spendMilestones || [];
    const pipeline = data?.casePipeline || [];

    const html = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8">
          <title>${e(client?.fullName || 'Client')} - Legal Spend &amp; Case Transparency Dossier | LegalConnect</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 12mm 15mm 12mm 15mm;
            }
            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              color: #0f172a;
              background: #ffffff;
              line-height: 1.4;
              font-size: 12px;
              margin: 0;
              padding: 0;
            }
            .header-wrap {
              border-top: 4px solid #059669;
              padding: 16px 0 12px 0;
              border-bottom: 2px solid #0f172a;
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              margin-bottom: 20px;
            }
            .brand-logo {
              font-size: 16px;
              font-weight: 900;
              letter-spacing: 0.12em;
              color: #0f172a;
              text-transform: uppercase;
              display: flex;
              align-items: center;
              gap: 6px;
            }
            .brand-logo .crest {
              background: #059669;
              color: #ffffff;
              font-size: 11px;
              padding: 3px 6px;
              border-radius: 4px;
              font-weight: 900;
            }
            .doc-title {
              font-family: Georgia, serif;
              font-size: 20px;
              font-weight: 700;
              color: #0f172a;
              margin: 4px 0 2px 0;
            }
            .doc-subtitle {
              font-size: 11px;
              color: #64748b;
              text-transform: uppercase;
              letter-spacing: 0.08em;
              font-weight: 600;
            }
            .meta-box {
              text-align: right;
              font-size: 11px;
              color: #475569;
            }
            .meta-box .ref-tag {
              font-family: monospace;
              font-weight: 700;
              color: #0f172a;
              background: #f1f5f9;
              padding: 2px 6px;
              border-radius: 4px;
              display: inline-block;
              margin-bottom: 4px;
            }
            .client-strip {
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 10px;
              padding: 12px 16px;
              margin-bottom: 20px;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            .cli-name {
              font-size: 15px;
              font-weight: 700;
              color: #0f172a;
            }
            .cli-sub {
              font-size: 11px;
              color: #64748b;
              margin-top: 2px;
            }
            .badge-client {
              background: #eff6ff;
              border: 1px solid #3b82f6;
              color: #1d4ed8;
              padding: 3px 10px;
              border-radius: 20px;
              font-size: 10px;
              font-weight: 700;
              text-transform: uppercase;
            }
            .kpi-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 12px;
              margin-bottom: 22px;
            }
            .kpi-card {
              border: 1px solid #e2e8f0;
              border-radius: 10px;
              padding: 12px;
              background: #ffffff;
              position: relative;
            }
            .kpi-card::before {
              content: '';
              position: absolute;
              top: 0; left: 0; right: 0;
              height: 3px;
              border-radius: 10px 10px 0 0;
            }
            .kpi-card.c-green::before { background: #10b981; }
            .kpi-card.c-amber::before { background: #f59e0b; }
            .kpi-card.c-slate::before { background: #64748b; }
            .kpi-card.c-emerald::before { background: #059669; }
            .kpi-label {
              font-size: 9px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 0.08em;
              color: #64748b;
            }
            .kpi-val {
              font-size: 18px;
              font-weight: 700;
              color: #0f172a;
              margin-top: 4px;
            }
            .kpi-sub {
              font-size: 10px;
              color: #64748b;
              margin-top: 2px;
            }
            .section-box {
              border: 1px solid #e2e8f0;
              border-radius: 10px;
              padding: 14px;
              margin-bottom: 18px;
              page-break-inside: avoid;
              background: #ffffff;
            }
            .section-title {
              font-size: 12px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 0.06em;
              color: #0f172a;
              border-bottom: 1px solid #f1f5f9;
              padding-bottom: 6px;
              margin-bottom: 10px;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            table.report-table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 6px;
            }
            table.report-table th {
              background: #0f172a;
              color: #ffffff;
              font-size: 10px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              padding: 7px 10px;
              text-align: left;
            }
            table.report-table td {
              padding: 7px 10px;
              border-bottom: 1px solid #f1f5f9;
              font-size: 11px;
              color: #334155;
            }
            table.report-table tr:nth-child(even) td {
              background: #f8fafc;
            }
            .status-pill {
              display: inline-block;
              padding: 2px 7px;
              border-radius: 4px;
              font-size: 9px;
              font-weight: 800;
              text-transform: uppercase;
            }
            .pill-completed { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }
            .pill-progress { background: #fffbeb; color: #b45309; border: 1px solid #fde68a; }
            .pill-upcoming { background: #f1f5f9; color: #64748b; }
            .two-col-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 14px;
            }
            .footer-strip {
              border-top: 1px solid #e2e8f0;
              padding-top: 10px;
              margin-top: 24px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              font-size: 9px;
              color: #94a3b8;
              page-break-inside: avoid;
            }
            .seal-box {
              border-left: 2px solid #059669;
              padding-left: 8px;
              font-style: italic;
            }
            @media print {
              body { margin: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <!-- Executive Header -->
          <div class="header-wrap">
            <div>
              <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
                <div style="width: 38px; height: 38px; border-radius: 50%; background: linear-gradient(135deg, #2563eb, #4f46e5); display: flex; align-items: center; justify-content: center; color: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; flex-shrink: 0; box-shadow: 0 3px 8px rgba(79, 70, 229, 0.25);">
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 22px; height: 22px; color: white; display: block;">
                    <path d="M12 4v16M8 20h8" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                    <path d="M5 8h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                    <path d="M5 8l-2 5M5 8l2 5M2 13c0 2 6 2 6 0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                    <path d="M19 8l-2 5M19 8l2 5M16 13c0 2 6 2 6 0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                    <circle cx="12" cy="11" r="2.2" fill="currentColor" />
                  </svg>
                </div>
                <div>
                  <div style="font-size: 22px; font-weight: 800; color: #0f172a; letter-spacing: -0.03em; line-height: 1.1; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                    Legal<span style="color: #4f46e5;">Connect</span>
                  </div>
                  <div style="font-size: 9px; font-weight: 800; color: #64748b; letter-spacing: 0.1em; text-transform: uppercase; margin-top: 1px;">
                    LEGAL HELP, SIMPLIFIED.
                  </div>
                </div>
              </div>
              <div class="doc-title">Client Legal Spend &amp; Matter Transparency Report</div>
              <div class="doc-subtitle">Certified Financial &amp; Case Progress Dossier</div>
            </div>
            <div class="meta-box">
              <div class="ref-tag">${e(refCode)}</div>
              <div><strong>Generated:</strong> ${e(dateStr)} • ${e(timeStr)}</div>
              <div><strong>Assigned Counsel:</strong> ${e(advocateName)}</div>
              <div><strong>Status:</strong> Audited &amp; Verified</div>
            </div>
          </div>

          <!-- Client Strip -->
          <div class="client-strip">
            <div>
              <div class="cli-name">${e(client?.fullName || 'Client')}</div>
              <div class="cli-sub">${e(client?.email || 'N/A')} • Primary Counsel: ${e(advocateName)} (${e(avgResponse)} response)</div>
            </div>
            <div>
              <span class="badge-client">Active Legal Client</span>
            </div>
          </div>

          <!-- Spend KPI Grid -->
          <div class="kpi-grid">
            <div class="kpi-card c-green">
              <div class="kpi-label">Settled Spend</div>
              <div class="kpi-val">₹${e(totalSpend)}</div>
              <div class="kpi-sub">Invoiced &amp; Disbursed</div>
            </div>
            <div class="kpi-card c-amber">
              <div class="kpi-label">In Escrow</div>
              <div class="kpi-val">₹${e(inEscrow)}</div>
              <div class="kpi-sub">Retained on Milestones</div>
            </div>
            <div class="kpi-card c-slate">
              <div class="kpi-label">Legal Budget</div>
              <div class="kpi-val">${e(budgetCap)}</div>
              <div class="kpi-sub">Client Outlay Ceiling</div>
            </div>
            <div class="kpi-card c-emerald">
              <div class="kpi-label">Remaining Balance</div>
              <div class="kpi-val">${e(remaining)}</div>
              <div class="kpi-sub">Uncommitted Reserve</div>
            </div>
          </div>

          <!-- Case Pipeline Progression -->
          ${pipeline.length > 0 ? `
            <div class="section-box">
              <div class="section-title">
                <span>Case Trajectory Pipeline</span>
                <span>${pipeline.length} Milestones</span>
              </div>
              <table class="report-table">
                <thead>
                  <tr>
                    <th>Step #</th>
                    <th>Stage &amp; Description</th>
                    <th>Status</th>
                    <th style="text-align:right;">Date / Schedule</th>
                  </tr>
                </thead>
                <tbody>
                  ${pipeline.map((p: any) => `
                    <tr>
                      <td style="font-weight:700;font-family:monospace;">0${p.step}</td>
                      <td>
                        <strong style="color:#0f172a;">${e(p.title)}</strong>
                        <div style="font-size:10px;color:#64748b;">${e(p.desc)}</div>
                      </td>
                      <td>
                        <span class="status-pill ${p.status === 'Completed' ? 'pill-completed' : (p.status === 'In Progress' ? 'pill-progress' : 'pill-upcoming')}">
                          ${e(p.status)}
                        </span>
                      </td>
                      <td style="text-align:right;font-family:monospace;font-size:10px;color:#475569;">${e(p.completedAt)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : ''}

          <!-- Itemized Milestone Invoices & Counsel Commitment (Two Columns) -->
          <div class="two-col-grid">
            <!-- Left: Milestone Fee Schedule -->
            <div class="section-box">
              <div class="section-title">
                <span>Milestone Fee Schedule</span>
                <span>${milestones.length} Invoices</span>
              </div>
              <table class="report-table">
                <thead>
                  <tr>
                    <th>Milestone Details</th>
                    <th style="text-align:right;">Fee (₹)</th>
                    <th style="text-align:right;">Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${milestones.length > 0 ? milestones.map((m: any) => `
                    <tr>
                      <td>
                        <strong style="color:#0f172a;">${e(m.title)}</strong>
                        <div style="font-size:10px;color:#64748b;">${e(m.date)}</div>
                      </td>
                      <td style="text-align:right;font-family:monospace;font-weight:700;">₹${Number(m.amount || 0).toLocaleString('en-IN')}</td>
                      <td style="text-align:right;">
                        <span class="status-pill ${m.status === 'Settled' ? 'pill-completed' : (m.status === 'In Escrow' ? 'pill-progress' : 'pill-upcoming')}">
                          ${e(m.status)}
                        </span>
                      </td>
                    </tr>
                  `).join('') : `
                    <tr>
                      <td colspan="3" style="text-align:center;color:#94a3b8;">No consultation milestones logged yet.</td>
                    </tr>
                  `}
                </tbody>
              </table>
            </div>

            <!-- Right: Research Preparedness & Counsel Commitment -->
            <div class="section-box">
              <div class="section-title">
                <span>Preparedness &amp; Counsel SLA</span>
                <span>Verified Data</span>
              </div>
              <table class="report-table">
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th style="text-align:right;">Score / Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Research Preparedness Score</td>
                    <td style="text-align:right;font-weight:700;color:#059669;">${prepScore}% (${e(prepLabel)})</td>
                  </tr>
                  <tr>
                    <td>Knowledge Base Depth</td>
                    <td style="text-align:right;font-family:monospace;">${prepVerified} of ${prepTotal} items completed</td>
                  </tr>
                  <tr>
                    <td>Assigned Primary Counsel</td>
                    <td style="text-align:right;font-weight:600;">${e(advocateName)}</td>
                  </tr>
                  <tr>
                    <td>Average Counsel Response SLA</td>
                    <td style="text-align:right;font-family:monospace;">${e(avgResponse)}</td>
                  </tr>
                  <tr>
                    <td>Engagement Duration</td>
                    <td style="text-align:right;font-family:monospace;font-weight:700;">${daysEngaged} Days</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Footer -->
          <div class="footer-strip">
            <div class="seal-box">
              LegalConnect Client Matter Dossier • Certified Itemized Record &amp; Escrow Transparency
            </div>
            <div>
              &copy; ${new Date().getFullYear()} LegalConnect Network Inc. • Document ID: ${e(refCode)}
            </div>
          </div>

          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 350);
            };
          </script>
        </body>
      </html>
    `;

    return this.printHtmlDocument(html, `LegalConnect-Client-Dossier-${refCode}`, onPopupBlocked);
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