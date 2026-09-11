using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CoreApi.Migrations
{
    /// <inheritdoc />
    public partial class AddContentReportPerformanceIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_ContentReports_AssignedAdminEmail",
                table: "ContentReports",
                column: "AssignedAdminEmail");

            migrationBuilder.CreateIndex(
                name: "IX_ContentReports_Status_Severity_CreatedAt",
                table: "ContentReports",
                columns: new[] { "Status", "Severity", "CreatedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_ContentReports_AssignedAdminEmail",
                table: "ContentReports");

            migrationBuilder.DropIndex(
                name: "IX_ContentReports_Status_Severity_CreatedAt",
                table: "ContentReports");
        }
    }
}
