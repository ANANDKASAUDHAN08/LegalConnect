using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using System.Text.Json;
using CoreApi.Models;
using CoreApi.Models.Admin;
using Microsoft.EntityFrameworkCore;

namespace CoreApi.Data
{
    public static class DbSeeder
    {
        public class SeedLawyerDto
        {
            public string name { get; set; } = "";
            public string email { get; set; } = "";
            public string[] specializations { get; set; } = Array.Empty<string>();
            public string city { get; set; } = "";
            public int experience { get; set; }
            public string bio { get; set; } = "";
            public string phone { get; set; } = "";
            public decimal consultationFee { get; set; }
            public decimal inPersonFee { get; set; }
            public int casesCompleted { get; set; }
            public int successRate { get; set; }
            public string[] activeCourts { get; set; } = Array.Empty<string>();
            public string responseTime { get; set; } = "";
            public object? workingHours { get; set; }
            public object? socialLinks { get; set; }
            public object? faqs { get; set; }
            public object? accolades { get; set; }
            public object? casesList { get; set; }
            public object? availableTimeSlots { get; set; }
        }

        public static void Seed(AppDbContext context, Microsoft.Extensions.Configuration.IConfiguration configuration)
        {
            // Auto-create missing MySQL tables and columns if they don't exist yet
            EnsureAdminNotificationsTableExists(context);
            EnsureSecurityAuditLogsTableExists(context);
            EnsureColumnExists(context, "Users", "AuthProvider", "VARCHAR(50) DEFAULT 'Email + Password'");
            EnsureColumnExists(context, "Users", "LastLoginAt", "DATETIME NULL");
            EnsureColumnExists(context, "Users", "LastIpAddress", "VARCHAR(50) NULL");
            EnsureColumnExists(context, "Users", "TwoFactorBackupCodes", "varchar(2000) NULL");
            EnsureColumnExists(context, "Consultations", "AdminRemark", "TEXT NULL");
            EnsureColumnExists(context, "Consultations", "AuditLogJson", "LONGTEXT NULL");
            EnsureColumnExists(context, "LawyerProfiles", "VerificationRemarks", "TEXT NULL");
            EnsureColumnExists(context, "LawyerProfiles", "CopExpiryDate", "DATETIME NULL");

            // Activate all existing users whose IsActive default was set to false by EF migration
            var deactivatedUsers = context.Users.Where(u => !u.IsActive).ToList();
            if (deactivatedUsers.Any())
            {
                foreach (var u in deactivatedUsers)
                {
                    u.IsActive = true;
                }
                context.SaveChanges();
                Console.WriteLine($"✅ Auto-activated {deactivatedUsers.Count} existing users.");
            }

            // Ensure Admin user is seeded and hash is synchronized
            var adminEmail = (Environment.GetEnvironmentVariable("ADMIN_SEED_EMAIL") 
                             ?? configuration["AdminSeed:Email"] 
                             ?? "admin@legalconnect.com").Trim().ToLower();
            var adminPassword = Environment.GetEnvironmentVariable("ADMIN_SEED_PASSWORD") 
                                ?? configuration["AdminSeed:Password"] 
                                ?? "Admin@123!";

            var existingAdmin = context.Users.FirstOrDefault(u => u.Email.ToLower() == adminEmail);
            if (existingAdmin == null)
            {
                var admin = new User
                {
                    FullName = configuration["AdminSeed:FullName"] ?? "System Administrator",
                    Email = adminEmail,
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword(adminPassword),
                    Role = "Admin",
                    IsEmailVerified = true,
                    IsPhoneVerified = true,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow
                };
                context.Users.Add(admin);
                context.SaveChanges();
                Console.WriteLine($"✅ Admin user seeded from configuration: {adminEmail}");
            }
            else
            {
                existingAdmin.Role = "Admin";
                existingAdmin.IsActive = true;
                existingAdmin.PasswordHash = BCrypt.Net.BCrypt.HashPassword(adminPassword);
                context.SaveChanges();
                Console.WriteLine($"✅ Admin user password hash & role synchronized: {adminEmail}");
            }

            string? jsonContent = null;
            try
            {
                var paths = new[]
                {
                    Path.Combine(Directory.GetCurrentDirectory(), "..", "node", "src", "data", "lawyers.seed.json"),
                    Path.Combine(Directory.GetCurrentDirectory(), "lawyers.seed.json"),
                    "../node/src/data/lawyers.seed.json"
                };

                foreach (var p in paths)
                {
                    if (File.Exists(p))
                    {
                        jsonContent = File.ReadAllText(p);
                        break;
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Seeder Warning: Could not locate lawyers.seed.json: {ex.Message}");
            }

            if (!string.IsNullOrEmpty(jsonContent))
            {
                try
                {
                    var lawyers = JsonSerializer.Deserialize<List<SeedLawyerDto>>(jsonContent);
                    if (lawyers != null && lawyers.Any())
                    {
                        bool changed = false;
                        foreach (var l in lawyers)
                        {
                            var user = context.Users.FirstOrDefault(u => u.Email == l.email);
                            if (user == null)
                            {
                                user = new User
                                {
                                    FullName = l.name,
                                    Email = l.email,
                                    PasswordHash = BCrypt.Net.BCrypt.HashPassword("password123"),
                                    Role = "Lawyer",
                                    IsEmailVerified = true,
                                    IsPhoneVerified = true,
                                    Phone = l.phone,
                                    CreatedAt = DateTime.UtcNow
                                };
                                context.Users.Add(user);
                                context.SaveChanges();
                            }

                            var profile = context.LawyerProfiles.FirstOrDefault(p => p.UserId == user.Id);
                            if (profile == null)
                            {
                                profile = new LawyerProfile
                                {
                                    UserId = user.Id,
                                    BarCouncilNumber = "BCI/SEED/" + user.Id,
                                    UpdatedAt = DateTime.UtcNow
                                };
                                context.LawyerProfiles.Add(profile);
                            }

                            // Always update/repair fields with seed data if they are empty or default
                            profile.Specialization = string.Join(", ", l.specializations);
                            profile.ExperienceYears = l.experience;
                            profile.City = l.city;
                            profile.Bio = l.bio;
                            profile.Phone = string.IsNullOrEmpty(l.phone) ? (user.Phone ?? "") : l.phone;
                            profile.ConsultationFee = l.consultationFee;
                            profile.InPersonFee = l.inPersonFee;
                            profile.CasesCompleted = l.casesCompleted;
                            profile.SuccessRate = l.successRate;
                            profile.OfficeAddress = $"Suite {100 + user.Id}, Legal Chambers, High Court Road";
                            profile.Education = "LL.B., National Law School";
                            profile.LanguagesSpoken = "English, Hindi";
                            profile.IsAvailable = true;
                            profile.IsVerified = true;

                            // Premium fields
                            profile.ActiveCourts = string.Join(", ", l.activeCourts);
                            profile.ResponseTime = l.responseTime;

                            if (l.workingHours != null)
                            {
                                try
                                {
                                    if (l.workingHours is JsonElement je)
                                    {
                                        var days = je.GetProperty("days").GetString();
                                        var hours = je.GetProperty("hours").GetString();
                                        profile.WorkingHours = $"{days}: {hours}";
                                    }
                                }
                                catch
                                {
                                    profile.WorkingHours = "Mon - Fri: 9:00 AM - 6:00 PM";
                                }
                            }

                            if (l.socialLinks != null)
                                profile.SocialLinksJson = JsonSerializer.Serialize(l.socialLinks);
                            if (l.faqs != null)
                                profile.FaqsJson = JsonSerializer.Serialize(l.faqs);
                            if (l.accolades != null)
                                profile.AccoladesJson = JsonSerializer.Serialize(l.accolades);
                            if (l.casesList != null)
                                profile.CasesJson = JsonSerializer.Serialize(l.casesList);
                            if (l.availableTimeSlots != null)
                                profile.TimeSlotsJson = JsonSerializer.Serialize(l.availableTimeSlots);

                            changed = true;
                        }

                        if (changed)
                        {
                            context.SaveChanges();
                            Console.WriteLine("SQL Server database populated/updated with rich mock data from lawyers.seed.json.");
                        }
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Seeder Error during JSON seed parsing: {ex.Message}");
                }
            }

            // Seed Reviews if none exist
            if (!context.Reviews.Any())
            {
                var seededReviews = new[]
                {
                    new Review
                    {
                        UserRole = "Client",
                        AuthorName = "Vikas M.",
                        TargetName = "Adv. Priya Sharma",
                        Rating = 5,
                        Content = "Adv. Priya Sharma was extremely professional and patient. She explained our options under the criminal code clearly and got the bail request approved in record time.",
                        CreatedAt = DateTime.UtcNow.AddDays(-10)
                    },
                    new Review
                    {
                        UserRole = "Client",
                        AuthorName = "Anjali R.",
                        TargetName = "Adv. Rajesh Kumar",
                        Rating = 5,
                        Content = "Adv. Rajesh Kumar helped settle a complex partition suit out of court. Truly excellent property law guidance.",
                        CreatedAt = DateTime.UtcNow.AddDays(-8)
                    },
                    new Review
                    {
                        UserRole = "Client",
                        AuthorName = "Rajesh K.",
                        TargetName = "Platform",
                        Rating = 5,
                        Content = "The AI Legal Assistant is incredibly useful. Uploaded my rent contract and got a list of hidden risks and standard clauses instantly. Saved thousands in notary fees!",
                        CreatedAt = DateTime.UtcNow.AddDays(-6)
                    },
                    new Review
                    {
                        UserRole = "Lawyer",
                        AuthorName = "Adv. Sunita Mehta",
                        TargetName = "Platform",
                        Rating = 5,
                        Content = "The BNS equivalent lookup tool is integrated directly into the dashboard. Saves hours of draft checking during this transition period.",
                        CreatedAt = DateTime.UtcNow.AddDays(-4)
                    },
                    new Review
                    {
                        UserRole = "Lawyer",
                        AuthorName = "Adv. Amit Verma",
                        TargetName = "Platform",
                        Rating = 5,
                        Content = "Client intake pre-screening helps filter out irrelevant questions. I only consult with clients who have matching legal concerns, saving time.",
                        CreatedAt = DateTime.UtcNow.AddDays(-2)
                    }
                };

                context.Reviews.AddRange(seededReviews);
                context.SaveChanges();
            }

            // Seed Helplines if none exist
            if (!context.Helplines.Any())
            {
                var helplines = new[]
                {
                    new Helpline { Name = "National Emergency (All-in-One)", Number = "112", Description = "Single emergency number for police, fire and ambulance across India.", Categories = "Criminal Matter,Other / Not Sure", IsActive = true },
                    new Helpline { Name = "Domestic Violence & Women's Helpline", Number = "1091", Description = "24x7 helpline for women in distress, domestic violence, and sexual harassment.", Categories = "Family Law,Criminal Matter", IsActive = true },
                    new Helpline { Name = "Cyber Crime Helpline", Number = "1930", Description = "Report online financial fraud and cybercrime. Freeze fraudulent transactions within the golden hour.", Categories = "Cyber Crime", IsActive = true },
                    new Helpline { Name = "National Women Helpline", Number = "181", Description = "Government helpline for women in crisis, trafficking, and gender-based violence.", Categories = "Family Law,Criminal Matter", IsActive = true },
                    new Helpline { Name = "National Legal Aid Helpline", Number = "15100", Description = "Free legal aid and advice for citizens unable to afford legal services (NALSA).", Categories = "Other / Not Sure,Criminal Matter,Family Law", IsActive = true },
                    new Helpline { Name = "Consumer Helpline", Number = "1800-11-4000", Description = "National consumer grievance redressal helpline for product defects, billing disputes and fraud.", Categories = "Consumer Complaint", IsActive = true },
                    new Helpline { Name = "Labour Helpline", Number = "1800-180-5412", Description = "Report wage theft, workplace harassment, and labour law violations.", Categories = "Labour Issue", IsActive = true },
                    new Helpline { Name = "MSME Grievance Helpline", Number = "1800-111-822", Description = "Helpline for micro, small and medium enterprises facing payment delays or contract disputes.", Categories = "Business Dispute", IsActive = true },
                    new Helpline { Name = "Child Helpline (Childline)", Number = "1098", Description = "Emergency outreach for children in distress, abuse, trafficking, or legal trouble.", Categories = "Family Law,Criminal Matter", IsActive = true },
                    new Helpline { Name = "Senior Citizen Helpline", Number = "14567", Description = "Government helpline for senior citizens facing abuse, neglect, or legal issues.", Categories = "Criminal Matter,Family Law", IsActive = true },
                    new Helpline { Name = "Anti-Corruption Helpline (CVC)", Number = "1800-11-0180", Description = "Report government corruption and bribery to the Central Vigilance Commission.", Categories = "Criminal Matter,Business Dispute", IsActive = true },
                    new Helpline { Name = "Income Tax Helpline", Number = "1800-180-1961", Description = "Tax filing assistance, ITR queries, and TDS refund disputes.", Categories = "Business Dispute", IsActive = true },
                    new Helpline { Name = "Road Accident Emergency (NHAI)", Number = "1033", Description = "Report highway accidents and get emergency response on national highways.", Categories = "Criminal Matter,Other / Not Sure", IsActive = true },
                    new Helpline { Name = "RERA Grievance Helpline", Number = "1800-120-3507", Description = "File complaints against builders for delayed possession or project fraud under RERA.", Categories = "Property Dispute", IsActive = true },
                    new Helpline { Name = "Disability Rights Helpline", Number = "1800-11-4515", Description = "Helpline for persons with disabilities facing discrimination or access to entitlements.", Categories = "Labour Issue,Other / Not Sure", IsActive = true }
                };

                context.Helplines.AddRange(helplines);
                context.SaveChanges();
                Console.WriteLine("Helplines table seeded with 15 national helplines.");
            }

            // Seed SystemAnnouncements if none exist
            if (!context.SystemAnnouncements.Any())
            {
                var announcements = new[]
                {
                    new SystemAnnouncement
                    {
                        Version = "1.2.0",
                        Title = "🚀 LegalConnect 1.2.0: Install App & Performance Upgrade",
                        Summary = "Download LegalConnect as an app for desktop and mobile! Experience offline bare act reading, faster law search, and mobile UX improvements.",
                        DetailsMarkdown = "### What's New in Version 1.2.0\n\n- 📱 **Progressive Web App (PWA)**: Click 'Install App' in the menu to install LegalConnect as a native app on Windows, Mac, Android, and iOS!\n- ⚡ **Offline Bare Acts Reader**: Access your saved acts and statutes without an active internet connection.\n- 🛠️ **Mobile Share & Overlay Fix**: Fixed an issue where closing native share sheets triggered secondary overlays.\n- 🔔 **System Announcements**: Live notifications for platform updates and legal changes.",
                        Type = AnnouncementType.MajorRelease,
                        IsModalTrigger = true,
                        IsActive = true,
                        CreatedAt = DateTime.UtcNow,
                        PublishedAt = DateTime.UtcNow
                    },
                    new SystemAnnouncement
                    {
                        Version = "1.1.5",
                        Title = "🛠️ Critical Fix: Mobile Navigation & Statute Filters",
                        Summary = "Resolved filter reset glitches on statute browsing and optimized mobile navbar rendering speed.",
                        DetailsMarkdown = "### Bug Fixes & Refinements\n\n- Fixed an issue where statute category filters reset during fast scrolling.\n- Improved touch response times on low-power mobile devices.",
                        Type = AnnouncementType.MajorBugFix,
                        IsModalTrigger = false,
                        IsActive = true,
                        CreatedAt = DateTime.UtcNow.AddDays(-5),
                        PublishedAt = DateTime.UtcNow.AddDays(-5)
                    }
                };

                context.SystemAnnouncements.AddRange(announcements);
                context.SaveChanges();
                Console.WriteLine("SystemAnnouncements table seeded with 1.2.0 release notes.");
            }

            // Seed AdminNotifications if none exist
            try
            {
                if (!context.AdminNotifications.Any())
                {
                    var adminNotifications = new[]
                    {
                        new AdminNotification
                        {
                            TargetRole = "All",
                            Type = "security_alert",
                            Severity = "critical",
                            Category = "security",
                            Title = "Elevated Brute-Force Activity Detected",
                            Message = "7 consecutive failed login attempts from IP 103.92.41.xx targeting admin@legalconnect.com within 3 minutes.",
                            DetailsMarkdown = "### Security Incident Report\n\n- **IP Address:** 103.92.41.xx\n- **Target Account:** admin@legalconnect.com\n- **Attempts:** 7 in 3 minutes\n- **Status:** IP temporarily rate-limited\n- **Recommendation:** Review IP in firewall rules and enable Geo-fencing.",
                            CreatedAt = DateTime.UtcNow.AddMinutes(-45),
                            ActionUrl = "/security",
                            ActionLabel = "Review Security Logs",
                            Source = "Security Monitor"
                        },
                        new AdminNotification
                        {
                            TargetRole = "All",
                            Type = "security_alert",
                            Severity = "warning",
                            Category = "security",
                            Title = "Two-Factor Authentication Disabled",
                            Message = "User rajesh.kumar@email.com (ID: 14) disabled 2FA on their account.",
                            CreatedAt = DateTime.UtcNow.AddHours(-2),
                            ActionUrl = "/users",
                            ActionLabel = "Review User",
                            Source = "Security Monitor"
                        },
                        new AdminNotification
                        {
                            TargetRole = "VerificationOfficer",
                            Type = "verification_req",
                            Severity = "warning",
                            Category = "verification",
                            Title = "Bar Credential Audit Pending",
                            Message = "Adv. Meera Nair submitted license (BCI/KER/2024/1892) under Kerala Bar Council.",
                            CreatedAt = DateTime.UtcNow.AddHours(-1),
                            ActionUrl = "/lawyers",
                            ActionLabel = "Audit License",
                            Source = "Lawyer Verification",
                            RelatedEntityType = "LawyerProfile"
                        },
                        new AdminNotification
                        {
                            TargetRole = "SupportDesk",
                            Type = "urgent_ticket",
                            Severity = "warning",
                            Category = "support",
                            Title = "Grievance Ticket #1023: Lawyer Misconduct Report",
                            Message = "Submitted by Anita Desai: I was charged ₹15,000 for a consultation that was supposed to be free under the pro-bono scheme.",
                            CreatedAt = DateTime.UtcNow.AddHours(-3),
                            ActionUrl = "/support",
                            ActionLabel = "Open Grievance Desk",
                            Source = "Support Desk",
                            RelatedEntityType = "ContactSubmission"
                        },
                        new AdminNotification
                        {
                            TargetRole = "All",
                            Type = "consultation_alert",
                            Severity = "info",
                            Category = "consultation",
                            Title = "Consultation #78 - Confirmed",
                            Message = "Client Vikram Singh booked session with Adv. Priya Sharma for Property Dispute.",
                            CreatedAt = DateTime.UtcNow.AddHours(-5),
                            IsRead = true,
                            ActionUrl = "/consultations",
                            ActionLabel = "Track Booking",
                            Source = "Consultation System",
                            RelatedEntityType = "Consultation"
                        },
                        new AdminNotification
                        {
                            TargetRole = "All",
                            Type = "announcement",
                            Severity = "success",
                            Category = "announcement",
                            Title = "Platform Milestone: 500 Active Users",
                            Message = "LegalConnect has crossed 500 registered active users. Lawyer onboarding rate has increased 23% this month.",
                            CreatedAt = DateTime.UtcNow.AddDays(-1),
                            IsRead = true,
                            ActionUrl = "/dashboard",
                            ActionLabel = "View Dashboard",
                            Source = "System Analytics"
                        },
                        new AdminNotification
                        {
                            TargetRole = "All",
                            Type = "security_alert",
                            Severity = "info",
                            Category = "security",
                            Title = "Daily Security Audit Summary",
                            Message = "24h Summary: 0 critical events, 2 failed logins (within threshold), all API endpoints healthy.",
                            CreatedAt = DateTime.UtcNow.AddDays(-1),
                            IsRead = true,
                            ActionUrl = "/notifications",
                            ActionLabel = "View Full Report",
                            Source = "Security Monitor"
                        }
                    };

                    context.AdminNotifications.AddRange(adminNotifications);
                    context.SaveChanges();
                    Console.WriteLine("✅ AdminNotifications table seeded with 7 realistic entries.");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Seeder Warning: Could not seed AdminNotifications: {ex.Message}");
            }

            // Seed SecurityAuditLogs if none exist
            try
            {
                if (!context.SecurityAuditLogs.Any())
                {
                    var securityLogs = new[]
                    {
                        new SecurityAuditLog
                        {
                            EventType = "failed_login_burst",
                            Severity = "critical",
                            Description = "7 consecutive failed login attempts from IP 103.92.41.xx targeting admin@legalconnect.com.",
                            IpAddress = "103.92.41.xx",
                            UserAgent = "Mozilla/5.0 (Windows NT 10.0; rv:109.0) Gecko/20100101 Firefox/115.0",
                            Metadata = "{\"targetEmail\":\"admin@legalconnect.com\",\"attempts\":7,\"windowMinutes\":3}",
                            CreatedAt = DateTime.UtcNow.AddMinutes(-45)
                        },
                        new SecurityAuditLog
                        {
                            EventType = "2fa_disabled",
                            Severity = "warning",
                            Description = "User rajesh.kumar@email.com disabled Two-Factor Authentication.",
                            IpAddress = "192.168.1.105",
                            Metadata = "{\"userId\":14,\"email\":\"rajesh.kumar@email.com\"}",
                            CreatedAt = DateTime.UtcNow.AddHours(-2)
                        },
                        new SecurityAuditLog
                        {
                            EventType = "failed_login",
                            Severity = "info",
                            Description = "Failed login attempt for user test@example.com.",
                            IpAddress = "10.0.0.22",
                            CreatedAt = DateTime.UtcNow.AddHours(-8)
                        }
                    };

                    context.SecurityAuditLogs.AddRange(securityLogs);
                    context.SaveChanges();
                    Console.WriteLine("✅ SecurityAuditLogs table seeded with 3 entries.");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Seeder Warning: Could not seed SecurityAuditLogs: {ex.Message}");
            }
        }

        private static void EnsureAdminNotificationsTableExists(AppDbContext context)
        {
            try
            {
                var sql = @"
                    CREATE TABLE IF NOT EXISTS `AdminNotifications` (
                        `Id` int NOT NULL AUTO_INCREMENT,
                        `RecipientUserId` int NULL,
                        `TargetRole` varchar(50) NOT NULL DEFAULT 'All',
                        `Type` varchar(50) NOT NULL DEFAULT 'announcement',
                        `Severity` varchar(20) NOT NULL DEFAULT 'info',
                        `Category` varchar(50) NOT NULL DEFAULT 'announcement',
                        `Title` varchar(300) NOT NULL,
                        `Message` varchar(2000) NOT NULL,
                        `DetailsMarkdown` longtext NULL,
                        `CreatedAt` datetime(6) NOT NULL,
                        `IsRead` tinyint(1) NOT NULL DEFAULT 0,
                        `IsStarred` tinyint(1) NOT NULL DEFAULT 0,
                        `IsArchived` tinyint(1) NOT NULL DEFAULT 0,
                        `ActionUrl` varchar(500) NULL,
                        `ActionLabel` varchar(100) NULL,
                        `Source` varchar(100) NULL,
                        `RelatedEntityType` varchar(100) NULL,
                        `RelatedEntityId` int NULL,
                        `ReadAt` datetime(6) NULL,
                        `ReadByUserId` int NULL,
                        PRIMARY KEY (`Id`)
                    );";
                context.Database.ExecuteSqlRaw(sql);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Seeder Notice: Could not ensure AdminNotifications table: {ex.Message}");
            }
        }

        private static void EnsureSecurityAuditLogsTableExists(AppDbContext context)
        {
            try
            {
                var sql = @"
                    CREATE TABLE IF NOT EXISTS `SecurityAuditLogs` (
                        `Id` int NOT NULL AUTO_INCREMENT,
                        `UserId` int NULL,
                        `EventType` varchar(50) NOT NULL,
                        `Severity` varchar(20) NOT NULL DEFAULT 'info',
                        `Description` varchar(1000) NOT NULL,
                        `IpAddress` varchar(50) NULL,
                        `UserAgent` varchar(500) NULL,
                        `Metadata` longtext NULL,
                        `CreatedAt` datetime(6) NOT NULL,
                        PRIMARY KEY (`Id`)
                    );";
                context.Database.ExecuteSqlRaw(sql);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Seeder Notice: Could not ensure SecurityAuditLogs table: {ex.Message}");
            }
        }

        private static void EnsureColumnExists(AppDbContext context, string tableName, string columnName, string columnDefinition)
        {
            try
            {
                var conn = context.Database.GetDbConnection();
                bool wasOpen = conn.State == System.Data.ConnectionState.Open;
                if (!wasOpen) conn.Open();

                using var cmd = conn.CreateCommand();
                cmd.CommandText = "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = @tableName AND column_name = @columnName";

                var p1 = cmd.CreateParameter();
                p1.ParameterName = "@tableName";
                p1.Value = tableName;
                cmd.Parameters.Add(p1);

                var p2 = cmd.CreateParameter();
                p2.ParameterName = "@columnName";
                p2.Value = columnName;
                cmd.Parameters.Add(p2);

                var count = Convert.ToInt32(cmd.ExecuteScalar());
                if (!wasOpen) conn.Close();

                if (count == 0)
                {
                    string alterSql = string.Format("ALTER TABLE `{0}` ADD COLUMN `{1}` {2};", tableName, columnName, columnDefinition);
                    context.Database.ExecuteSqlRaw(alterSql);
                }
            }
            catch
            {
                // Ignore if schema check fails or column exists
            }
        }

        public static void SynchronizeEFMigrationsHistory(AppDbContext context)
        {
            try
            {
                var conn = context.Database.GetDbConnection();
                bool wasOpen = conn.State == System.Data.ConnectionState.Open;
                if (!wasOpen) conn.Open();

                using var cmd = conn.CreateCommand();
                cmd.CommandText = @"
                    CREATE TABLE IF NOT EXISTS `__EFMigrationsHistory` (
                        `MigrationId` varchar(150) CHARACTER SET utf8mb4 NOT NULL,
                        `ProductVersion` varchar(32) CHARACTER SET utf8mb4 NOT NULL,
                        PRIMARY KEY (`MigrationId`)
                    );";
                cmd.ExecuteNonQuery();

                // If Users table already has AuthProvider column, mark 20260728162946_AddTwoFactorBackupCodes as applied in EF history table
                using var checkCmd = conn.CreateCommand();
                checkCmd.CommandText = "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'Users' AND column_name = 'AuthProvider'";
                var colCount = Convert.ToInt32(checkCmd.ExecuteScalar());

                if (colCount > 0)
                {
                    using var markCmd = conn.CreateCommand();
                    markCmd.CommandText = "INSERT IGNORE INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`) VALUES ('20260728162946_AddTwoFactorBackupCodes', '8.0.4');";
                    markCmd.ExecuteNonQuery();
                }

                if (!wasOpen) conn.Close();
            }
            catch
            {
                // Silently ignore if connection/table check fails
            }
        }
    }
}