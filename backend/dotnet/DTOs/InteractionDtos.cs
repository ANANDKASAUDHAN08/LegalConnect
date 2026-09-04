using System.Collections.Generic;

namespace CoreApi.DTOs
{
    public class ToggleInteractionDto
    {
        public string TargetType { get; set; } = string.Empty;
        public string TargetId { get; set; } = string.Empty;
        public string Type { get; set; } = "Like";
    }

    public class BatchStatusDto
    {
        public string TargetType { get; set; } = string.Empty;
        public List<string> TargetIds { get; set; } = new();
    }
}