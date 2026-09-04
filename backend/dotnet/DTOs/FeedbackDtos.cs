namespace CoreApi.DTOs
{
    public class SubmitFeedbackDto
    {
        public string PageSlug { get; set; } = string.Empty;
        public bool IsHelpful { get; set; }
    }
}