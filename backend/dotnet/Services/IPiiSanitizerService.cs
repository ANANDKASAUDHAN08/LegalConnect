using System.Collections.Generic;

namespace CoreApi.Services
{
    public class PiiSanitizeResult
    {
        public bool HasPii { get; set; }
        public string SanitizedText { get; set; } = string.Empty;
        public List<string> DetectedTypes { get; set; } = new();
    }

    public interface IPiiSanitizerService
    {
        PiiSanitizeResult Sanitize(string input);
    }
}