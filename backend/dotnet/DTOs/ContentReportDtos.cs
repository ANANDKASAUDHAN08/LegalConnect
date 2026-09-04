namespace CoreApi.DTOs
{
    public class ReasonItemDto
    {
        public string Key { get; set; } = string.Empty;
        public string Label { get; set; } = string.Empty;
        public string Icon { get; set; } = string.Empty;
        public string Severity { get; set; } = "Medium";
    }

    public class CreateReportDto
    {
        public string TargetType { get; set; } = string.Empty;
        public string TargetId { get; set; } = string.Empty;
        public string? TargetTitle { get; set; }
        public string ReasonCategory { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string? EvidenceUrl { get; set; }
        public string? ReporterName { get; set; }
        public string? ReporterEmail { get; set; }
        public string? ClientFingerprint { get; set; }
    }

    public class AppealReportDto
    {
        public string ReferenceId { get; set; } = string.Empty;
        public string AppealReason { get; set; } = string.Empty;
        public string? EvidenceUrl { get; set; }
    }

    public class WithdrawReportDto
    {
        public string TargetType { get; set; } = string.Empty;
        public string TargetId { get; set; } = string.Empty;
        public string? ClientFingerprint { get; set; }
    }
}