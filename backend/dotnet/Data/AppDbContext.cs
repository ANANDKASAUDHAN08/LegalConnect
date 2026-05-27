using Microsoft.EntityFrameworkCore;
using CoreApi.Models;

namespace CoreApi.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
        {
        }

        public DbSet<User> Users { get; set; }
        public DbSet<LawyerProfile> LawyerProfiles { get; set; }
        public DbSet<Consultation> Consultations { get; set; }
        public DbSet<Bookmark> Bookmarks { get; set; }
        public DbSet<Review> Reviews { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Configure One-to-One relationship
            modelBuilder.Entity<User>()
                .HasOne(u => u.LawyerProfile)
                .WithOne(p => p.User)
                .HasForeignKey<LawyerProfile>(p => p.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            // Configure Consultation relationships
            modelBuilder.Entity<Consultation>()
                .HasOne(c => c.Lawyer)
                .WithMany()
                .HasForeignKey(c => c.LawyerId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<Consultation>()
                .HasOne(c => c.Client)
                .WithMany()
                .HasForeignKey(c => c.ClientId)
                .OnDelete(DeleteBehavior.SetNull);

            // Configure Bookmark relationship
            modelBuilder.Entity<Bookmark>()
                .HasOne(b => b.Client)
                .WithMany()
                .HasForeignKey(b => b.ClientId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
