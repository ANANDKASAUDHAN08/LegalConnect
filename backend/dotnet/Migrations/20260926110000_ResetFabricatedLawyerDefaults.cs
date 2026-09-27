using System;
using CoreApi.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CoreApi.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260926110000_ResetFabricatedLawyerDefaults")]
    public partial class ResetFabricatedLawyerDefaults : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("UPDATE LawyerProfiles SET CasesCompleted = 0 WHERE CasesCompleted = 150;");
            migrationBuilder.Sql("UPDATE LawyerProfiles SET SuccessRate = 0 WHERE SuccessRate = 95;");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Resetting fabricated test defaults to 0 is irreversible by design
        }
    }
}