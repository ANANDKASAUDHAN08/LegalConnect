namespace CoreApi.DTOs
{
    public class SaveConsentDto
    {
        public string AnonymousId { get; set; } = string.Empty;
        public bool AnalyticsConsent { get; set; }
        public bool MarketingConsent { get; set; }
    }
}