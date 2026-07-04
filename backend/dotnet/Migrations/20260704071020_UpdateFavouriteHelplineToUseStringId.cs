using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CoreApi.Migrations
{
    /// <inheritdoc />
    public partial class UpdateFavouriteHelplineToUseStringId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_FavouriteHelplines_Helplines_HelplineId",
                table: "FavouriteHelplines");

            migrationBuilder.DropIndex(
                name: "IX_FavouriteHelplines_HelplineId",
                table: "FavouriteHelplines");

            migrationBuilder.AlterColumn<string>(
                name: "HelplineId",
                table: "FavouriteHelplines",
                type: "varchar(255)",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "int")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "HelplineName",
                table: "FavouriteHelplines",
                type: "longtext",
                nullable: false)
                .Annotation("MySql:CharSet", "utf8mb4");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "HelplineName",
                table: "FavouriteHelplines");

            migrationBuilder.AlterColumn<int>(
                name: "HelplineId",
                table: "FavouriteHelplines",
                type: "int",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "varchar(255)")
                .OldAnnotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_FavouriteHelplines_HelplineId",
                table: "FavouriteHelplines",
                column: "HelplineId");

            migrationBuilder.AddForeignKey(
                name: "FK_FavouriteHelplines_Helplines_HelplineId",
                table: "FavouriteHelplines",
                column: "HelplineId",
                principalTable: "Helplines",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
