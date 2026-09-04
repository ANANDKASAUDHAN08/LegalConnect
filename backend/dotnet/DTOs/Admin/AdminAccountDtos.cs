namespace CoreApi.DTOs.Admin
{
    public class AdminChangePasswordDto
    {
        public string CurrentPassword { get; set; } = string.Empty;
        public string NewPassword { get; set; } = string.Empty;
    }

    public class AdminVerify2FADto
    {
        public string Code { get; set; } = string.Empty;
    }

    public class AdminDisable2FADto
    {
        public string Password { get; set; } = string.Empty;
    }
}