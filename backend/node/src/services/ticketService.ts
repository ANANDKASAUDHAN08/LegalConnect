import ContactTicket from '../models/ContactTicket';

export async function submitContactTicket(data: {
  name: string;
  email: string;
  phone?: string;
  category?: string;
  subject?: string;
  message: string;
}) {
  const count = await ContactTicket.countDocuments();
  const ticketId = `LC-TKT-${String(count + 101).padStart(4, '0')}`;

  const ticket = new ContactTicket({
    ticketId,
    name: data.name,
    email: data.email,
    phone: data.phone || '',
    category: data.category || 'General',
    subject: data.subject || 'Support Inquiry',
    message: data.message,
    status: 'Pending',
    createdAt: new Date()
  });

  return await ticket.save();
}

export async function withdrawTicket(ticketId: string) {
  const cleanTicketId = ticketId.trim().toUpperCase();
  const auditNote = {
    text: 'Request withdrawn by applicant (DPDP Act 2023 consent withdrawal).',
    date: new Date(),
    sender: 'system'
  };

  await ContactTicket.updateOne(
    { ticketId: { $regex: new RegExp(`^${cleanTicketId}$`, 'i') } },
    {
      $set: { status: 'Withdrawn by Applicant' },
      $push: { notes: auditNote }
    }
  );

  return { ticketId: cleanTicketId, status: 'Withdrawn by Applicant', auditNote };
}

export async function getAllTickets(statusFilter?: string) {
  const filter: any = {};
  if (statusFilter) filter.status = statusFilter;
  return await ContactTicket.find(filter).sort({ createdAt: -1 }).lean();
}

export async function updateTicketStatus(id: string, status: string, notesText?: string) {
  const updateData: any = { status, updatedAt: new Date() };
  if (notesText) {
    const note = { text: notesText, date: new Date(), sender: 'admin' };
    return await ContactTicket.findByIdAndUpdate(
      id,
      { $set: updateData, $push: { notes: note } },
      { returnDocument: 'after' }
    );
  }
  return await ContactTicket.findByIdAndUpdate(id, { $set: updateData }, { returnDocument: 'after' });
}