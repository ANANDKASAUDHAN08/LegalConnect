using System.ComponentModel.DataAnnotations;

namespace CoreApi.DTOs.Admin
{
    public class CreateAdminSavedViewDto
    {
        [Required]
        public string PageKey { get; set; } = string.Empty;

        [Required]
        public string Name { get; set; } = string.Empty;

        [Required]
        public string ParamsJson { get; set; } = "{}";
    }
}