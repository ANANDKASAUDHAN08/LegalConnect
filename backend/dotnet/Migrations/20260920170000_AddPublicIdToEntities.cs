using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CoreApi.Migrations
{
    /// <inheritdoc />
    public partial class AddPublicIdToEntities : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 1. Users table
            migrationBuilder.AddColumn<string>(
                name: "PublicId",
                table: "Users",
                type: "varchar(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.Sql("UPDATE `Users` SET `PublicId` = CONCAT('usr_', SUBSTRING(MD5(CONCAT(UUID(), `Id`, NOW())), 1, 16)) WHERE `PublicId` = '' OR `PublicId` IS NULL;");

            migrationBuilder.CreateIndex(
                name: "IX_Users_PublicId",
                table: "Users",
                column: "PublicId",
                unique: true);

            // 2. LawyerProfiles table
            migrationBuilder.AddColumn<string>(
                name: "PublicId",
                table: "LawyerProfiles",
                type: "varchar(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.Sql("UPDATE `LawyerProfiles` SET `PublicId` = CONCAT('law_', SUBSTRING(MD5(CONCAT(UUID(), `Id`, NOW())), 1, 16)) WHERE `PublicId` = '' OR `PublicId` IS NULL;");

            migrationBuilder.CreateIndex(
                name: "IX_LawyerProfiles_PublicId",
                table: "LawyerProfiles",
                column: "PublicId",
                unique: true);

            // 3. Consultations table
            migrationBuilder.AddColumn<string>(
                name: "PublicId",
                table: "Consultations",
                type: "varchar(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.Sql("UPDATE `Consultations` SET `PublicId` = CONCAT('inq_', SUBSTRING(MD5(CONCAT(UUID(), `Id`, NOW())), 1, 16)) WHERE `PublicId` = '' OR `PublicId` IS NULL;");

            migrationBuilder.CreateIndex(
                name: "IX_Consultations_PublicId",
                table: "Consultations",
                column: "PublicId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(name: "IX_Users_PublicId", table: "Users");
            migrationBuilder.DropColumn(name: "PublicId", table: "Users");

            migrationBuilder.DropIndex(name: "IX_LawyerProfiles_PublicId", table: "LawyerProfiles");
            migrationBuilder.DropColumn(name: "PublicId", table: "LawyerProfiles");

            migrationBuilder.DropIndex(name: "IX_Consultations_PublicId", table: "Consultations");
            migrationBuilder.DropColumn(name: "PublicId", table: "Consultations");
        }
    }
}