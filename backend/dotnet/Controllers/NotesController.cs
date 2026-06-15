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
    [Authorize]
    public class NotesController : ControllerBase
    {
        private readonly AppDbContext _context;

        public NotesController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> GetNotes()
        {
            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var notes = await _context.ResearchNotes
                .Where(n => n.ClientId == userId)
                .Select(n => new
                {
                    actShortName = n.ActShortName,
                    sectionNumber = n.SectionNumber,
                    noteText = n.NoteText,
                    updatedAt = ((DateTimeOffset)n.UpdatedAt).ToUnixTimeMilliseconds()
                })
                .ToListAsync();

            return Ok(notes);
        }

        [HttpGet("{actShortName}/{sectionNumber}")]
        public async Task<IActionResult> GetNote(string actShortName, string sectionNumber)
        {
            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var note = await _context.ResearchNotes
                .FirstOrDefaultAsync(n => n.ClientId == userId && n.ActShortName == actShortName && n.SectionNumber == sectionNumber);

            if (note == null)
            {
                return NotFound("Note not found.");
            }

            return Ok(new
            {
                actShortName = note.ActShortName,
                sectionNumber = note.SectionNumber,
                noteText = note.NoteText,
                updatedAt = ((DateTimeOffset)note.UpdatedAt).ToUnixTimeMilliseconds()
            });
        }

        [HttpPut("{actShortName}/{sectionNumber}")]
        public async Task<IActionResult> SaveNote(string actShortName, string sectionNumber, [FromBody] SaveNoteDto request)
        {
            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

            var note = await _context.ResearchNotes
                .FirstOrDefaultAsync(n => n.ClientId == userId && n.ActShortName == actShortName && n.SectionNumber == sectionNumber);

            if (note == null)
            {
                if (string.IsNullOrWhiteSpace(request.NoteText))
                {
                    return Ok(new { message = "No note to save." });
                }

                note = new ResearchNote
                {
                    ClientId = userId,
                    ActShortName = actShortName,
                    SectionNumber = sectionNumber,
                    NoteText = request.NoteText,
                    UpdatedAt = DateTime.UtcNow
                };
                _context.ResearchNotes.Add(note);
            }
            else
            {
                if (string.IsNullOrWhiteSpace(request.NoteText))
                {
                    _context.ResearchNotes.Remove(note);
                }
                else
                {
                    note.NoteText = request.NoteText;
                    note.UpdatedAt = DateTime.UtcNow;
                }
            }

            await _context.SaveChangesAsync();
            return Ok(new { message = "Note saved successfully." });
        }

        [HttpDelete("{actShortName}/{sectionNumber}")]
        public async Task<IActionResult> DeleteNote(string actShortName, string sectionNumber)
        {
            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var note = await _context.ResearchNotes
                .FirstOrDefaultAsync(n => n.ClientId == userId && n.ActShortName == actShortName && n.SectionNumber == sectionNumber);

            if (note != null)
            {
                _context.ResearchNotes.Remove(note);
                await _context.SaveChangesAsync();
            }

            return Ok(new { message = "Note deleted successfully." });
        }
    }

    public class SaveNoteDto
    {
        public string NoteText { get; set; } = string.Empty;
    }
}
