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
        public DbSet<ActiveSession> ActiveSessions { get; set; }
        public DbSet<RefreshToken> RefreshTokens { get; set; }
        public DbSet<LoginHistory> LoginHistories { get; set; }
        public DbSet<ResearchNote> ResearchNotes { get; set; }
        public DbSet<Helpline> Helplines { get; set; }
        public DbSet<FavouriteLawyer> FavouriteLawyers { get; set; }
        public DbSet<FavouriteHelpline> FavouriteHelplines { get; set; }
        public DbSet<FavouriteResource> FavouriteResources { get; set; }
        public DbSet<SystemAnnouncement> SystemAnnouncements { get; set; }
        public DbSet<UserAnnouncementRead> UserAnnouncementReads { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Configure UserAnnouncementRead relationships
            modelBuilder.Entity<UserAnnouncementRead>()
                .HasOne(r => r.User)
                .WithMany()
                .HasForeignKey(r => r.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<UserAnnouncementRead>()
                .HasOne(r => r.Announcement)
                .WithMany()
                .HasForeignKey(r => r.AnnouncementId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<UserAnnouncementRead>()
                .HasIndex(r => new { r.UserId, r.AnnouncementId })
                .IsUnique();

            // Configure RefreshToken relationships
            modelBuilder.Entity<RefreshToken>()
                .HasOne(r => r.User)
                .WithMany()
                .HasForeignKey(r => r.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<RefreshToken>()
                .HasIndex(r => r.Token);

            // Configure ActiveSession & LoginHistory relationships
            modelBuilder.Entity<ActiveSession>()
                .HasOne(s => s.User)
                .WithMany()
                .HasForeignKey(s => s.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<LoginHistory>()
                .HasOne(h => h.User)
                .WithMany()
                .HasForeignKey(h => h.UserId)
                .OnDelete(DeleteBehavior.Cascade);

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

            // Configure ResearchNote relationship
            modelBuilder.Entity<ResearchNote>()
                .HasOne(n => n.Client)
                .WithMany()
                .HasForeignKey(n => n.ClientId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<ResearchNote>()
                .HasIndex(n => new { n.ClientId, n.ActShortName, n.SectionNumber })
                .IsUnique();

            // Configure FavouriteLawyer relationship
            modelBuilder.Entity<FavouriteLawyer>()
                .HasOne(f => f.Client)
                .WithMany()
                .HasForeignKey(f => f.ClientId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<FavouriteLawyer>()
                .HasIndex(f => new { f.ClientId, f.LawyerId })
                .IsUnique();

            // Configure FavouriteResource relationship
            modelBuilder.Entity<FavouriteResource>()
                .HasOne(f => f.Client)
                .WithMany()
                .HasForeignKey(f => f.ClientId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<FavouriteResource>()
                .HasIndex(f => new { f.ClientId, f.ResourceId })
                .IsUnique();

            // Configure FavouriteHelpline relationships
            modelBuilder.Entity<FavouriteHelpline>()
                .HasOne(f => f.Client)
                .WithMany()
                .HasForeignKey(f => f.ClientId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<FavouriteHelpline>()
                .HasIndex(f => new { f.ClientId, f.HelplineId })
                .IsUnique();
        }
    }
}
