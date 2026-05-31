using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using CoreApi.Data;
using CoreApi.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CoreApi.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ConsultationController : ControllerBase
    {
        private readonly AppDbContext _context;

        public ConsultationController(AppDbContext context)
        {
            _context = context;
        }

        [HttpPost]
        public async Task<IActionResult> CreateConsultation([FromBody] CreateConsultationDto request)
        {
            int? clientId = null;
            var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!string.IsNullOrEmpty(userIdClaim) && int.TryParse(userIdClaim, out int parsedId))
            {
                clientId = parsedId;
            }

            var lawyerUser = await _context.Users.FirstOrDefaultAsync(u => u.Email == request.LawyerEmail);
            if (lawyerUser == null || !lawyerUser.Role.Equals("Lawyer", StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest("Invalid lawyer selected.");
            }

            var consultation = new Consultation
            {
                ClientId = clientId,
                ClientName = request.ClientName,
                ClientEmail = request.ClientEmail,
                LawyerId = lawyerUser.Id,
                Message = request.Message,
                Status = "Pending",
                CreatedAt = DateTime.UtcNow
            };

            _context.Consultations.Add(consultation);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Inquiry sent successfully!", consultationId = consultation.Id });
        }

        [Authorize(Roles = "Lawyer")]
        [HttpGet("received")]
        public async Task<IActionResult> GetReceivedConsultations([FromQuery] string? status, [FromQuery] int page = 1, [FromQuery] int pageSize = 10)
        {
            var lawyerId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var query = _context.Consultations
                .Include(c => c.Client)
                .Where(c => c.LawyerId == lawyerId);

            if (!string.IsNullOrEmpty(status))
            {
                query = query.Where(c => c.Status == status);
            }

            var totalCount = await query.CountAsync();
            var totalPages = (int)Math.Ceiling((double)totalCount / pageSize);

            var consultations = await query
                .OrderByDescending(c => c.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(c => new {
                    c.Id,
                    c.ClientId,
                    ClientName = c.Client != null ? c.Client.FullName : c.ClientName,
                    ClientEmail = c.Client != null ? c.Client.Email : c.ClientEmail,
                    c.LawyerId,
                    c.Message,
                    c.Status,
                    c.CreatedAt
                })
                .ToListAsync();

            Response.Headers.Append("X-Pagination-TotalCount", totalCount.ToString());
            Response.Headers.Append("X-Pagination-TotalPages", totalPages.ToString());
            Response.Headers.Append("X-Pagination-CurrentPage", page.ToString());
            Response.Headers.Append("X-Pagination-PageSize", pageSize.ToString());

            return Ok(consultations);
        }

        [Authorize(Roles = "Client")]
        [HttpGet("sent")]
        public async Task<IActionResult> GetSentConsultations([FromQuery] string? status, [FromQuery] int page = 1, [FromQuery] int pageSize = 10)
        {
            var clientId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var query = _context.Consultations
                .Include(c => c.Lawyer)
                .Where(c => c.ClientId == clientId);

            if (!string.IsNullOrEmpty(status))
            {
                query = query.Where(c => c.Status == status);
            }

            var totalCount = await query.CountAsync();
            var totalPages = (int)Math.Ceiling((double)totalCount / pageSize);

            var consultations = await query
                .OrderByDescending(c => c.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(c => new {
                    c.Id,
                    c.ClientId,
                    c.ClientName,
                    c.ClientEmail,
                    c.LawyerId,
                    LawyerName = c.Lawyer != null ? c.Lawyer.FullName : "Advocate",
                    LawyerEmail = c.Lawyer != null ? c.Lawyer.Email : string.Empty,
                    c.Message,
                    c.Status,
                    c.CreatedAt
                })
                .ToListAsync();

            Response.Headers.Append("X-Pagination-TotalCount", totalCount.ToString());
            Response.Headers.Append("X-Pagination-TotalPages", totalPages.ToString());
            Response.Headers.Append("X-Pagination-CurrentPage", page.ToString());
            Response.Headers.Append("X-Pagination-PageSize", pageSize.ToString());

            return Ok(consultations);
        }

        [Authorize(Roles = "Lawyer")]
        [HttpPut("{id}/status")]
        public async Task<IActionResult> UpdateStatus(int id, [FromBody] UpdateStatusDto request)
        {
            var lawyerId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var consultation = await _context.Consultations.FindAsync(id);

            if (consultation == null)
            {
                return NotFound("Consultation not found.");
            }

            if (consultation.LawyerId != lawyerId)
            {
                return Forbid("You cannot modify inquiries sent to other lawyers.");
            }

            if (request.Status != "Pending" && request.Status != "Contacted" && request.Status != "Closed")
            {
                return BadRequest("Invalid status.");
            }

            consultation.Status = request.Status;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Status updated successfully!", status = consultation.Status });
        }
    }

    public class CreateConsultationDto
    {
        public string ClientName { get; set; } = string.Empty;
        public string ClientEmail { get; set; } = string.Empty;
        public string LawyerEmail { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
    }

    public class UpdateStatusDto
    {
        public string Status { get; set; } = string.Empty;
    }
}
