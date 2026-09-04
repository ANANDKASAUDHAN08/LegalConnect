namespace CoreApi.DTOs
{
    public class CreateReviewDto
    {
        public int Rating { get; set; }
        public string Content { get; set; } = string.Empty;
        public string? TargetName { get; set; }
        public string? AuthorName { get; set; } // Only utilized for Guests
    }

    public class UpdateReviewDto
    {
        public int Rating { get; set; }
        public string Content { get; set; } = string.Empty;
        public string? TargetName { get; set; }
    }

    public class FlagReviewDto
    {
        public string? Reason { get; set; }
    }

    public class DisputeReviewDto
    {
        public string? Reason { get; set; }
    }
}