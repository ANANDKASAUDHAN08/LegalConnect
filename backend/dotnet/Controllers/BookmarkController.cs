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
    public class BookmarkController : ControllerBase
    {
        private readonly AppDbContext _context;

        public BookmarkController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> GetBookmarks()
        {
            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var bookmarks = await _context.Bookmarks
                .Where(b => b.ClientId == userId)
                .OrderByDescending(b => b.SavedAt)
                .Select(b => new
                {
                    actShortName = b.ActShortName,
                    chapterNumber = b.ChapterNumber,
                    section = new
                    {
                        section_number = b.SectionNumber,
                        title = b.SectionTitle,
                        content = b.SectionContent
                    },
                    savedAt = ((DateTimeOffset)b.SavedAt).ToUnixTimeMilliseconds()
                })
                .ToListAsync();

            return Ok(bookmarks);
        }

        [HttpPost]
        public async Task<IActionResult> AddBookmark([FromBody] AddBookmarkDto request)
        {
            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

            // Check if already bookmarked
            var exists = await _context.Bookmarks.AnyAsync(b => 
                b.ClientId == userId && 
                b.ActShortName == request.ActShortName && 
                b.SectionNumber == request.SectionNumber);

            if (exists)
            {
                return BadRequest("Section is already bookmarked.");
            }

            var bookmark = new Bookmark
            {
                ClientId = userId,
                ActShortName = request.ActShortName,
                ChapterNumber = request.ChapterNumber,
                SectionNumber = request.SectionNumber,
                SectionTitle = request.SectionTitle,
                SectionContent = request.SectionContent,
                SavedAt = DateTime.UtcNow
            };

            _context.Bookmarks.Add(bookmark);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Section bookmarked successfully!" });
        }

        [HttpDelete("{actShortName}/{sectionNumber}")]
        public async Task<IActionResult> RemoveBookmark(string actShortName, string sectionNumber)
        {
            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

            var bookmark = await _context.Bookmarks.FirstOrDefaultAsync(b => 
                b.ClientId == userId && 
                b.ActShortName == actShortName && 
                b.SectionNumber == sectionNumber);

            if (bookmark == null)
            {
                return NotFound("Bookmark not found.");
            }

            _context.Bookmarks.Remove(bookmark);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Bookmark removed successfully." });
        }
    }

    public class AddBookmarkDto
    {
        public string ActShortName { get; set; } = string.Empty;
        public string ChapterNumber { get; set; } = string.Empty;
        public string SectionNumber { get; set; } = string.Empty;
        public string SectionTitle { get; set; } = string.Empty;
        public string SectionContent { get; set; } = string.Empty;
    }
}
