using System.Collections.Generic;

namespace CoreApi.DTOs.Admin
{
    public class AdminRoleDto
    {
        public string Role { get; set; } = string.Empty;
    }

    public class AdminBulkStatusDto
    {
        public List<int> UserIds { get; set; } = new();
        public bool IsActive { get; set; }
    }

    public class AdminUpdateUserDto
    {
        public string? FullName { get; set; }
        public string? Email { get; set; }
        public string? Role { get; set; }
        public string? Phone { get; set; }
        public string? ClientCity { get; set; }
        public string? ClientState { get; set; }
        public bool? IsActive { get; set; }
        public bool? IsEmailVerified { get; set; }
    }

    public class AdminUpdateStatusDto
    {
        public string Status { get; set; } = string.Empty;
    }
}