namespace CoreApi.DTOs
{
    public class CreateConsultationDto
    {
        public string ClientName { get; set; } = string.Empty;
        public string ClientEmail { get; set; } = string.Empty;
        public string LawyerEmail { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
    }

    public class UpdateStatusDto
    {
        public string Status { get; set; } = string.Empty;
    }
}