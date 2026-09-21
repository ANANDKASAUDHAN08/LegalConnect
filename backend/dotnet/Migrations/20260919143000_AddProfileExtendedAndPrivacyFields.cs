using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CoreApi.Migrations
{
    /// <inheritdoc />
    public partial class AddProfileExtendedAndPrivacyFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Pronouns",
                table: "Users",
                type: "varchar(50)",
                maxLength: 50,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "SpecialStatus",
                table: "Users",
                type: "varchar(100)",
                maxLength: 100,
                nullable: true,
                defaultValue: "Standard Citizen")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "LegalEntityName",
                table: "Users",
                type: "varchar(200)",
                maxLength: 200,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "EmergencyContactName",
                table: "Users",
                type: "varchar(100)",
                maxLength: 100,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "EmergencyContactPhone",
                table: "Users",
                type: "varchar(30)",
                maxLength: 30,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "EmergencyContactRelation",
                table: "Users",
                type: "varchar(100)",
                maxLength: 100,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<bool>(
                name: "CorporateRfpOpen",
                table: "Users",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsSearchIndexable",
                table: "Users",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsCorporateEntity",
                table: "Users",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "Pronouns", table: "Users");
            migrationBuilder.DropColumn(name: "SpecialStatus", table: "Users");
            migrationBuilder.DropColumn(name: "LegalEntityName", table: "Users");
            migrationBuilder.DropColumn(name: "EmergencyContactName", table: "Users");
            migrationBuilder.DropColumn(name: "EmergencyContactPhone", table: "Users");
            migrationBuilder.DropColumn(name: "EmergencyContactRelation", table: "Users");
            migrationBuilder.DropColumn(name: "CorporateRfpOpen", table: "Users");
            migrationBuilder.DropColumn(name: "IsSearchIndexable", table: "Users");
            migrationBuilder.DropColumn(name: "IsCorporateEntity", table: "Users");
        }
    }
}