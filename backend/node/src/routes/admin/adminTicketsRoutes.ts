import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { AppError } from '../../utils/AppError';
import { getAllTickets, updateTicketStatus } from '../../services/ticketService';

const router = Router();

// GET all contact/support tickets (supports multiple gateway mount paths)
router.get(['/contact/all-tickets', '/all-tickets'], asyncHandler(async (req: Request, res: Response) => {
  const { status } = req.query;
  const tickets = await getAllTickets(status as string);
  const newCount = tickets.filter(t => (t as any).status === 'New' || (t as any).status === 'Pending').length;

  res.json({
    success: true,
    count: tickets.length,
    total: tickets.length,
    newCount,
    tickets,
    data: tickets
  });
}));

// PUT update ticket status & audit notes
router.put(['/contact/tickets/:id', '/tickets/:id'], asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { status, notes } = req.body;

  const ticket = await updateTicketStatus(id, status, notes);
  if (!ticket) {
    throw AppError.notFound('Ticket not found.');
  }

  res.json({ success: true, message: 'Ticket updated successfully.', data: ticket });
}));

export default router;