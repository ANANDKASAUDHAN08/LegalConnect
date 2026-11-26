import { PracticeArea } from '../../services/practice-areas.service';
import { PrintService, KpiCard, PrintConfig } from '../../services/print.service';

/**
 * SpecializationPrintBuilder
 * Dedicated builder that generates professional, high-resolution official statutory briefs.
 * Extracted from component controller to preserve single-responsibility and lean architecture.
 */
export class SpecializationPrintBuilder {
  static printAreaBrief(target: PracticeArea, printService: PrintService, event?: Event): void {
    if (event) event.stopPropagation();

    const e = printService.escapeHtml.bind(printService);

    const subjectStrip = printService.buildSubjectStrip({
      name: `${target.name} Practice Area Taxonomy`,
      subtitle: `${target.category} Discipline · Statutory & Litigation Framework · Republic of India`,
      badge: target.popular ? 'POPULAR SPECIALIZATION' : 'VERIFIED TAXONOMY'
    });

    const kpiCards: KpiCard[] = [
      {
        label: 'Verified Counsel',
        value: String(target.advocateCount || 0),
        sub: 'Active Bar Members',
        accent: 'blue'
      },
      {
        label: 'Average Experience',
        value: `${target.avgExperience ? target.avgExperience + ' yrs' : '10+ yrs'}`,
        sub: 'Litigation Practice',
        accent: 'emerald'
      },
      {
        label: 'Client Satisfaction',
        value: `${target.avgRating ? target.avgRating + ' / 5' : '4.8 / 5'}`,
        sub: 'Verified Reviews',
        accent: 'amber'
      },
      {
        label: 'Consultation Fee',
        value: target.feeRange?.median ? `₹${target.feeRange.median}` : '₹2,500',
        sub: target.feeRange ? `Range: ₹${target.feeRange.min} – ₹${target.feeRange.max}` : 'Per Session',
        accent: 'purple'
      }
    ];

    const kpiGrid = printService.buildKpiGrid(kpiCards);

    // Overview section
    let contentHtml = printService.buildSection(
      'Practice Overview &amp; Statutory Scope',
      `<p style="font-size:12px;color:#334155;line-height:1.7;margin-bottom:8px;">${e(target.description)}</p>
       ${target.description_hi ? `<p style="font-size:11px;color:#64748b;font-style:italic;line-height:1.6;">${e(target.description_hi)}</p>` : ''}
       ${target.tagline ? `<div style="margin-top:10px;padding:8px 12px;background:#f8fafc;border-left:3px solid #2563eb;font-weight:600;font-size:11px;color:#1e293b;">${e(target.tagline)}</div>` : ''}`
    );

    // Sub-disciplines table
    if (target.subfields?.length) {
      const subfieldRows = target.subfields.map((sf, idx) => ({
        sno: idx + 1,
        title: sf,
        scope: 'Statutory Practice &amp; Litigation'
      }));
      contentHtml += printService.buildTable({
        title: 'Core Sub-Specializations',
        badge: `${target.subfields.length} Subfields`,
        columns: [
          { key: 'sno', label: '#', align: 'center' },
          { key: 'title', label: 'Sub-field Domain', bold: true },
          { key: 'scope', label: 'Practice Domain' }
        ],
        rows: subfieldRows
      });
    }

    // Bare Acts Table
    if (target.relevantActs?.length) {
      const actRows = target.relevantActs.map((act, idx) => ({
        sno: idx + 1,
        actName: act,
        jurisdiction: 'Union of India / State Legislature'
      }));
      contentHtml += printService.buildTable({
        title: 'Governing Statutory Frameworks &amp; Bare Acts',
        badge: `${target.relevantActs.length} Acts`,
        columns: [
          { key: 'sno', label: '#', align: 'center' },
          { key: 'actName', label: 'Enacted Legislation / Bare Act', bold: true },
          { key: 'jurisdiction', label: 'Jurisdiction' }
        ],
        rows: actRows
      });
    }

    // Typical Courts & Forums
    if (target.typicalForums?.length) {
      const forumRows = target.typicalForums.map((f, idx) => ({
        sno: idx + 1,
        forum: f,
        tier: f.toLowerCase().includes('supreme') ? 'Apex Court' : f.toLowerCase().includes('high') ? 'Constitutional Court' : 'Trial &amp; Statutory Tribunal'
      }));
      contentHtml += printService.buildTable({
        title: 'Applicable Adjudicatory Forums &amp; Tribunals',
        columns: [
          { key: 'sno', label: '#', align: 'center' },
          { key: 'forum', label: 'Judicial / Quasi-Judicial Forum', bold: true },
          { key: 'tier', label: 'Forum Tier' }
        ],
        rows: forumRows
      });
    }

    // Procedural Forum Journey Ladder (if available)
    if (target.forumJourney?.length) {
      const journeyRows = target.forumJourney.map(j => ({
        stage: j.stage,
        forum: j.forum,
        note: j.note
      }));
      contentHtml += printService.buildTable({
        title: 'Litigation &amp; Forum Escalation Journey',
        columns: [
          { key: 'stage', label: 'Procedural Stage', bold: true },
          { key: 'forum', label: 'Appropriate Forum' },
          { key: 'note', label: 'Procedural Notes' }
        ],
        rows: journeyRows
      });
    }

    // Document Checklist
    if (target.documentsChecklist?.length) {
      const checklistHtml = target.documentsChecklist
        .map(doc => `<div style="display:flex;align-items:center;gap:8px;font-size:11px;margin-bottom:6px;color:#334155;">
          <span style="display:inline-block;width:12px;height:12px;border:1.5px solid #2563eb;border-radius:3px;"></span>
          <span>${e(doc)}</span>
        </div>`)
        .join('');
      contentHtml += printService.buildSection('Client Document Preparation Checklist', checklistHtml);
    }

    const fullContent = `
      <div style="margin-bottom:14px;">
        ${kpiGrid}
      </div>
      ${contentHtml}
    `;

    printService.print({
      title: `${target.name} Practice Area Brief`,
      subtitle: target.tagline || `Statutory analysis, court forums, and advocate briefing for ${target.name}.`,
      classification: 'OFFICIAL PRACTICE BRIEF',
      accentColor: '#2563eb',
      subjectStrip,
      content: fullContent
    });
  }

  /**
   * Generates a comprehensive, court-grade print configuration for the full or filtered
   * Practice Areas catalog with executive KPIs, master directory index table, and categorized breakdowns.
   */
  static buildCatalogPrintConfig(
    areas: PracticeArea[],
    printService: PrintService,
    scopeLabel: string = 'Complete Catalog',
    isHindi: boolean = false
  ): PrintConfig {
    const e = printService.escapeHtml.bind(printService);
    const totalAdvocates = areas.reduce((acc, a) => acc + (a.advocateCount || 0), 0);
    const allActs = new Set(areas.flatMap(a => a.relevantActs || []));
    const categories = new Set(areas.map(a => a.category));

    const subjectStrip = printService.buildSubjectStrip({
      name: isHindi ? 'भारतीय कानूनी अभ्यास क्षेत्र व वैधानिक एटलस' : 'National Practice Areas & Statutory Atlas',
      subtitle: `Republic of India · ${areas.length} Verified Disciplines · Bar Council Legal Taxonomy Registry`,
      badge: 'OFFICIAL TAXONOMY GAZETTE'
    });

    const kpiCards: KpiCard[] = [
      {
        label: isHindi ? 'अभ्यास क्षेत्र' : 'Disciplines',
        value: String(areas.length),
        sub: scopeLabel,
        accent: 'blue'
      },
      {
        label: isHindi ? 'सत्यापित अधिवक्ता' : 'Verified Counsel',
        value: `${totalAdvocates}+`,
        sub: 'Active Bar Members',
        accent: 'indigo'
      },
      {
        label: isHindi ? 'वैधानिक संहिताएँ' : 'Statutory Codes',
        value: String(allActs.size),
        sub: 'Bare Acts Mapped',
        accent: 'emerald'
      },
      {
        label: isHindi ? 'श्रेणियाँ' : 'Legal Domains',
        value: String(categories.size),
        sub: 'Substantive Categories',
        accent: 'purple'
      }
    ];

    const kpiGrid = printService.buildKpiGrid(kpiCards);

    // Master Table Index
    const tableRows = areas.map((a, idx) => {
      const actsList = (a.relevantActs || []).slice(0, 3).join(', ') + ((a.relevantActs?.length || 0) > 3 ? ` +${a.relevantActs.length - 3} more` : '');
      const subfieldsList = (a.subfields || []).slice(0, 3).join(' • ');
      const forumsList = (a.typicalForums || []).slice(0, 2).join('; ');
      const fee = a.feeRange?.median ? `₹${a.feeRange.median}` : '₹2,500';

      return {
        sno: (idx + 1).toString(),
        discipline: `<strong>${e(a.name)}</strong>${a.name_hi ? `<div style="font-size:8.5px;color:#64748b;">${e(a.name_hi)}</div>` : ''}<div style="font-size:8px;color:#475569;margin-top:2px;">${e(subfieldsList)}</div>`,
        category: `<span style="font-weight:700;color:#1e40af;font-size:9px;">${e(a.category)}</span>`,
        statutoryActs: `<div style="font-size:8.5px;font-family:monospace;color:#1e293b;">${e(actsList || 'General Statutes')}</div>`,
        forums: `<div style="font-size:8.5px;color:#334155;">${e(forumsList || 'District & High Courts')}</div>`,
        counsel: `<div style="font-weight:700;color:#0f172a;font-size:9.5px;">${a.advocateCount || 0} Counsel</div><div style="font-size:8px;color:#64748b;">Exp: ${a.avgExperience || 10}+ yrs · ${fee}</div>`
      };
    });

    const tableHtml = printService.buildTable({
      title: isHindi ? 'कानूनी अभ्यास क्षेत्र मास्टर निर्देशिका' : 'Statutory Practice Areas Master Directory',
      badge: `${areas.length} Disciplines`,
      columns: [
        { key: 'sno', label: '#', align: 'center' },
        { key: 'discipline', label: 'Practice Area & Subfields' },
        { key: 'category', label: 'Category Domain' },
        { key: 'statutoryActs', label: 'Governing Bare Acts' },
        { key: 'forums', label: 'Applicable Forums' },
        { key: 'counsel', label: 'Counsel & Experience' }
      ],
      rows: tableRows
    });

    // Detailed Breakdown by Category
    const byCategory: Record<string, PracticeArea[]> = {};
    for (const a of areas) {
      if (!byCategory[a.category]) byCategory[a.category] = [];
      byCategory[a.category].push(a);
    }

    let categorySectionsHtml = '';
    for (const [catName, catAreas] of Object.entries(byCategory)) {
      const cardsHtml = catAreas.map(a => {
        const acts = (a.relevantActs || []).map(act => `<span style="display:inline-block;padding:1px 5px;background:#eff6ff;color:#1e40af;border-radius:3px;font-size:8px;font-weight:600;margin:1px 2px 1px 0;">${e(act)}</span>`).join('');
        const forums = (a.typicalForums || []).map(f => `<span style="display:inline-block;padding:1px 5px;background:#f8fafc;color:#475569;border-radius:3px;font-size:8px;margin:1px 2px 1px 0;">${e(f)}</span>`).join('');
        const subfields = (a.subfields || []).slice(0, 5).join(', ');

        return `
          <div style="border:1px solid #e2e8f0;border-left:3.5px solid #2563eb;border-radius:6px;padding:8px 10px;margin-bottom:8px;page-break-inside:avoid;break-inside:avoid;background:#fff;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;">
              <div>
                <div style="font-size:11px;font-weight:700;color:#0f172a;">${e(a.name)}${a.name_hi ? ` <span style="font-weight:400;color:#64748b;font-size:9.5px;">(${e(a.name_hi)})</span>` : ''}</div>
                ${a.tagline ? `<div style="font-size:8.5px;color:#2563eb;font-weight:600;margin-top:1px;">${e(a.tagline)}</div>` : ''}
              </div>
              <div style="text-align:right;flex-shrink:0;">
                <span style="font-size:8px;font-weight:800;padding:2px 6px;border-radius:4px;background:#eff6ff;color:#1e40af;">${a.advocateCount || 0} Advocates</span>
                <div style="font-size:8px;color:#64748b;margin-top:2px;">Avg ${a.avgRating ? a.avgRating + '★' : '4.8★'} · ${a.avgExperience || 10}+ yrs</div>
              </div>
            </div>
            <div style="font-size:9px;color:#334155;line-height:1.45;margin:4px 0 6px;">${e(a.description)}</div>
            ${subfields ? `<div style="font-size:8.5px;color:#475569;margin-bottom:4px;"><strong>Subfields:</strong> ${e(subfields)}</div>` : ''}
            ${acts ? `<div style="margin-top:4px;">${acts}</div>` : ''}
            ${forums ? `<div style="margin-top:2px;">${forums}</div>` : ''}
          </div>
        `;
      }).join('');

      categorySectionsHtml += printService.buildSection(
        `${catName} Framework`,
        cardsHtml,
        `${catAreas.length} Disciplines`
      );
    }

    const fullContent = `
      <div style="margin-bottom:14px;">
        ${subjectStrip}
        ${kpiGrid}
        ${tableHtml}
        <div style="margin-top:16px;">
          ${categorySectionsHtml}
        </div>
      </div>
    `;

    return {
      title: isHindi ? 'कानूनी अभ्यास क्षेत्र व वैधानिक एटलस' : 'Legal Practice Areas & Statutory Atlas',
      subtitle: `Directory of ${areas.length} Practice Areas & Governing Bare Acts · ${scopeLabel}`,
      classification: 'OFFICIAL TAXONOMY GAZETTE',
      accentColor: '#2563eb',
      watermark: 'OFFICIAL COPY',
      content: fullContent,
      extraMeta: [
        { label: 'Scope', value: scopeLabel },
        { label: 'Practice Areas', value: `${areas.length} Disciplines` },
        { label: 'Active Counsel', value: `${totalAdvocates}+ Verified Advocates` },
        { label: 'Bare Acts Mapped', value: `${allActs.size} Central & State Acts` },
        { label: 'Timestamp', value: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) }
      ]
    };
  }
}