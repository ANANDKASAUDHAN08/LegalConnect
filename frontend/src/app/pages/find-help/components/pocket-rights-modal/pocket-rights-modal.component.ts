import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, OnChanges, OnDestroy, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TooltipDirective } from '../../../../directives/tooltip.directive';
import { SnackbarService } from '../../../../services/snackbar.service';

@Component({
  selector: 'app-pocket-rights-modal',
  standalone: true,
  imports: [CommonModule, TooltipDirective],
  templateUrl: './pocket-rights-modal.component.html',
  styleUrls: ['./pocket-rights-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PocketRightsModalComponent implements OnChanges, OnDestroy {
  @Input() isOpen = false;
  @Input() locationQuery = 'India';
  @Output() close = new EventEmitter<void>();

  private snackbar = inject(SnackbarService);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && typeof document !== 'undefined') {
      if (this.isOpen) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }
    }
  }

  ngOnDestroy(): void {
    if (typeof document !== 'undefined') {
      document.body.style.overflow = '';
    }
  }

  printRightsCard(): void {
    this.snackbar.show('Generating printable Citizen Legal Rights Dossier...', 'info');

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      this.snackbar.show('Please allow popups to print the dossier.', 'error');
      return;
    }

    const docDate = new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
    const docTime = new Date().toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit'
    });
    const docRef = 'LC-PRD-' + Math.random().toString(36).substring(2, 8).toUpperCase();

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <title>LegalConnect - Citizen Legal Rights Wallet Dossier</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 12mm 15mm;
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            color: #0f172a;
            background: #ffffff;
            margin: 0;
            padding: 0;
            font-size: 11.5px;
            line-height: 1.45;
          }

          /* ── HEADER WITH OFFICIAL BRANDING ── */
          .doc-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2.5px solid #1e3a8a;
            padding-bottom: 12px;
            margin-bottom: 14px;
          }
          .brand-logo-area {
            display: flex;
            align-items: center;
            gap: 10px;
          }
          .logo-emblem {
            width: 38px;
            height: 38px;
            background: #1e3a8a;
            color: #ffffff;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 900;
            font-size: 18px;
          }
          .brand-title {
            font-size: 18px;
            font-weight: 900;
            color: #1e3a8a;
            letter-spacing: -0.5px;
            margin: 0;
            line-height: 1.1;
          }
          .brand-sub {
            font-size: 9.5px;
            font-weight: 700;
            color: #d97706;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            margin-top: 2px;
          }
          .header-meta {
            text-align: right;
            font-size: 9px;
            color: #64748b;
            line-height: 1.35;
          }
          .header-meta strong {
            color: #0f172a;
            font-size: 9.5px;
          }

          /* ── CARD TITLE BANNER ── */
          .title-banner {
            background: #f8fafc;
            border: 1.5px solid #cbd5e1;
            border-radius: 8px;
            padding: 10px 14px;
            margin-bottom: 14px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .banner-heading {
            margin: 0;
            font-size: 13.5px;
            font-weight: 800;
            color: #0f172a;
          }
          .banner-jurisdiction {
            font-size: 9px;
            font-weight: 800;
            background: #e2e8f0;
            color: #334155;
            padding: 3px 8px;
            border-radius: 999px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          /* ── 5 CONSTITUTIONAL RIGHTS LIST ── */
          .rights-list {
            display: flex;
            flex-direction: column;
            gap: 10px;
            margin-bottom: 16px;
          }
          .right-item {
            display: flex;
            align-items: flex-start;
            gap: 10px;
            padding: 8px 10px;
            border-left: 3.5px solid #2563eb;
            background: #f8fafc;
            border-radius: 0 6px 6px 0;
          }
          .right-num {
            width: 20px;
            height: 20px;
            background: #2563eb;
            color: #ffffff;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            font-weight: 800;
            flex-shrink: 0;
            margin-top: 1px;
          }
          .right-content b {
            font-size: 11px;
            color: #0f172a;
            display: block;
            margin-bottom: 2px;
          }
          .right-content p {
            font-size: 10px;
            color: #334155;
            margin: 0;
            line-height: 1.35;
          }

          /* ── EMERGENCY HELPLINES GRID ── */
          .helplines-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 8px;
            margin-bottom: 16px;
          }
          .helpline-box {
            border: 1.5px solid #e2e8f0;
            border-radius: 6px;
            padding: 8px;
            text-align: center;
            background: #f8fafc;
          }
          .helpline-name {
            font-size: 8px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #64748b;
            display: block;
            margin-bottom: 2px;
          }
          .helpline-num {
            font-size: 14px;
            font-weight: 900;
            color: #dc2626;
            margin: 0;
          }

          /* ── OFFICIAL FOOTER MARK ── */
          .doc-footer {
            border-top: 1.5px solid #e2e8f0;
            padding-top: 10px;
            margin-top: 18px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 8.5px;
            color: #64748b;
          }
          .footer-watermark {
            font-weight: 800;
            color: #1e3a8a;
            letter-spacing: 0.5px;
            text-transform: uppercase;
          }
          .legal-disclaimer {
            font-size: 8px;
            color: #94a3b8;
            text-align: right;
            max-width: 60%;
            line-height: 1.25;
          }
        </style>
      </head>
      <body>

        <!-- Official Header with Brand Identity Matching Website -->
        <div class="doc-header">
          <div class="brand-logo-area">
            <div style="width: 36px; height: 36px; border-radius: 50%; background: #2563eb; display: flex; align-items: center; justify-content: center; color: white; flex-shrink: 0; box-shadow: 0 2px 8px rgba(37,99,235,0.25);">
              <svg viewBox="0 0 24 24" fill="none" style="width: 22px; height: 22px; color: #ffffff;" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 4v16M8 20h8" stroke="#ffffff" stroke-width="2" stroke-linecap="round" />
                <path d="M5 8h14" stroke="#ffffff" stroke-width="2" stroke-linecap="round" />
                <path d="M5 8l-2 5M5 8l2 5M2 13c0 2 6 2 6 0" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                <path d="M19 8l-2 5M19 8l2 5M16 13c0 2 6 2 6 0" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                <circle cx="12" cy="11" r="2.2" fill="#ffffff" />
              </svg>
            </div>
            <div style="display: flex; flex-direction: column;">
              <span style="font-size: 19px; font-weight: 900; color: #0f172a; letter-spacing: -0.5px; line-height: 1.1;">LegalConnect</span>
              <span style="font-size: 8.5px; color: #64748b; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; margin-top: 1px;">LEGAL HELP, SIMPLIFIED.</span>
            </div>
          </div>
          <div class="header-meta">
            <div>Doc Ref: <strong>${docRef}</strong></div>
            <div>Issued: <strong>${docDate}, ${docTime}</strong></div>
            <div>Jurisdiction: <strong>Republic of India</strong></div>
          </div>
        </div>

        <!-- Banner -->
        <div class="title-banner">
          <div>
            <h2 class="banner-heading">Citizen Legal Rights &amp; Arrest Safeguards Dossier</h2>
            <div style="font-size: 9.5px; color: #64748b; margin-top: 2px;">
              Constitutional Protections &bull; D.K. Basu Arrest Guidelines &bull; Section 12 NALSA Act
            </div>
          </div>
          <span class="banner-jurisdiction">District: ${this.locationQuery}</span>
        </div>

        <!-- 5 Core Constitutional Rights -->
        <div class="rights-list">
          <div class="right-item">
            <div class="right-num">1</div>
            <div class="right-content">
              <b>Right to Know Grounds of Arrest &amp; Bailability (Art 22(1) / BNSS 47 / CrPC 50)</b>
              <p>Police must immediately inform you of the exact legal offence and whether you are entitled to bail as a matter of right. For bailable offences, police are legally mandated to offer bail at the station.</p>
            </div>
          </div>

          <div class="right-item">
            <div class="right-num">2</div>
            <div class="right-content">
              <b>24-Hour Production Before Judicial Magistrate (Art 22(2) / BNSS 58 / CrPC 57)</b>
              <p>No arrested citizen can be detained in police custody beyond 24 hours without express judicial remand from a Judicial Magistrate (excluding necessary journey time).</p>
            </div>
          </div>

          <div class="right-item">
            <div class="right-num">3</div>
            <div class="right-content">
              <b>D.K. Basu Supreme Court Guidelines on Arrest &amp; Memo Intimation</b>
              <p>Police officers must wear clear identification badges. An Arrest Memo must be prepared and signed by at least one family member or respectable local witness. Family or friend must be informed within 8 to 12 hours.</p>
            </div>
          </div>

          <div class="right-item">
            <div class="right-num">4</div>
            <div class="right-content">
              <b>Mandatory Independent Medical Checkup &amp; Special Women Safeguards</b>
              <p>Right to medical examination by a trained medical officer at the time of arrest and every 48 hours in custody. No woman can be arrested after sunset and before sunrise except in extraordinary circumstances by a woman officer.</p>
            </div>
          </div>

          <div class="right-item">
            <div class="right-num">5</div>
            <div class="right-content">
              <b>100% Free Legal Aid Representation (Art 39A &amp; Section 12 NALSA Act)</b>
              <p>Women, children, SC/ST citizens, undertrial prisoners, and low-income citizens are entitled to 100% free legal defense counsel provided at State expense through the District Legal Services Authority (DLSA).</p>
            </div>
          </div>
        </div>

        <!-- Emergency Helplines -->
        <div class="helplines-grid">
          <div class="helpline-box" style="border-color: #fecdd3; background: #fff1f2;">
            <span class="helpline-name" style="color: #e11d48;">Universal Emergency</span>
            <span class="helpline-num" style="color: #be123c;">112</span>
          </div>
          <div class="helpline-box" style="border-color: #a5f3fc; background: #ecfeff;">
            <span class="helpline-name" style="color: #0891b2;">Cyber Crime / Fraud</span>
            <span class="helpline-num" style="color: #0e7490;">1930</span>
          </div>
          <div class="helpline-box" style="border-color: #ddd6fe; background: #f5f3ff;">
            <span class="helpline-name" style="color: #7c3aed;">Free Legal Aid (NALSA)</span>
            <span class="helpline-num" style="color: #6d28d9;">15100</span>
          </div>
          <div class="helpline-box" style="border-color: #fef08a; background: #fefce8;">
            <span class="helpline-name" style="color: #d97706;">Women Safety Helpline</span>
            <span class="helpline-num" style="color: #b45309;">1091</span>
          </div>
        </div>

        <!-- Official Footer Mark -->
        <div class="doc-footer">
          <div>
            <div class="footer-watermark">✓ Certified LegalConnect Citizen Rights Card</div>
            <div>Portal: <strong>https://legalconnect-501109.web.app</strong></div>
          </div>
          <div class="legal-disclaimer">
            This document is generated by LegalConnect for citizen legal empowerment under Article 39A of the Constitution of India. It serves as an official summary of fundamental constitutional safeguards.
          </div>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 250);
          };
        </script>
      </body>
      </html>
    `);

    try {
      printWindow.document.close();
    } catch {
      // Ignored
    }
  }

  copyRightsSummary(): void {
    const text = `CITIZEN LEGAL RIGHTS DOSSIER (Republic of India)
1. RIGHT TO FREE ADVOCATE: Article 39A & Sec 12 NALSA Act guarantee free legal aid counsel at State expense.
2. 24-HOUR RULE: Every arrested person must be produced before the nearest Judicial Magistrate within 24 hours (Art 22(2) / BNSS 58).
3. D.K. BASU ARREST RULES: Police must wear visible nametags, prepare arrest memo with a witness, and inform family within 8-12 hours.
4. MEDICAL EXAMINATION: Right to independent medical examination upon arrest and every 48 hours in custody.
5. WOMEN ARREST RESTRICTIONS: No woman can be arrested before sunrise or after sunset except under extraordinary magistrate orders.
EMERGENCY NUMBERS: Universal [112], Cyber Fraud [1930], Free Legal Aid [15100], Women Safety [1091].`;

    navigator.clipboard.writeText(text).then(() => {
      this.snackbar.show('Pocket Rights summary copied to clipboard!', 'success');
    }).catch(() => {
      this.snackbar.show('Unable to copy to clipboard', 'error');
    });
  }
}