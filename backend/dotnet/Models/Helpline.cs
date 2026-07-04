namespace CoreApi.Models
{
    public class Helpline
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Number { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Categories { get; set; } = string.Empty; // Comma-separated e.g. "Criminal Matter,Cyber Crime"
        public bool IsActive { get; set; } = true;
    }
}
