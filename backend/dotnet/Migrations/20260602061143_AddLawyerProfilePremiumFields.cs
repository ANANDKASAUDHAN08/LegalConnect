using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CoreApi.Migrations
{
    /// <inheritdoc />
    public partial class AddLawyerProfilePremiumFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AccoladesJson",
                table: "LawyerProfiles",
                type: "longtext",
                nullable: false)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "ActiveCourts",
                table: "LawyerProfiles",
                type: "varchar(500)",
                maxLength: 500,
                nullable: false,
                defaultValue: "")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "CasesJson",
                table: "LawyerProfiles",
                type: "longtext",
                nullable: false)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "FaqsJson",
                table: "LawyerProfiles",
                type: "longtext",
                nullable: false)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "ResponseTime",
                table: "LawyerProfiles",
                type: "varchar(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "SocialLinksJson",
                table: "LawyerProfiles",
                type: "longtext",
                nullable: false)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "TimeSlotsJson",
                table: "LawyerProfiles",
                type: "longtext",
                nullable: false)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "WorkingHours",
                table: "LawyerProfiles",
                type: "varchar(200)",
                maxLength: 200,
                nullable: false,
                defaultValue: "")
                .Annotation("MySql:CharSet", "utf8mb4");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AccoladesJson",
                table: "LawyerProfiles");

            migrationBuilder.DropColumn(
                name: "ActiveCourts",
                table: "LawyerProfiles");

            migrationBuilder.DropColumn(
                name: "CasesJson",
                table: "LawyerProfiles");

            migrationBuilder.DropColumn(
                name: "FaqsJson",
                table: "LawyerProfiles");

            migrationBuilder.DropColumn(
                name: "ResponseTime",
                table: "LawyerProfiles");

            migrationBuilder.DropColumn(
                name: "SocialLinksJson",
                table: "LawyerProfiles");

            migrationBuilder.DropColumn(
                name: "TimeSlotsJson",
                table: "LawyerProfiles");

            migrationBuilder.DropColumn(
                name: "WorkingHours",
                table: "LawyerProfiles");
        }
    }
}
