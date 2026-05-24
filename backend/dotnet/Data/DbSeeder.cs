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
                        CreatedAt = DateTime.UtcNow
                    };

                    context.Users.Add(user);
                    context.SaveChanges(); // Save to get the generated Id

                    var profile = new LawyerProfile
                    {
                        UserId = user.Id,
                        BarCouncilNumber = "BCI/SEED/" + user.Id,
                        Specialization = l.Specialization,
                        ExperienceYears = l.Experience,
                        IsVerified = true, // Pre-seeded default advocates are verified by default
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
        }
    }
}
