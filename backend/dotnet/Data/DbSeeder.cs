using System;
using System.Linq;
using CoreApi.Models;

namespace CoreApi.Data
{
    public static class DbSeeder
    {
        public static void Seed(AppDbContext context)
        {
            // Seed 12 default lawyers in MySQL if they do not exist
            var seededLawyers = new[]
            {
                new { Name = "Adv. Priya Sharma", Email = "priya.sharma@legalconnect.in", Specialization = "Criminal Law, Cyber Crime", Experience = 12 },
                new { Name = "Adv. Rajesh Kumar", Email = "rajesh.kumar@legalconnect.in", Specialization = "Civil Law, Property Disputes, Contract Law", Experience = 18 },
                new { Name = "Adv. Sunita Mehta", Email = "sunita.mehta@legalconnect.in", Specialization = "Family Law, Divorce, Child Custody", Experience = 9 },
                new { Name = "Adv. Amit Verma", Email = "amit.verma@legalconnect.in", Specialization = "Corporate Law, Mergers & Acquisitions, Contract Law", Experience = 15 },
                new { Name = "Adv. Kavita Nair", Email = "kavita.nair@legalconnect.in", Specialization = "Consumer Law, RTI, Public Interest Litigation", Experience = 11 },
                new { Name = "Adv. Sanjay Patel", Email = "sanjay.patel@legalconnect.in", Specialization = "Labour Law, Employment Disputes, Industrial Law", Experience = 20 },
                new { Name = "Adv. Neha Gupta", Email = "neha.gupta@legalconnect.in", Specialization = "Intellectual Property, Trademark, Copyright", Experience = 8 },
                new { Name = "Adv. Arjun Singh", Email = "arjun.singh@legalconnect.in", Specialization = "Criminal Law, NDPS Cases, Bail Matters", Experience = 14 },
                new { Name = "Adv. Divya Reddy", Email = "divya.reddy@legalconnect.in", Specialization = "Tax Law, GST, Income Tax Disputes", Experience = 16 },
                new { Name = "Adv. Manish Tiwari", Email = "manish.tiwari@legalconnect.in", Specialization = "Real Estate Law, Property Disputes, RERA", Experience = 13 },
                new { Name = "Adv. Pooja Iyer", Email = "pooja.iyer@legalconnect.in", Specialization = "Cyber Crime, Data Privacy, IT Law", Experience = 7 },
                new { Name = "Adv. Vikram Malhotra", Email = "vikram.malhotra@legalconnect.in", Specialization = "Immigration Law, Visa Matters, Citizenship", Experience = 22 }
            };

            bool changed = false;

            foreach (var l in seededLawyers)
            {
                if (!context.Users.Any(u => u.Email == l.Email))
                {
                    var user = new User
                    {
                        FullName = l.Name,
                        Email = l.Email,
                        PasswordHash = BCrypt.Net.BCrypt.HashPassword("password123"),
                        Role = "Lawyer",
                        IsEmailVerified = true,
                        IsPhoneVerified = true,
                        CreatedAt = DateTime.UtcNow
                    };

                    context.Users.Add(user);
                    context.SaveChanges(); // Save to get the generated Id

                    // Update phone with unique generated Id
                    user.Phone = $"+91 98765 {user.Id:D5}";
                    context.SaveChanges();

                    var profile = new LawyerProfile
                    {
                        UserId = user.Id,
                        BarCouncilNumber = "BCI/SEED/" + user.Id,
                        Specialization = l.Specialization,
                        ExperienceYears = l.Experience,
                        IsVerified = true, // Pre-seeded default advocates are verified by default
                        City = "Mumbai",
                        Bio = $"Pre-seeded professional advocate specializing in {l.Specialization}.",
                        Phone = user.Phone ?? string.Empty,
                        ConsultationFee = 1500.00m,
                        OfficeAddress = $"Suite {100 + user.Id}, Legal Chambers, High Court Road",
                        Education = "LL.B., National Law School",
                        LanguagesSpoken = "English, Hindi",
                        IsAvailable = true,
                        UpdatedAt = DateTime.UtcNow
                    };

                    context.LawyerProfiles.Add(profile);
                    changed = true;
                }
            }

            if (changed)
            {
                context.SaveChanges();
            }

            // Verify any existing lawyers that were registered before the fix
            var unverifiedProfiles = context.LawyerProfiles.Where(p => !p.IsVerified).ToList();
            if (unverifiedProfiles.Any())
            {
                foreach (var profile in unverifiedProfiles)
                {
                    profile.IsVerified = true;
                }
                context.SaveChanges();
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
        }
    }
}

