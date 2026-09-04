using System.Collections.Generic;

namespace CoreApi.DTOs.Admin
{
    public class ResolveReportRequestDto
    {
        public long ReportId { get; set; }
        public string Action { get; set; } = "ContentRemoved";
        public string? Notes { get; set; }
    }

    public class DismissReportRequestDto
    {
        public long ReportId { get; set; }
        public string? Notes { get; set; }
    }

    public class BulkResolveRequestDto
    {
        public List<long> ReportIds { get; set; } = new();
        public string Action { get; set; } = "ContentRemoved";
        public string? Notes { get; set; }
    }

    public class BulkDismissRequestDto
    {
        public List<long> ReportIds { get; set; } = new();
        public string? Notes { get; set; }
    }
}