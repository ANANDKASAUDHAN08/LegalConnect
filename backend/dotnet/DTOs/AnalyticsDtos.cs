namespace CoreApi.DTOs
{
    public class SetBudgetDto
    {
        public decimal? Budget { get; set; }
    }

    public class TrackViewDto
    {
        public int LawyerId { get; set; }
        public string? LawyerEmail { get; set; }
    }

    public class DailyStatDto
    {
        public string Date { get; set; } = string.Empty;
        public int Count { get; set; }
    }
}