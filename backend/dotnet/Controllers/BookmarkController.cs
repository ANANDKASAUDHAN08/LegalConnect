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

        [HttpGet("paginated")]
        public async Task<IActionResult> GetBookmarksPaginated(
            [FromQuery] string? collectionName = null,
            [FromQuery] string? actFilter = null,
            [FromQuery] string? searchQuery = null,
            [FromQuery] string? sortBy = "newest",
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 8)
        {
            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            
            var query = _context.Bookmarks.Where(b => b.ClientId == userId);

            // 1. Collection Name filter
            if (!string.IsNullOrEmpty(collectionName) && collectionName != "All")
            {
                if (collectionName == "Unassigned")
                {
                    query = query.Where(b => string.IsNullOrEmpty(b.CollectionName));
                }
                else
                {
                    query = query.Where(b => b.CollectionName == collectionName);
                }
            }

            // 2. Act filter
            if (!string.IsNullOrEmpty(actFilter))
            {
                query = query.Where(b => b.ActShortName == actFilter);
            }

            // 3. Search query filter
            if (!string.IsNullOrEmpty(searchQuery))
            {
                var q = searchQuery.ToLower();
                query = query.Where(b => 
                    b.ActShortName.ToLower().Contains(q) ||
                    b.SectionNumber.ToLower().Contains(q) ||
                    b.SectionTitle.ToLower().Contains(q) ||
                    b.SectionContent.ToLower().Contains(q) ||
                    (b.Notes != null && b.Notes.ToLower().Contains(q)));
            }

            // 4. Sort order
            if (sortBy == "oldest")
            {
                query = query.OrderBy(b => b.SavedAt);
            }
            else if (sortBy == "sectionAsc")
            {
                query = query.OrderBy(b => b.SectionNumber);
            }
            else if (sortBy == "sectionDesc")
            {
                query = query.OrderByDescending(b => b.SectionNumber);
            }
            else // newest
            {
                query = query.OrderByDescending(b => b.SavedAt);
            }

            // 5. Paginate
            var totalCount = await query.CountAsync();
            var totalPages = (int)Math.Ceiling((double)totalCount / pageSize);
            
            var skip = (page - 1) * pageSize;
            var bookmarks = await query
                .Skip(skip)
                .Take(pageSize)
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
                    notes = b.Notes,
                    collectionName = b.CollectionName,
                    savedAt = ((DateTimeOffset)b.SavedAt).ToUnixTimeMilliseconds()
                })
                .ToListAsync();

            return Ok(new
            {
                success = true,
                data = bookmarks,
                pagination = new
                {
                    totalItems = totalCount,
                    page,
                    pageSize,
                    totalPages
                }
            });
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
                    notes = b.Notes,
                    collectionName = b.CollectionName,
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
                Notes = request.Notes,
                CollectionName = request.CollectionName,
                SavedAt = DateTime.UtcNow
            };

            _context.Bookmarks.Add(bookmark);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Section bookmarked successfully!" });
        }

        [HttpPut("{actShortName}/{sectionNumber}")]
        public async Task<IActionResult> UpdateBookmark(string actShortName, string sectionNumber, [FromBody] UpdateBookmarkDto request)
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

            bookmark.Notes = request.Notes;
            bookmark.CollectionName = request.CollectionName;

            await _context.SaveChangesAsync();

            return Ok(new { message = "Bookmark updated successfully." });
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
        public string? Notes { get; set; }
        public string? CollectionName { get; set; }
    }

    public class UpdateBookmarkDto
    {
        public string? Notes { get; set; }
        public string? CollectionName { get; set; }
    }
}
