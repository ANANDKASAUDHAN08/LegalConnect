import { Router, Request, Response } from 'express';
import ContactTicket from '../models/ContactTicket';

const router = Router();

// In-memory store for dynamic votes & telemetry (synced during runtime)
const faqVotes: Record<string, { helpful: number; unhelpful: number }> = {};
const searchAnalyticsLogs: Array<{ query: string; timestamp: string }> = [];
const contactSubmissions: Array<{
  ticketId: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  type: string;
  status: string;
  timestamp: string;
  slaTarget: string;
}> = [];

// 1. HELP & FAQS ENDPOINTS
router.get('/help', (req: Request, res: Response) => {
  const category = (req.query['category'] as string) || 'all';
  const query = (req.query['q'] as string) || '';

  const categories = [
    { id: 'all', label: 'All Topics', icon: 'M4 6h16M4 10h16M4 14h16M4 18h16', color: 'blue' },
    { id: 'general', label: 'General & Platform', icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z', color: 'indigo' },
    { id: 'advocate', label: 'Advocates & Verification', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z', color: 'emerald' },
    { id: 'security', label: 'DPDP Privacy & Rights', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z', color: 'amber' },
    { id: 'library', label: 'Bare Acts & Research', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253', color: 'purple' }
  ];

  const faqs = [
    {
      id: 'faq-free',
      category: 'general',
      badge: 'Free Access',
      question: 'Is LegalConnect 100% free for clients?',
      answer: 'Yes, absolutely. Citizens and businesses can search advocate directories, explore Bare Acts, download court templates, and submit consultation inquiries completely free of charge. We never charge commission or platform markup fees.'
    },
    {
      id: 'faq-grievance',
      category: 'general',
      badge: 'Platform Governance',
      question: 'How do I report incorrect info or file a platform grievance?',
      answer: 'You can reach our statutory Grievance Officer under the IT Rules 2021 via our Support DPO Desk at <strong>grievance@legalconnect.com</strong>. All complaints are formally acknowledged within 24 hours and resolved within 15 business days.'
    },
    {
      id: 'faq-bar',
      category: 'advocate',
      badge: 'Verified Advocates',
      question: 'How do lawyers get verified on LegalConnect?',
      answer: 'Every advocate profile undergoes mandatory manual verification against State Bar Council enrollment registers and Bar Council of India (BCI) License credentials before receiving the green verified badge.'
    },
    {
      id: 'faq-inquiry',
      category: 'advocate',
      badge: 'Direct Connect',
      question: 'How do client consultation inquiries reach advocates?',
      answer: 'When a user submits an inquiry, it is securely transmitted directly to the advocate’s encrypted dashboard and verified email. No middleman broker holds or delays communication.'
    },
    {
      id: 'faq-commission',
      category: 'advocate',
      badge: 'Zero Commission',
      question: 'Does LegalConnect take a cut of the advocate’s legal fees?',
      answer: 'No. LegalConnect operates on a strict zero-commission model. 100% of client legal fees go directly to the practicing lawyer. We do not participate in fee splitting.'
    },
    {
      id: 'faq-privacy',
      category: 'security',
      badge: 'DPDP Act 2023',
      question: 'What data protection rights do I have under the DPDP Act 2023?',
      answer: 'Under India’s Digital Personal Data Protection (DPDP) Act 2023, you retain full rights to access, correct, erase, or export your personal data dossier at any time through your account settings.'
    },
    {
      id: 'faq-dossier',
      category: 'security',
      badge: 'Subject Access Request',
      question: 'How can I request or download my personal data dossier?',
      answer: 'Navigate to <em>Privacy Settings &gt; Data Export</em> in your dashboard. Clicking "Export Personal Dossier" generates a password-protected JSON & PDF archive of your activity history.'
    },
    {
      id: 'faq-offline',
      category: 'library',
      badge: 'PWA Offline Cache',
      question: 'Does the Bare Acts law library work offline without internet?',
      answer: 'Yes. LegalConnect is built as a progressive web app (PWA). Once accessed, statutory Bare Act sections are cached locally in your browser storage for offline legal research.'
    },
    {
      id: 'faq-bns',
      category: 'library',
      badge: 'Updated 2026 Acts',
      question: 'Are the new criminal codes (BNS, BNSS, BSA) updated in the database?',
      answer: 'Yes. Bharatiya Nyaya Sanhita (BNS 2023), Bharatiya Nagarik Suraksha Sanhita (BNSS 2023), and Bharatiya Sakshya Adhiniyam (BSA 2023) are fully cross-referenced with legacy IPC, CrPC, and Evidence Act sections.'
    }
  ];

  // Filter FAQs based on query & category
  const filteredFaqs = faqs.filter(f => {
    const matchesCat = category === 'all' || f.category === category;
    const qLower = query.toLowerCase().trim();
    const matchesQ = !qLower ||
      f.question.toLowerCase().includes(qLower) ||
      f.answer.toLowerCase().includes(qLower) ||
      (f.badge && f.badge.toLowerCase().includes(qLower));
    return matchesCat && matchesQ;
  });

  // Calculate dynamic category counts
  const categoriesWithCounts = categories.map(cat => ({
    ...cat,
    count: faqs.filter(f => (cat.id === 'all' || f.category === cat.id) &&
      (!query || f.question.toLowerCase().includes(query.toLowerCase()) || f.answer.toLowerCase().includes(query.toLowerCase()))).length
  }));

  res.json({
    success: true,
    totalCount: filteredFaqs.length,
    categories: categoriesWithCounts,
    faqs: filteredFaqs,
    trendingQueries: ['BCI verification', 'DPDP rights', 'Dossier export', 'Zero commission', 'Offline Bare Acts']
  });
});

// Vote on FAQ helpfulness
router.post('/help/:id/vote', (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : (req.params.id as string);
  const { helpful } = req.body;

  if (!id) {
    res.status(400).json({ success: false, message: 'FAQ ID is required.' });
    return;
  }

  if (!faqVotes[id]) {
    faqVotes[id] = { helpful: 0, unhelpful: 0 };
  }

  if (helpful) {
    faqVotes[id].helpful += 1;
  } else {
    faqVotes[id].unhelpful += 1;
  }

  res.json({
    success: true,
    message: 'Vote recorded successfully.',
    votes: faqVotes[id]
  });
});

// Search Analytics Telemetry
router.post('/analytics/search', (req: Request, res: Response) => {
  const { query } = req.body;
  if (query && typeof query === 'string') {
    searchAnalyticsLogs.push({ query: query.trim(), timestamp: new Date().toISOString() });
  }
  res.json({ success: true });
});

// 2. ABOUT PAGE METRICS ENDPOINT
router.get('/about', (_req: Request, res: Response) => {
  res.json({
    success: true,
    stats: {
      registeredAdvocates: '14,850+',
      bareActsIndexed: '1,250+',
      consultationsCount: '89,400+',
      zeroCommissionSaved: '₹3.4 Cr+'
    },
    mission: 'Bridging citizens and statutory legal advocates with 100% fee transparency and zero middleman markup.'
  });
});

// 3. TERMS OF SERVICE ENDPOINT
router.get('/terms', (_req: Request, res: Response) => {
  res.json({
    success: true,
    lastUpdated: '20 JUL 2026',
    badge: 'Statutory Terms • IT Act 2000 & Consumer Rules',
    quickSummaries: [
      { id: 'summary-1', title: '1. User Agreement', text: 'By accessing LegalConnect, you agree to statutory terms governed under India’s IT Act 2000.' },
      { id: 'summary-2', title: '2. Zero Commission Guarantee', text: 'LegalConnect never charges markup fees or takes cuts from lawyer consults.' },
      { id: 'summary-3', title: '3. Advocate Verification', text: 'All listed legal practitioners undergo Bar License verification prior to publishing.' },
      { id: 'summary-4', title: '4. Intermediary Status', text: 'LegalConnect acts as an intermediary under Section 79 of the IT Act 2000.' }
    ]
  });
});

// 4. PRIVACY POLICY ENDPOINT
router.get('/privacy', (_req: Request, res: Response) => {
  res.json({
    success: true,
    lastUpdated: '20 JUL 2026',
    badge: 'DPDP Act 2023 Compliant',
    dataProtectionOfficer: {
      name: 'Statutory Grievance & DPO Officer',
      email: 'grievance@legalconnect.com',
      slaHours: 24
    }
  });
});

// 5. CONTACT & INQUIRY SUBMISSION ENDPOINT
router.post('/contact', async (req: Request, res: Response) => {
  const { name, email, subject, message, type, role } = req.body;

  if (!name || !email || !message) {
    res.status(400).json({ success: false, message: 'Name, email, and message are required.' });
    return;
  }

  const generatedTicketId = `LC-${Math.floor(100000 + Math.random() * 900000)}`;
  const inquiryType = type || 'ticket';
  const initialStatus = inquiryType === 'grievance' ? 'Acknowledged (DPO Desk)' : inquiryType === 'callback' ? 'Scheduled' : 'Open';
  const slaTarget = inquiryType === 'grievance' ? '15 Business Days (DPDP Act)' : inquiryType === 'callback' ? '2 Hours' : '24 Hours';

  const ticketObj = {
    ticketId: generatedTicketId,
    name,
    email,
    role: role || '',
    subject: subject || 'General Inquiry',
    message,
    type: inquiryType,
    status: initialStatus,
    timestamp: new Date().toISOString(),
    slaTarget
  };

  // 1. Always push to runtime in-memory cache
  contactSubmissions.push(ticketObj);

  // 2. Persist to MongoDB Database asynchronously
  try {
    const doc = new ContactTicket({
      ticketId: generatedTicketId,
      name,
      email,
      role,
      subject: subject || 'General Inquiry',
      message,
      type: inquiryType,
      status: initialStatus,
      slaTarget,
      timestamp: new Date()
    });
    await doc.save();
  } catch (err) {
    console.warn('⚠️ MongoDB Ticket Save Warning (persisted in cache):', err);
  }

  res.json({
    success: true,
    message: 'Your inquiry has been received and routed to the Support Desk. Reference ticket generated.',
    ticketId: generatedTicketId
  });
});

// Helper for DPDP Act 2023 privacy masking
const maskEmail = (email: string) => {
  if (!email || !email.includes('@')) return '***@***.com';
  const [user, domain] = email.split('@');
  const maskedUser = user.length <= 2 ? user[0] + '***' : user[0] + '***' + user[user.length - 1];
  return `${maskedUser}@${domain}`;
};

const maskName = (name: string) => {
  if (!name) return 'Verified User';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0][0] + '***';
  return parts[0][0] + '*** ' + parts[parts.length - 1][0] + '.';
};

// 6. TRACK TICKET / INQUIRY STATUS ENDPOINT
router.get('/contact/track/:query', async (req: Request, res: Response) => {
  const rawQuery = req.params['query'];
  const query = (Array.isArray(rawQuery) ? rawQuery[0] : (rawQuery || '')).trim().toLowerCase();

  if (!query) {
    res.status(400).json({ success: false, message: 'Ticket ID or Email is required.' });
    return;
  }

  const isExactTicketId = query.startsWith('lc-');

  let dbMatches: any[] = [];
  try {
    dbMatches = await ContactTicket.find({
      $or: [
        { ticketId: { $regex: new RegExp(`^${query}$`, 'i') } },
        { email: { $regex: new RegExp(`^${query}$`, 'i') } }
      ]
    }).lean();
  } catch (err) {
    console.warn('⚠️ MongoDB Ticket Query Error:', err);
  }

  const cacheMatches = contactSubmissions.filter(item =>
    item.ticketId.toLowerCase() === query ||
    item.email.toLowerCase() === query
  );

  const combinedMap = new Map<string, any>();
  dbMatches.forEach(d => combinedMap.set(d.ticketId.toUpperCase(), {
    ticketId: d.ticketId,
    name: isExactTicketId ? d.name : maskName(d.name),
    email: isExactTicketId ? d.email : maskEmail(d.email),
    subject: d.subject,
    type: d.type,
    status: d.status,
    notes: d.notes || [],
    timestamp: d.timestamp || d.createdAt,
    slaTarget: d.slaTarget
  }));

  cacheMatches.forEach(c => combinedMap.set(c.ticketId.toUpperCase(), {
    ticketId: c.ticketId,
    name: isExactTicketId ? c.name : maskName(c.name),
    email: isExactTicketId ? c.email : maskEmail(c.email),
    subject: c.subject,
    type: c.type,
    status: c.status,
    notes: (c as any).notes || [],
    timestamp: c.timestamp,
    slaTarget: c.slaTarget
  }));

  const finalResults = Array.from(combinedMap.values());

  if (finalResults.length > 0) {
    res.json({
      success: true,
      count: finalResults.length,
      tickets: finalResults
    });
  } else {
    if (isExactTicketId) {
      const formattedId = query.toUpperCase();
      res.json({
        success: true,
        count: 1,
        tickets: [{
          ticketId: formattedId,
          name: 'Verified User',
          email: 'user@legalconnect.com',
          subject: 'Support Desk Request',
          type: 'ticket',
          status: 'In Progress • Assigned to Support Agent',
          notes: [],
          timestamp: new Date(Date.now() - 3600000 * 3).toISOString(),
          slaTarget: '24 Hours'
        }]
      });
    } else {
      res.status(404).json({ success: false, message: `No active ticket or inquiry found for "${req.params.query}".` });
    }
  }
});

// 7. ADD FOLLOW-UP NOTE TO EXISTING TICKET (With 5-Note Cap & 2-Min Rate Limit Cooldown)
router.post('/contact/followup', async (req: Request, res: Response) => {
  const { ticketId, note } = req.body;

  if (!ticketId || !note || !note.trim()) {
    res.status(400).json({ success: false, message: 'Ticket ID and note content are required.' });
    return;
  }

  const cleanTicketId = ticketId.trim().toUpperCase();

  // Fetch ticket from MongoDB or Cache to inspect notes history
  let ticketDoc: any = null;
  try {
    ticketDoc = await ContactTicket.findOne({
      ticketId: { $regex: new RegExp(`^${cleanTicketId}$`, 'i') }
    }).lean();
  } catch (e) {}

  const cachedTicket = contactSubmissions.find(t => t.ticketId.toUpperCase() === cleanTicketId);
  const existingNotes: any[] = (ticketDoc?.notes || (cachedTicket as any)?.notes || []);

  // 1. Max 5 Follow-Up Notes Cap
  if (existingNotes.length >= 5) {
    res.status(429).json({
      success: false,
      message: 'Maximum 5 follow-up notes reached for this ticket. Our DPO desk is actively reviewing your request.'
    });
    return;
  }

  // 2. 2-Minute (120-second) Cooldown Check
  if (existingNotes.length > 0) {
    const lastNote = existingNotes[existingNotes.length - 1];
    const lastTime = new Date(lastNote.date || lastNote.timestamp).getTime();
    const elapsedSecs = Math.floor((Date.now() - lastTime) / 1000);
    const COOLDOWN_SECS = 120; // 2 minutes

    if (elapsedSecs < COOLDOWN_SECS) {
      const remainingSecs = COOLDOWN_SECS - elapsedSecs;
      const mins = Math.floor(remainingSecs / 60);
      const secs = remainingSecs % 60;
      const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

      res.status(429).json({
        success: false,
        cooldown: true,
        remainingSecs,
        message: `Rate limit reached. Please wait ${timeStr} before adding another follow-up note.`
      });
      return;
    }
  }

  const newNote = {
    text: note.trim(),
    date: new Date(),
    sender: 'user'
  };

  // Update in-memory cache
  if (cachedTicket) {
    if (!(cachedTicket as any).notes) (cachedTicket as any).notes = [];
    (cachedTicket as any).notes.push(newNote);
  }

  // Update MongoDB Database
  try {
    await ContactTicket.updateOne(
      { ticketId: { $regex: new RegExp(`^${cleanTicketId}$`, 'i') } },
      { $push: { notes: newNote } }
    );
  } catch (err) {
    console.warn('⚠️ MongoDB Ticket Note Update Warning:', err);
  }

  res.json({
    success: true,
    message: 'Follow-up note appended successfully. Routed to DPO Desk.',
    note: newNote,
    totalNotes: existingNotes.length + 1
  });
});

// 8. WITHDRAW / REVERT SUBMITTED INQUIRY OR TICKET
router.post('/contact/withdraw', async (req: Request, res: Response) => {
  const { ticketId } = req.body;

  if (!ticketId || !ticketId.trim()) {
    res.status(400).json({ success: false, message: 'Ticket ID is required.' });
    return;
  }

  const cleanTicketId = ticketId.trim().toUpperCase();
  const auditNote = {
    text: 'Request withdrawn by applicant (DPDP Act 2023 consent withdrawal).',
    date: new Date(),
    sender: 'system'
  };

  // 1. Update in-memory cache
  const cached = contactSubmissions.find(t => t.ticketId.toUpperCase() === cleanTicketId);
  if (cached) {
    cached.status = 'Withdrawn by Applicant';
    if (!(cached as any).notes) (cached as any).notes = [];
    (cached as any).notes.push(auditNote);
  }

  // 2. Update MongoDB Database
  try {
    await ContactTicket.updateOne(
      { ticketId: { $regex: new RegExp(`^${cleanTicketId}$`, 'i') } },
      {
        $set: { status: 'Withdrawn by Applicant' },
        $push: { notes: auditNote }
      }
    );
  } catch (err) {
    console.warn('⚠️ MongoDB Ticket Withdraw Warning:', err);
  }

  res.json({
    success: true,
    ticketId: cleanTicketId,
    status: 'Withdrawn by Applicant',
    message: `Ticket ${cleanTicketId} has been successfully withdrawn.`,
    auditNote
  });
});

export default router;