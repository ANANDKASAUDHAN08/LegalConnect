using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace CoreApi.DTOs.Admin
{
    public class ResolveReportRequestDto
    {
        public long ReportId { get; set; }
        public string Action { get; set; } = "ContentRemoved";
        public string? Notes { get; set; }
        public bool CascadeEnforcement { get; set; } = true;
    }

    public class DismissReportRequestDto
    {
        public long ReportId { get; set; }
        public string? Notes { get; set; }
        public bool RestoreTargetIfFlagged { get; set; } = true;
    }

    public class BulkResolveRequestDto
    {
        /// <summary>
        /// Maximum 100 report IDs per bulk operation to prevent
        /// unbounded WHERE IN queries and abuse from compromised sessions.
        /// </summary>
        [MaxLength(100, ErrorMessage = "Cannot bulk-resolve more than 100 reports at once.")]
        public List<long> ReportIds { get; set; } = new();
        public string Action { get; set; } = "ContentRemoved";
        public string? Notes { get; set; }
        public bool CascadeEnforcement { get; set; } = true;
    }

    public class BulkDismissRequestDto
    {
        /// <summary>
        /// Maximum 100 report IDs per bulk operation to prevent
        /// unbounded WHERE IN queries and abuse from compromised sessions.
        /// </summary>
        [MaxLength(100, ErrorMessage = "Cannot bulk-dismiss more than 100 reports at once.")]
        public List<long> ReportIds { get; set; } = new();
        public string? Notes { get; set; }
        public bool RestoreTargetIfFlagged { get; set; } = true;
    }

    public class EscalateSeverityDto
    {
        public string Severity { get; set; } = "Critical";
        public string? Notes { get; set; }
    }

    public class ReopenReportRequestDto
    {
        [Required]
        public string Reason { get; set; } = string.Empty;
        public bool RestoreTargetVisibility { get; set; } = false;
    }

    public class AddReportNoteRequestDto
    {
        [Required]
        [MaxLength(2000)]
        public string Note { get; set; } = string.Empty;
    }
}