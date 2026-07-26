using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CoreApi.Controllers
{
    public partial class AdminController : ControllerBase
    {
        // ═══════════════════════════════════════════════════════════════
        //  BOOKMARKS & RESEARCH NOTES ANALYTICS
        // ═══════════════════════════════════════════════════════════════

        [Authorize(Roles = "Admin")]
        [HttpGet("bookmarks-notes/stats")]
        public async Task<IActionResult> GetBookmarksAndNotesStats()
        {
            var totalBookmarks = await _context.Bookmarks.CountAsync();
            var totalNotes = await _context.ResearchNotes.CountAsync();

            // Top 10 Most Bookmarked Sections
            var topBookmarkedSections = await _context.Bookmarks
                .GroupBy(b => new { b.ActShortName, b.SectionNumber, b.SectionTitle })
                .Select(g => new
                {
                    actShortName = g.Key.ActShortName,
                    sectionNumber = g.Key.SectionNumber,
                    actTitle = g.Key.SectionTitle ?? g.Key.ActShortName,
                    count = g.Count()
                })
                .OrderByDescending(x => x.count)
                .Take(10)
                .ToListAsync();

            // Bookmarks Breakdown by Act
            var bookmarksByAct = await _context.Bookmarks
                .GroupBy(b => b.ActShortName)
                .Select(g => new
                {
                    actShortName = g.Key,
                    count = g.Count()
                })
                .OrderByDescending(x => x.count)
                .Take(8)
                .ToListAsync();

            // 30-day activity trend
            var thirtyDaysAgo = DateTime.UtcNow.Date.AddDays(-29);
            var bookmarks = await _context.Bookmarks
                .Where(b => b.SavedAt >= thirtyDaysAgo)
                .ToListAsync();

            var notes = await _context.ResearchNotes
                .Where(n => n.UpdatedAt >= thirtyDaysAgo)
                .ToListAsync();

            var dailyTrends = new List<object>();
            for (int i = 0; i < 30; i++)
            {
                var date = thirtyDaysAgo.AddDays(i);
                var bCount = bookmarks.Count(b => b.SavedAt.Date == date);
                var nCount = notes.Count(n => n.UpdatedAt.Date == date);
                dailyTrends.Add(new { date = date.ToString("MMM dd"), bookmarks = bCount, notes = nCount });
            }

            // Top active researchers (Anonymized display name / ID)
            var topResearchers = await _context.Bookmarks
                .GroupBy(b => b.ClientId)
                .Select(g => new
                {
                    clientId = g.Key,
                    bookmarkCount = g.Count()
                })
                .OrderByDescending(x => x.bookmarkCount)
                .Take(5)
                .ToListAsync();

            var researcherDetails = new List<object>();
            foreach (var tr in topResearchers)
            {
                var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == tr.clientId);
                var noteCount = await _context.ResearchNotes.CountAsync(n => n.ClientId == tr.clientId);
                researcherDetails.Add(new
                {
                    clientId = tr.clientId,
                    userName = user != null ? $"{user.FullName.Substring(0, 1)}***" : $"User #{tr.clientId}",
                    role = user?.Role ?? "Client",
                    bookmarkCount = tr.bookmarkCount,
                    noteCount = noteCount,
                    totalActivity = tr.bookmarkCount + noteCount
                });
            }

            return Ok(new
            {
                totalBookmarks,
                totalNotes,
                topBookmarkedSections,
                bookmarksByAct,
                dailyTrends,
                topResearchers = researcherDetails
            });
        }
    }
}