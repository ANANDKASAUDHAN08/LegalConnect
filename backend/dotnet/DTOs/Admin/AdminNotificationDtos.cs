using System;
using System.Collections.Generic;

namespace CoreApi.DTOs.Admin
{
    public class NotificationQueryDto
    {
        public int Page { get; set; } = 1;
        public int Limit { get; set; } = 10;
        public string? Search { get; set; }
        public string? Severity { get; set; } = "all";
        public string? Category { get; set; } = "all";
        public string? Tab { get; set; } = "all"; // all, unread, starred, archived
        public string? SortBy { get; set; } = "newest"; // newest, oldest, severity
        public string? TargetRole { get; set; } = "all"; // all, SuperAdmin, VerificationOfficer, SupportDesk
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
    }

    public class BroadcastNotificationDto
    {
        public string TargetCohort { get; set; } = "all"; // all, lawyers, citizens, admins
        public string Title { get; set; } = string.Empty;
        public string Summary { get; set; } = string.Empty;
        public string? DetailsMarkdown { get; set; }
        public string Severity { get; set; } = "info";
        public string Category { get; set; } = "announcement";
        public bool IsModalTrigger { get; set; } = true;
    }

    public class BulkNotificationActionDto
    {
        public List<string> Ids { get; set; } = new();
        public string Action { get; set; } = "mark_read"; // mark_read, mark_unread, delete, archive, unarchive
    }

    public class QuickActionDto
    {
        public string ActionType { get; set; } = string.Empty; // approve_lawyer, reject_lawyer, resolve_ticket
        public string? Remarks { get; set; }
    }

    public class StreamEventItem
    {
        public string Id { get; set; } = string.Empty;
        public int? BackendId { get; set; }
        public string Type { get; set; } = "announcement";
        public string Severity { get; set; } = "info";
        public string Category { get; set; } = "announcement";
        public string Title { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public string? DetailsMarkdown { get; set; }
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
        public bool Read { get; set; }
        public bool Starred { get; set; }
        public bool Archived { get; set; }
        public string? Link { get; set; }
        public string? ActionLabel { get; set; }
        public string? Source { get; set; }
        public string? RelatedEntityType { get; set; }
        public int? RelatedEntityId { get; set; }
        public string? TargetRole { get; set; }
    }
}