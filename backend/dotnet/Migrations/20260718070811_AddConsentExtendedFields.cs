using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CoreApi.Migrations
{
    /// <inheritdoc />
    public partial class AddConsentExtendedFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "AnalyticsConsentedAt",
                table: "ConsentPreferences",
                type: "datetime(6)",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "MarketingConsentedAt",
                table: "ConsentPreferences",
                type: "datetime(6)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PolicyVersion",
                table: "ConsentPreferences",
                type: "varchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "")
                .Annotation("MySql:CharSet", "utf8mb4");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AnalyticsConsentedAt",
                table: "ConsentPreferences");

            migrationBuilder.DropColumn(
                name: "MarketingConsentedAt",
                table: "ConsentPreferences");

            migrationBuilder.DropColumn(
                name: "PolicyVersion",
                table: "ConsentPreferences");
        }
    }
}
