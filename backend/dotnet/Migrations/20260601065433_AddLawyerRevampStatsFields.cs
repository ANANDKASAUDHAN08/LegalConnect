using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CoreApi.Migrations
{
    /// <inheritdoc />
    public partial class AddLawyerRevampStatsFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "CasesCompleted",
                table: "LawyerProfiles",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<decimal>(
                name: "InPersonFee",
                table: "LawyerProfiles",
                type: "decimal(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<int>(
                name: "SuccessRate",
                table: "LawyerProfiles",
                type: "int",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CasesCompleted",
                table: "LawyerProfiles");

            migrationBuilder.DropColumn(
                name: "InPersonFee",
                table: "LawyerProfiles");

            migrationBuilder.DropColumn(
                name: "SuccessRate",
                table: "LawyerProfiles");
        }
    }
}
