using System.Threading.Tasks;
using CoreApi.DTOs;

namespace CoreApi.Services
{
    public interface IWhatsAppNotificationService
    {
        Task<WhatsAppSendResultDto> SendAlertAsync(string toPhone, string message, string? alertType = null);
        Task<WhatsAppSendResultDto> SendTestAlertAsync(string toPhone, string userName);
        Task<WhatsAppSendResultDto> SendOtpAlertAsync(string toPhone, string code, string userName);
        Task<WhatsAppSendResultDto> SendConsultationInquiryAlertAsync(string toPhone, string lawyerName, string clientName, string messageSummary, int consultationId);
        Task<WhatsAppSendResultDto> SendConsultationStatusUpdateAlertAsync(string toPhone, string clientName, string lawyerName, string newStatus, int consultationId);
        WhatsAppStatusResponseDto GetGatewayStatus(string? userPhone = null, bool userEnabled = false);
        string GenerateDirectWhatsAppUrl(string toPhone, string message);
    }
}