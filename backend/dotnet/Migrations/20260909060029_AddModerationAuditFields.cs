using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CoreApi.Migrations
{
    /// <inheritdoc />
    public partial class AddModerationAuditFields : Migration
    {
        /// <inheritdoc />
        /// <remarks>
        /// WARNING: The EvidenceUrl column change from varchar(500) to longtext is IRREVERSIBLE.
        /// The Down() migration will truncate EvidenceUrl data back to 500 chars,
        /// which silently DESTROYS evidence data longer than 500 characters.
        /// Do NOT roll back this migration in production without a data backup plan.
        /// </remarks>
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "RelatedReportId",
                table: "SecurityAuditLogs",
                type: "bigint",
                nullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "EvidenceUrl",
                table: "ContentReports",
                type: "longtext",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "varchar(500)",
                oldMaxLength: 500,
                oldNullable: true)
                .Annotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "AssignedAdminEmail",
                table: "ContentReports",
                type: "varchar(100)",
                maxLength: 100,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<DateTime>(
                name: "AssignedAt",
                table: "ContentReports",
                type: "datetime(6)",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_SecurityAuditLogs_EventType",
                table: "SecurityAuditLogs",
                column: "EventType");

            migrationBuilder.CreateIndex(
                name: "IX_SecurityAuditLogs_RelatedReportId",
                table: "SecurityAuditLogs",
                column: "RelatedReportId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_SecurityAuditLogs_EventType",
                table: "SecurityAuditLogs");

            migrationBuilder.DropIndex(
                name: "IX_SecurityAuditLogs_RelatedReportId",
                table: "SecurityAuditLogs");

            migrationBuilder.DropColumn(
                name: "RelatedReportId",
                table: "SecurityAuditLogs");

            migrationBuilder.DropColumn(
                name: "AssignedAdminEmail",
                table: "ContentReports");

            migrationBuilder.DropColumn(
                name: "AssignedAt",
                table: "ContentReports");

            migrationBuilder.AlterColumn<string>(
                name: "EvidenceUrl",
                table: "ContentReports",
                type: "varchar(500)",
                maxLength: 500,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "longtext",
                oldNullable: true)
                .Annotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("MySql:CharSet", "utf8mb4");
        }
    }
}
