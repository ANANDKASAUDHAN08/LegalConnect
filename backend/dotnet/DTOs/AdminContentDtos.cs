using System.Collections.Generic;

namespace CoreApi.Controllers
{
    public class AdminUpdateTicketDto
    {
        public string? Status { get; set; }
        public string? Priority { get; set; }
        public string? Category { get; set; }
        public string? AssignedAgent { get; set; }
        public string? ResolutionNote { get; set; }
        public string? InternalNotesJson { get; set; }
    }

    public class AdminReviewModerationDto
    {
        public string? ModerationStatus { get; set; }
        public string? FlagReason { get; set; }
        public string? AdvocateReply { get; set; }
        public string? AdvocateReplyStatus { get; set; }
        public string? ReasonCode { get; set; }
        public string? Notes { get; set; }
    }

    public class AdminReviewRedactDto
    {
        public string RedactedContent { get; set; } = string.Empty;
        public string? ReasonCode { get; set; }
        public string? Notes { get; set; }
    }

    public class AdminReviewDisputeResolutionDto
    {
        public string Decision { get; set; } = "Upheld"; // Upheld or Rejected
        public string? Rationale { get; set; }
    }

    public class AdminBulkConsultationStatusDto
    {
        public List<int> ConsultationIds { get; set; } = new();
        public string Status { get; set; } = string.Empty;
    }

    public class AdminUpdateConsultationNotesDto
    {
        public string AdminRemark { get; set; } = string.Empty;
    }

    public class AdminDispatchEmailDto
    {
        public string Template { get; set; } = string.Empty;
        public string Recipient { get; set; } = string.Empty;
        public string? CustomMessage { get; set; }
    }
}