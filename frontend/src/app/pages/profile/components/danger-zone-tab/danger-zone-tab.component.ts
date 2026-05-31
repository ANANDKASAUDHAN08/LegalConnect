import { Component, Output, EventEmitter, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../../services/auth.service';
import { SnackbarService } from '../../../../services/snackbar.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-danger-zone-tab',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './danger-zone-tab.component.html'
})
export class DangerZoneTabComponent implements OnDestroy {
  showDeleteConfirmPopup = false;
  confirmText = '';
  deleting = false;

  showExportPopup = false;
  exportFormat = 'pdf';
  exporting = false;

  constructor(
    private auth: AuthService,
    private snackbar: SnackbarService,
    private router: Router
  ) { }

  ngOnDestroy() {
    if (typeof document !== 'undefined') {
      document.body.classList.remove('overflow-hidden');
    }
  }

  updateScroll() {
    if (typeof document !== 'undefined') {
      if (this.showDeleteConfirmPopup || this.showExportPopup) {
        document.body.classList.add('overflow-hidden');
      } else {
        document.body.classList.remove('overflow-hidden');
      }
    }
  }

  openDeletePopup() {
    this.showDeleteConfirmPopup = true;
    this.updateScroll();
  }

  closeDeletePopup() {
    this.showDeleteConfirmPopup = false;
    this.confirmText = '';
    this.updateScroll();
  }

  openExportPopup() {
    this.showExportPopup = true;
    this.updateScroll();
  }

  closeExportPopup() {
    if (this.exporting) return;
    this.showExportPopup = false;
    this.updateScroll();
  }

  get canDelete(): boolean {
    return this.confirmText === 'DELETE';
  }

  deleteAccount() {
    if (!this.canDelete) return;
    this.deleting = true;
    this.auth.deleteAccount().subscribe({
      next: () => {
        this.snackbar.show('Account permanently deleted.', 'success');
        this.showDeleteConfirmPopup = false;
        this.confirmText = '';
        this.updateScroll();
        this.router.navigate(['/']);
      },
      error: (err) => {
        this.deleting = false;
        this.snackbar.show(err.error || 'Failed to delete account.', 'error');
      }
    });
  }

  triggerDownload() {
    this.exporting = true;
    this.snackbar.show('Fetching your data from the server...', 'info');

    this.auth.getExportData().subscribe({
      next: (data) => {
        this.snackbar.show('Generating export file...', 'info');

        try {
          const profile = data.profile || {};
          const bookmarks = data.bookmarks || [];
          const consultations = data.consultations || [];
          const reviews = data.reviews || [];
          const lawyerProfile = data.lawyerProfile || null;
          const dateStr = new Date(data.exportedAt || new Date()).toLocaleString();

          if (this.exportFormat === 'json') {
            const jsonStr = JSON.stringify(data, null, 2);
            this.downloadBlob(jsonStr, 'application/json', `legalconnect_export_${profile.id || 'data'}.json`);
          }
          else if (this.exportFormat === 'text') {
            const txt = this.generateTxtFormat(profile, bookmarks, consultations, reviews, dateStr, lawyerProfile);
            this.downloadBlob(txt, 'text/plain;charset=utf-8;', `legalconnect_export_${profile.id || 'data'}.txt`);
          }
          else if (this.exportFormat === 'word') {
            const wordHtml = this.generateWordHtml(profile, bookmarks, consultations, reviews, dateStr, lawyerProfile);
            this.downloadBlob('\ufeff' + wordHtml, 'application/msword', `legalconnect_export_${profile.id || 'data'}.doc`);
          }
          else if (this.exportFormat === 'pdf') {
            this.generatePdfReport(profile, bookmarks, consultations, reviews, dateStr, lawyerProfile);
          }

          this.snackbar.show('Data exported successfully!', 'success');
          this.showExportPopup = false;
          this.updateScroll();
        } catch (e) {
          console.error(e);
          this.snackbar.show('Failed to generate export file.', 'error');
        }
        this.exporting = false;
      },
      error: (err) => {
        this.exporting = false;
        this.snackbar.show('Failed to retrieve data from server.', 'error');
      }
    });
  }

  private downloadBlob(content: string, mimeType: string, fileName: string) {
    const blob = new Blob([content], { type: mimeType });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  private generateTxtFormat(profile: any, bookmarks: any[], consultations: any[], reviews: any[], dateStr: string, lawyerProfile: any = null): string {
    let txt = `========================================================================\n`;
    txt += `                            LEGALCONNECT REPORT\n`;
    txt += `========================================================================\n`;
    txt += `Generated On: ${dateStr}\n\n`;

    txt += `-- USER PROFILE INFORMATION --\n`;
    txt += `ID: ${profile.id}\n`;
    txt += `Full Name: ${profile.fullName}\n`;
    txt += `Email: ${profile.email}\n`;
    txt += `Role: ${profile.role}\n`;
    txt += `Created At: ${profile.createdAt}\n`;
    txt += `Phone: ${profile.phone || 'N/A'}\n`;
    txt += `Language: ${profile.clientLanguage || 'N/A'}\n`;
    txt += `City: ${profile.clientCity || 'N/A'}\n`;
    txt += `Interest Area: ${profile.clientInterest || 'N/A'}\n`;
    txt += `Bio: ${profile.clientBio || 'N/A'}\n\n`;

    if (profile.role === 'Lawyer' && lawyerProfile) {
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

    txt += `-- BOOKMARKS & SAVED STATUTES (${bookmarks.length}) --\n`;
    if (bookmarks.length === 0) {
      txt += `No saved bookmarks found.\n`;
    } else {
      bookmarks.forEach((b, i) => {
        txt += `[${i + 1}] Act: ${b.actShortName} | Chapter: ${b.chapterNumber} | Section: ${b.sectionNumber}\n`;
        txt += `    Title: ${b.sectionTitle}\n`;
        txt += `    Content: ${b.sectionContent}\n`;
        txt += `    Saved At: ${b.savedAt}\n\n`;
      });
    }

    txt += `-- CASES & CONSULTATIONS (${consultations.length}) --\n`;
    if (consultations.length === 0) {
      txt += `No consultations found.\n`;
    } else {
      consultations.forEach((c, i) => {
        txt += `[${i + 1}] Consultation ID: ${c.id}\n`;
        txt += `    Contact: ${c.clientName} (${c.clientEmail})\n`;
        txt += `    Message: ${c.message}\n`;
        txt += `    Status: ${c.status}\n`;
        txt += `    Date: ${c.createdAt}\n\n`;
      });
    }

    txt += `-- USER REVIEWS (${reviews.length}) --\n`;
    if (reviews.length === 0) {
      txt += `No reviews logged.\n`;
    } else {
      reviews.forEach((r, i) => {
        txt += `[${i + 1}] Review for: ${r.targetName}\n`;
        txt += `    Rating: ${r.rating} / 5 Stars\n`;
        txt += `    Content: ${r.content}\n`;
        txt += `    Date: ${r.createdAt}\n\n`;
      });
    }

    txt += `========================================================================\n`;
    txt += `End of LegalConnect Report\n`;
    txt += `========================================================================\n`;
    return txt;
  }

  private generateWordHtml(profile: any, bookmarks: any[], consultations: any[], reviews: any[], dateStr: string, lawyerProfile: any = null): string {
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
    html += `<div class="tagline">LEGAL HELP, SIMPLIFIED. | Generated: ${dateStr}</div>`;
    html += `</div>`;

    html += `<div class="section"><div class="section-title">User Profile Details</div></div>`;
    html += `<table class="info-table">`;
    html += `<tr><td class="info-label">Full Name</td><td>${profile.fullName}</td></tr>`;
    html += `<tr><td class="info-label">Email Address</td><td>${profile.email}</td></tr>`;
    html += `<tr><td class="info-label">Account Role</td><td>${profile.role}</td></tr>`;
    html += `<tr><td class="info-label">Contact Phone</td><td>${profile.phone || 'N/A'}</td></tr>`;
    html += `<tr><td class="info-label">Preferred Language</td><td>${profile.clientLanguage || 'N/A'}</td></tr>`;
    html += `<tr><td class="info-label">User Location</td><td>${profile.clientCity || 'N/A'}, ${profile.clientState || 'N/A'}</td></tr>`;
    html += `<tr><td class="info-label">Bio Description</td><td>${profile.clientBio || 'N/A'}</td></tr>`;
    html += `</table>`;

    if (profile.role === 'Lawyer' && lawyerProfile) {
      html += `<div class="section"><div class="section-title">Professional Credentials</div></div>`;
      html += `<table class="info-table">`;
      html += `<tr><td class="info-label">Bar Council Number</td><td>${lawyerProfile.barCouncilNumber || 'N/A'}</td></tr>`;
      html += `<tr><td class="info-label">Specialization</td><td>${lawyerProfile.specialization || 'N/A'}</td></tr>`;
      html += `<tr><td class="info-label">Practice Experience</td><td>${lawyerProfile.experienceYears || 0} Years</td></tr>`;
      html += `<tr><td class="info-label">Consultation Fee</td><td>${lawyerProfile.consultationFee ? '$' + lawyerProfile.consultationFee : 'Free'}</td></tr>`;
      html += `<tr><td class="info-label">Office Address</td><td>${lawyerProfile.officeAddress || 'N/A'}</td></tr>`;
      html += `<tr><td class="info-label">Education & Background</td><td>${lawyerProfile.education || 'N/A'}</td></tr>`;
      html += `<tr><td class="info-label">Languages Spoken</td><td>${lawyerProfile.languagesSpoken || 'N/A'}</td></tr>`;
      html += `<tr><td class="info-label">Availability</td><td>${lawyerProfile.isAvailable ? 'Available' : 'Unavailable'}</td></tr>`;
      html += `</table>`;
    }

    html += `<div class="section"><div class="section-title">Saved Laws & Statutes (${bookmarks.length})</div></div>`;
    if (bookmarks.length === 0) {
      html += `<p>No bookmarks saved in your account.</p>`;
    } else {
      html += `<table class="data-table">`;
      html += `<tr><th>Act Name</th><th>Chapter/Section</th><th>Title</th><th>Date Saved</th></tr>`;
      bookmarks.forEach(b => {
        html += `<tr><td>${b.actShortName}</td><td>Ch. ${b.chapterNumber} Sec. ${b.sectionNumber}</td><td>${b.sectionTitle}</td><td>${b.savedAt}</td></tr>`;
      });
      html += `</table>`;
    }

    html += `<div class="section"><div class="section-title">Cases & Consultations (${consultations.length})</div></div>`;
    if (consultations.length === 0) {
      html += `<p>No consultations logged in your account.</p>`;
    } else {
      html += `<table class="data-table">`;
      html += `<tr><th>ID</th><th>Contact Info</th><th>Consultation Message</th><th>Status</th><th>Date</th></tr>`;
      consultations.forEach(c => {
        html += `<tr><td>${c.id}</td><td>${c.clientName}<br/>${c.clientEmail}</td><td>${c.message}</td><td>${c.status}</td><td>${c.createdAt}</td></tr>`;
      });
      html += `</table>`;
    }

    html += `<div class="section"><div class="section-title">Client Reviews (${reviews.length})</div></div>`;
    if (reviews.length === 0) {
      html += `<p>No reviews posted.</p>`;
    } else {
      html += `<table class="data-table">`;
      html += `<tr><th>Recipient</th><th>Rating</th><th>Content</th><th>Date Posted</th></tr>`;
      reviews.forEach(r => {
        html += `<tr><td>${r.targetName}</td><td>${r.rating} / 5 Stars</td><td>${r.content}</td><td>${r.createdAt}</td></tr>`;
      });
      html += `</table>`;
    }

    html += `<div class="footer">Generated by LegalConnect. All rights reserved. &copy; 2026</div>`;
    html += `</body></html>`;
    return html;
  }

  private generatePdfReport(profile: any, bookmarks: any[], consultations: any[], reviews: any[], dateStr: string, lawyerProfile: any = null) {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      this.snackbar.show('Popups are blocked! Please enable popups to download PDF.', 'warning');
      return;
    }

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

    printWindow.document.write(`
      <html>
        <head>
          <title>LegalConnect Report - ${profile.fullName}</title>
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
              <p>Generated: ${dateStr}</p>
            </div>
          </div>

          <div class="profile-card">
            ${profile.avatarUrl ? `
              <img class="profile-avatar" src="${profile.avatarUrl}" alt="User Avatar" />
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
              <h3>${profile.fullName}</h3>
              <p>${profile.clientBio || 'No biography details provided.'}</p>
              <div class="grid-details">
                <div class="grid-item"><strong>Email:</strong> ${profile.email}</div>
                <div class="grid-item"><strong>Account Role:</strong> ${profile.role}</div>
                <div class="grid-item"><strong>Contact Phone:</strong> ${profile.phone || 'N/A'}</div>
                <div class="grid-item"><strong>Location:</strong> ${profile.clientCity || 'N/A'}, ${profile.clientState || 'N/A'}</div>
                <div class="grid-item"><strong>Member Since:</strong> ${profile.createdAt ? new Date(profile.createdAt).toLocaleDateString() : 'N/A'}</div>
                <div class="grid-item"><strong>Language Pref:</strong> ${profile.clientLanguage || 'N/A'}</div>
              </div>
            </div>
          </div>

          ${profile.role === 'Lawyer' && lawyerProfile ? `
            <div class="section-block">
              <div class="section-header">Professional Credentials</div>
              <table>
                <tbody>
                  <tr>
                    <td style="width: 30%; font-weight: 600;">Bar Council Number</td>
                    <td>${lawyerProfile.barCouncilNumber || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td style="font-weight: 600;">Specialization</td>
                    <td>${lawyerProfile.specialization || 'N/A'}</td>
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
                    <td>${lawyerProfile.officeAddress || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td style="font-weight: 600;">Education & Background</td>
                    <td>${lawyerProfile.education || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td style="font-weight: 600;">Languages Spoken</td>
                    <td>${lawyerProfile.languagesSpoken || 'N/A'}</td>
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
            <div class="section-header">Saved Laws & Statutes (${bookmarks.length})</div>
            ${bookmarks.length === 0 ? '<p style="font-size:12px;color:#64748b;">No saved laws or bookmarked codes found in this account.</p>' : `
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
                  ${bookmarks.map(b => `
                    <tr>
                      <td style="font-weight:600;">${b.actShortName}</td>
                      <td>Ch. ${b.chapterNumber} Sec. ${b.sectionNumber}</td>
                      <td>${b.sectionTitle}</td>
                      <td>${b.savedAt ? new Date(b.savedAt).toLocaleDateString() : 'N/A'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            `}
          </div>

          <div class="section-block">
            <div class="section-header">Consultation & Case History (${consultations.length})</div>
            ${consultations.length === 0 ? '<p style="font-size:12px;color:#64748b;">No active case consultations or booked legal reviews found.</p>' : `
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
                  ${consultations.map(c => `
                    <tr>
                      <td>#${c.id}</td>
                      <td><strong>${c.clientName}</strong><br/><span style="color:#64748b;font-size:10px;">${c.clientEmail}</span></td>
                      <td style="max-width:200px;font-size:11px;">${c.message}</td>
                      <td><span class="status-badge status-${c.status || 'Pending'}">${c.status || 'Pending'}</span></td>
                      <td>${c.createdAt ? new Date(c.createdAt).toLocaleDateString() : 'N/A'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            `}
          </div>

          <div class="section-block">
            <div class="section-header">Reviews Left (${reviews.length})</div>
            ${reviews.length === 0 ? '<p style="font-size:12px;color:#64748b;">No professional reviews have been logged by this account.</p>' : `
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
                  ${reviews.map(r => `
                    <tr>
                      <td style="font-weight:600;">${r.targetName}</td>
                      <td style="color:#f59e0b;font-weight:600;">${r.rating} / 5 Stars</td>
                      <td style="font-style:italic;">"${r.content}"</td>
                      <td>${r.createdAt ? new Date(r.createdAt).toLocaleDateString() : 'N/A'}</td>
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
    printWindow.document.close();
  }
}
