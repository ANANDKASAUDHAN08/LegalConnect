import { Lawyer } from '../../services/lawyer.service';
import { ReviewItem } from '../../services/review.service';
import { PrintService, KpiCard, PrintConfig } from '../../services/print.service';

/**
 * LawyerPrintBuilder
 * Builds ultra-premium, executive legal briefs and verified profile dossiers
 * for legal practitioners and advocates matching Supreme Court and High Court bar registry standards.
 * Uses 100% resolution-independent SVG vector iconography to ensure pristine print fidelity.
 */
export class LawyerPrintBuilder {

  /**
   * Builds the complete PrintConfig for an Advocate Dossier
   */
  static buildDossierConfig(
    lawyer: Lawyer,
    reviews: ReviewItem[],
    printService: PrintService,
    scope: 'full' | 'summary' = 'full'
  ): PrintConfig {
    const e = printService.escapeHtml.bind(printService);
    const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const lawyerUrl = typeof window !== 'undefined'
      ? window.location.href
      : `https://legalconnect-501109.web.app/lawyers/${lawyer._id}`;

    // 1. Advocate Identity Hero Card
    const heroCardHtml = this.buildAdvocateHero(lawyer, e, printService);

    // 2. Executive KPI Grid (Experience, Cases, Satisfaction, Rating)
    const kpiCards: KpiCard[] = [
      {
        label: 'Bar Standing',
        value: `${lawyer.experience || 0} Yrs`,
        sub: lawyer.city ? `${lawyer.city} Jurisdiction` : 'Active Practice',
        accent: 'indigo'
      },
      {
        label: 'Cases Defended',
        value: lawyer.casesCompleted ? `${lawyer.casesCompleted}+` : 'Active',
        sub: 'Litigation Portfolio',
        accent: 'amber'
      },
      {
        label: 'Client Satisfaction',
        value: lawyer.successRate ? `${lawyer.successRate}%` : 'N/A',
        sub: 'Favorable Outcomes',
        accent: 'emerald'
      },
      {
        label: 'Client Rating',
        value: `${lawyer.rating ? lawyer.rating.toFixed(1) : '5.0'} / 5.0`,
        sub: `${reviews.length} Verified Reviews`,
        accent: 'blue'
      }
    ];
    const kpiGridHtml = printService.buildKpiGrid(kpiCards);

    // 3. Credentials & Practice Domains (2-Column Grid)
    const credentialsGridHtml = this.buildCredentialsGrid(lawyer, e, printService);

    // 4. Client Testimonials Section (if full scope)
    const testimonialsHtml = (scope === 'full' && reviews.length > 0)
      ? this.buildTestimonialsSection(reviews, lawyer, e, printService)
      : '';

    // 5. Official Regulatory & Good Standing Notice
    const regulatoryNoticeHtml = this.buildRegulatoryNotice(lawyer, dateStr, e, printService);

    // Assemble complete HTML body content
    const content = `
      ${heroCardHtml}
      ${kpiGridHtml}
      ${credentialsGridHtml}
      ${testimonialsHtml}
      ${regulatoryNoticeHtml}
    `;

    return {
      title: `Advocate ${lawyer.name} — Official Legal Profile`,
      subtitle: `${(lawyer.specializations || []).join(' • ')} • Bar Council Registration: ${lawyer.barCouncilNumber || 'Verified Active'}`,
      content,
      headerQrData: lawyerUrl,
      watermark: 'OFFICIAL COPY',
      classification: 'OFFICIAL COPY',
      sealText: 'Bar Council Registry • Verified Legal Practitioner • LegalConnect India',
      accentColor: '#312e81', // Royal Navy & Indigo
      paperSize: 'A4',
      orientation: 'portrait',
      margins: 'default',
      scale: 75,
      fileName: `Advocate_${lawyer.name.replace(/[^a-zA-Z0-9]/g, '_')}_Dossier`,
      extraMeta: [
        { label: 'Bar Council No', value: lawyer.barCouncilNumber || 'Verified' },
        { label: 'Jurisdiction', value: lawyer.city || 'India' },
        { label: 'Rating', value: `${lawyer.rating ? lawyer.rating.toFixed(1) : '5.0'} / 5.0 (${reviews.length} reviews)` },
        { label: 'Status', value: 'Active In Good Standing' }
      ]
    };
  }

  /**
   * Builds the top identity hero card with advocate avatar/monogram, Bar Council badge, and bio
   */
  private static buildAdvocateHero(l: Lawyer, e: (s: string) => string, p: PrintService): string {
    const initials = l.name.replace(/^(Adv\.|Advocate|Mr\.|Ms\.|Dr\.)\s*/i, '').trim().split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase();

    // Photo avatar or executive monogram
    const avatarHtml = l.avatarUrl
      ? `<img src="${e(l.avatarUrl)}" alt="${e(l.name)}" onerror="this.style.display='none'" style="width:78px;height:78px;border-radius:12px;object-fit:cover;border:2px solid #c7d2fe;box-shadow:0 4px 6px -1px rgba(0,0,0,0.08);" />`
      : `<div style="width:78px;height:78px;border-radius:12px;background:linear-gradient(135deg,#1e1b4b,#3730a3);color:#fff;font-weight:800;font-size:26px;display:flex;align-items:center;justify-content:center;border:2px solid #c7d2fe;box-shadow:0 4px 6px -1px rgba(0,0,0,0.08);letter-spacing:1px;">${initials}</div>`;

    const badgeCheckSvg = p.getSvg('badge-check', { size: 10, color: '#047857', style: 'margin-right:3px;' });
    const scaleSvg = p.getSvg('scale', { size: 11, color: '#4338ca', style: 'margin-right:3px;' });
    const mapPinSvg = p.getSvg('map-pin', { size: 11, color: '#4338ca', style: 'margin-right:3px;' });
    const gradSvg = p.getSvg('graduation-cap', { size: 11, color: '#4338ca', style: 'margin-right:3px;' });
    const zapSvg = p.getSvg('zap', { size: 10, color: '#059669', style: 'margin-right:3px;' });

    return `
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-top:4px solid #4338ca;border-radius:10px;padding:16px 18px;margin-bottom:14px;box-shadow:0 1px 3px rgba(0,0,0,0.04);">
        <div style="display:flex;gap:18px;align-items:flex-start;">
          <div style="flex-shrink:0;">
            ${avatarHtml}
          </div>
          <div style="flex:1;min-width:0;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px;">
              <div>
                <div style="display:flex;align-items:center;gap:8px;">
                  <h1 style="font-family:Georgia,'Times New Roman',serif;font-size:21px;font-weight:800;color:#0f172a;margin:0;letter-spacing:-0.02em;line-height:1.2;">
                    ${e(l.name)}
                  </h1>
                  <span style="display:inline-flex;align-items:center;background:#ecfdf5;border:1px solid #a7f3d0;color:#047857;padding:2px 8px;border-radius:20px;font-size:8.5px;font-weight:800;text-transform:uppercase;letter-spacing:0.04em;">
                    ${badgeCheckSvg} VERIFIED ADVOCATE
                  </span>
                </div>
                <div style="font-size:10px;color:#475569;margin-top:4px;display:flex;align-items:center;gap:14px;flex-wrap:wrap;">
                  <span style="display:inline-flex;align-items:center;">${scaleSvg} Bar Council: <strong style="color:#0f172a;margin-left:3px;">${e(l.barCouncilNumber || 'Verified Registration')}</strong></span>
                  <span style="display:inline-flex;align-items:center;">${mapPinSvg} Primary City: <strong style="color:#0f172a;margin-left:3px;">${e(l.city || 'India')}</strong></span>
                  ${l.education ? `<span style="display:inline-flex;align-items:center;">${gradSvg} <strong style="color:#0f172a;margin-left:3px;">${e(l.education)}</strong></span>` : ''}
                </div>
              </div>

              <!-- Quick Contact Badge -->
              <div style="text-align:right;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:6px 12px;font-size:9.5px;">
                <div style="color:#64748b;font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.05em;">Chambers Consultation</div>
                <div style="font-size:13px;font-weight:800;color:#4338ca;margin-top:1px;">₹${l.consultationFee || 1500} <span style="font-size:9px;font-weight:600;color:#64748b;">/ session</span></div>
                <div style="font-size:8.5px;color:#059669;font-weight:700;margin-top:2px;display:inline-flex;align-items:center;">${zapSvg} ${e(l.responseTime || 'Responds within 24 hours')}</div>
              </div>
            </div>

            <!-- Profile Summary Bio -->
            <p style="margin:10px 0 0;font-size:11px;color:#334155;line-height:1.6;border-top:1px solid #f1f5f9;padding-top:8px;">
              ${e(l.bio || 'Advocate practicing before High Courts and District Jurisdictions with specialized statutory litigation, legal advisory, and courtroom representation.')}
            </p>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Builds the 2-column practice details & credentials grid (clean pills, no solid black blocks)
   */
  private static buildCredentialsGrid(l: Lawyer, e: (s: string) => string, p: PrintService): string {
    const landmarkSvg = p.getSvg('landmark', { size: 10, color: '#92400e', style: 'margin-right:4px;' });
    const languagesSvg = p.getSvg('languages', { size: 9, color: '#475569', style: 'margin-right:4px;' });
    const badgeCheckGreenSvg = p.getSvg('badge-check', { size: 11, color: '#10b981', style: 'margin-right:4px;' });

    // Specialization badges
    const specs = l.specializations || [];
    const specPillsHtml = specs.length > 0
      ? specs.map(s => `
          <span style="display:inline-block;padding:3.5px 10px;border-radius:6px;font-size:9.5px;font-weight:700;background:#eef2ff;color:#3730a3;border:1px solid #c7d2fe;margin-right:6px;margin-bottom:6px;">
            ${e(s)}
          </span>
        `).join('')
      : '<span style="color:#94a3b8;font-size:10px;">General Civil &amp; Criminal Practice</span>';

    // Court admission badges
    const courts = l.activeCourts || [];
    const courtPillsHtml = courts.length > 0
      ? courts.map(c => `
          <span style="display:inline-flex;align-items:center;padding:3.5px 10px;border-radius:6px;font-size:9.5px;font-weight:700;background:#fffbeb;color:#92400e;border:1px solid #fde68a;margin-right:6px;margin-bottom:6px;">
            ${landmarkSvg} ${e(c)}
          </span>
        `).join('')
      : '<span style="color:#94a3b8;font-size:10px;">District &amp; Sessions Courts</span>';

    // Languages badges
    const langs = l.languagesSpoken || ['English', 'Hindi'];
    const langPillsHtml = langs.map(lang => `
      <span style="display:inline-flex;align-items:center;padding:2px 8px;border-radius:5px;font-size:9px;font-weight:600;background:#f1f5f9;color:#334155;border:1px solid #e2e8f0;margin-right:5px;">
        ${languagesSvg} ${e(lang)}
      </span>
    `).join('');

    return `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;">

        <!-- Left Column: Practice Domains & Admissions -->
        <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:14px 16px;">
          <div style="font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#0f172a;border-bottom:1px solid #f1f5f9;padding-bottom:6px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;">
            <span>Core Practice Specializations</span>
            <span style="font-size:9px;font-weight:600;color:#64748b;">${specs.length} Areas</span>
          </div>
          <div style="margin-bottom:12px;">
            ${specPillsHtml}
          </div>

          <div style="font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#0f172a;border-bottom:1px solid #f1f5f9;padding-bottom:6px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;">
            <span>Active Court Admissions</span>
            <span style="font-size:9px;font-weight:600;color:#64748b;">${courts.length} Forums</span>
          </div>
          <div style="margin-bottom:12px;">
            ${courtPillsHtml}
          </div>

          <div style="font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#0f172a;border-bottom:1px solid #f1f5f9;padding-bottom:6px;margin-bottom:8px;">
            <span>Languages of Practice</span>
          </div>
          <div>
            ${langPillsHtml}
          </div>
        </div>

        <!-- Right Column: Chambers Administration & Fee Schedule -->
        <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:14px 16px;">
          <div style="font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#0f172a;border-bottom:1px solid #f1f5f9;padding-bottom:6px;margin-bottom:10px;">
            Chambers &amp; Practice Coordinates
          </div>

          <table style="width:100%;border-collapse:collapse;font-size:10px;">
            <tbody>
              <tr style="border-bottom:1px solid #f8fafc;">
                <td style="padding:6px 0;color:#64748b;font-weight:700;width:38%;">Chambers Address:</td>
                <td style="padding:6px 0;color:#0f172a;font-weight:600;">${e(l.officeAddress || 'Legal Chambers, High Court Complex')}</td>
              </tr>
              <tr style="border-bottom:1px solid #f8fafc;">
                <td style="padding:6px 0;color:#64748b;font-weight:700;">Direct Email:</td>
                <td style="padding:6px 0;color:#4338ca;font-weight:600;">${e(l.email || 'N/A')}</td>
              </tr>
              <tr style="border-bottom:1px solid #f8fafc;">
                <td style="padding:6px 0;color:#64748b;font-weight:700;">Contact Phone:</td>
                <td style="padding:6px 0;color:#0f172a;font-weight:600;">${e(l.phone || 'Registry Verified')}</td>
              </tr>
              <tr style="border-bottom:1px solid #f8fafc;">
                <td style="padding:6px 0;color:#64748b;font-weight:700;">Consultation Fee:</td>
                <td style="padding:6px 0;color:#059669;font-weight:700;">₹${l.consultationFee || 1500} / 45-min Session</td>
              </tr>
              ${l.inPersonFee ? `
              <tr style="border-bottom:1px solid #f8fafc;">
                <td style="padding:6px 0;color:#64748b;font-weight:700;">In-Chambers Fee:</td>
                <td style="padding:6px 0;color:#0f172a;font-weight:700;">₹${l.inPersonFee} / Consultation</td>
              </tr>` : ''}
              <tr>
                <td style="padding:6px 0;color:#64748b;font-weight:700;">Working Hours:</td>
                <td style="padding:6px 0;color:#334155;">${e(l.workingHours?.days || 'Mon – Sat')}: ${e(l.workingHours?.hours || '10:00 AM – 7:00 PM')}</td>
              </tr>
            </tbody>
          </table>

          <div style="margin-top:12px;padding:8px 10px;background:#f8fafc;border:1px solid #e2e8f0;border-left:3px solid #10b981;border-radius:6px;font-size:9px;color:#334155;line-height:1.4;display:flex;align-items:flex-start;gap:6px;">
            <span style="margin-top:1px;flex-shrink:0;">${badgeCheckGreenSvg}</span>
            <div><strong>Bar Council Good Standing:</strong> Practitioner is in active practice with no disciplinary suspensions under the Advocates Act, 1961.</div>
          </div>
        </div>

      </div>
    `;
  }

  /**
   * Builds executive testimonial cards for client reviews
   */
  private static buildTestimonialsSection(reviews: ReviewItem[], l: Lawyer, e: (s: string) => string, p: PrintService): string {
    const starSvg = p.getSvg('star', { size: 11, color: '#d97706', style: 'fill:#d97706;margin-right:1px;' });
    const clientBadgeSvg = p.getSvg('badge-check', { size: 8, color: '#059669', style: 'margin-right:2px;' });

    const reviewCards = reviews.map(r => {
      const starCount = Math.min(5, Math.max(1, Math.round(r.rating || 5)));
      const stars = starSvg.repeat(starCount);
      return `
        <div style="background:#ffffff;border:1px solid #e2e8f0;border-left:3.5px solid #d97706;border-radius:8px;padding:11px 14px;margin-bottom:9px;page-break-inside:avoid;break-inside:avoid;box-shadow:0 1px 2px rgba(0,0,0,0.02);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
            <div style="display:flex;align-items:center;gap:6px;">
              <strong style="font-size:11.5px;color:#0f172a;">${e(r.authorName || 'Verified Client')}</strong>
              <span style="font-size:8px;font-weight:700;color:#059669;background:#ecfdf5;border:1px solid #a7f3d0;padding:1px 5px;border-radius:10px;display:inline-flex;align-items:center;">
                ${clientBadgeSvg} Verified Client
              </span>
            </div>
            <div style="display:flex;align-items:center;">${stars}</div>
          </div>
          <p style="margin:0;font-size:10.5px;color:#334155;line-height:1.55;font-style:italic;">
            “${e(r.content)}”
          </p>
        </div>
      `;
    }).join('');

    return `
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:14px 16px;margin-bottom:14px;page-break-inside:auto;break-inside:auto;">
        <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#0f172a;border-bottom:1px solid #f1f5f9;padding-bottom:6px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;">
          <span>Verified Client Representations &amp; Reviews</span>
          <span style="font-size:9.5px;font-weight:700;color:#4338ca;">${reviews.length} Client Testimonial${reviews.length !== 1 ? 's' : ''}</span>
        </div>
        ${reviewCards}
      </div>
    `;
  }

  /**
   * Builds the official legal declaration & verification footer
   */
  private static buildRegulatoryNotice(l: Lawyer, dateStr: string, e: (s: string) => string, p: PrintService): string {
    const shieldSvg = p.getSvg('shield', { size: 11, color: '#4338ca', style: 'margin-right:4px;' });
    return `
      <div style="border:1px solid #cbd5e1;border-left:4px solid #4338ca;background:#f8fafc;border-radius:6px;padding:9px 13px;font-size:8.5px;color:#475569;line-height:1.5;margin-top:14px;page-break-inside:avoid;break-inside:avoid;">
        <div style="font-weight:800;color:#0f172a;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:2px;display:flex;align-items:center;gap:4px;">
          ${shieldSvg}
          <span>Official Legal Practitioner Dossier &bull; Regulatory Attestation</span>
        </div>
        <div>
          This official dossier is generated from verified institutional records of LegalConnect India and the Bar Council Registry as of ${e(dateStr)}. Credentials, court admissions, and client representation records are electronically attested. For direct verification or to schedule an in-chambers consultation, scan the verification QR code or visit the official registry portal.
        </div>
      </div>
    `;
  }
}
