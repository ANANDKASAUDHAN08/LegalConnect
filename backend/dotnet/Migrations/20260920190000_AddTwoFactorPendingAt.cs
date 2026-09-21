using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CoreApi.Migrations
{
    /// <inheritdoc />
    public partial class AddTwoFactorPendingAt : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "TwoFactorPendingAt",
                table: "Users",
                type: "datetime(6)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "TwoFactorPendingAt",
                table: "Users");
        }
    }
}