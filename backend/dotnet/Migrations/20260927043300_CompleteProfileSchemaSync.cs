using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CoreApi.Migrations
{
    /// <inheritdoc />
    public partial class CompleteProfileSchemaSync : Migration
    {
        private static void SafeAddColumn(MigrationBuilder mb, string table, string column, string ddl)
        {
            var escapedDdl = ddl.Replace("'", "''");
            mb.Sql($@"
                SET @col_exists = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = '{table}' AND column_name = '{column}');
                SET @sql = IF(@col_exists = 0, 'ALTER TABLE `{table}` ADD COLUMN `{column}` {escapedDdl}', 'SELECT 1');
                PREPARE stmt FROM @sql;
                EXECUTE stmt;
                DEALLOCATE PREPARE stmt;
            ");
        }

        private static void SafeDropColumn(MigrationBuilder mb, string table, string column)
        {
            mb.Sql($@"
                SET @col_exists = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = '{table}' AND column_name = '{column}');
                SET @sql = IF(@col_exists > 0, 'ALTER TABLE `{table}` DROP COLUMN `{column}`', 'SELECT 1');
                PREPARE stmt FROM @sql;
                EXECUTE stmt;
                DEALLOCATE PREPARE stmt;
            ");
        }

        private static void SafeCreateIndex(MigrationBuilder mb, string table, string indexName, string column)
        {
            mb.Sql($@"
                SET @idx_exists = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = '{table}' AND index_name = '{indexName}');
                SET @sql = IF(@idx_exists = 0, 'CREATE UNIQUE INDEX `{indexName}` ON `{table}` (`{column}`)', 'SELECT 1');
                PREPARE stmt FROM @sql;
                EXECUTE stmt;
                DEALLOCATE PREPARE stmt;
            ");
        }

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Drop deprecated columns safely
            SafeDropColumn(migrationBuilder, "Users", "ClientInterest");
            SafeDropColumn(migrationBuilder, "Users", "Pronouns");
            SafeDropColumn(migrationBuilder, "Users", "EmergencyContactName");
            SafeDropColumn(migrationBuilder, "Users", "EmergencyContactPhone");
            SafeDropColumn(migrationBuilder, "Users", "EmergencyContactRelation");
            SafeDropColumn(migrationBuilder, "Users", "CorporateRfpOpen");
            SafeDropColumn(migrationBuilder, "Users", "LegalBudgetCeiling");
            SafeDropColumn(migrationBuilder, "LawyerProfiles", "DirectoryRankingsJson");
            SafeDropColumn(migrationBuilder, "LawyerProfiles", "RepresentativeMattersJson");

            // Add new / synchronized columns to Users
            SafeAddColumn(migrationBuilder, "Users", "LegalEntityName", "VARCHAR(200) NULL");
            SafeAddColumn(migrationBuilder, "Users", "SpecialStatus", "VARCHAR(100) NULL DEFAULT 'Standard Citizen'");
            SafeAddColumn(migrationBuilder, "Users", "IsSearchIndexable", "TINYINT(1) NOT NULL DEFAULT 1");
            SafeAddColumn(migrationBuilder, "Users", "IsCorporateEntity", "TINYINT(1) NOT NULL DEFAULT 0");
            SafeAddColumn(migrationBuilder, "Users", "IsBanned", "TINYINT(1) NOT NULL DEFAULT 0");
            SafeAddColumn(migrationBuilder, "Users", "IsDeleted", "TINYINT(1) NOT NULL DEFAULT 0");
            SafeAddColumn(migrationBuilder, "Users", "IsDeactivatedByUser", "TINYINT(1) NOT NULL DEFAULT 0");
            SafeAddColumn(migrationBuilder, "Users", "NotifyWhatsAppEnabled", "TINYINT(1) NOT NULL DEFAULT 0");
            SafeAddColumn(migrationBuilder, "Users", "WhatsAppPhone", "VARCHAR(30) NULL");
            SafeAddColumn(migrationBuilder, "Users", "PublicId", "VARCHAR(50) NULL");
            SafeAddColumn(migrationBuilder, "Users", "CIN", "VARCHAR(25) NULL");
            SafeAddColumn(migrationBuilder, "Users", "CompanySize", "VARCHAR(30) NULL");
            SafeAddColumn(migrationBuilder, "Users", "Currency", "VARCHAR(5) NOT NULL DEFAULT 'INR'");
            SafeAddColumn(migrationBuilder, "Users", "DpoContactEmail", "VARCHAR(150) NULL");
            SafeAddColumn(migrationBuilder, "Users", "DpoContactName", "VARCHAR(100) NULL");
            SafeAddColumn(migrationBuilder, "Users", "EntityType", "VARCHAR(50) NULL");
            SafeAddColumn(migrationBuilder, "Users", "Gstin", "VARCHAR(20) NULL");
            SafeAddColumn(migrationBuilder, "Users", "IncorporationNumber", "VARCHAR(50) NULL");
            SafeAddColumn(migrationBuilder, "Users", "IndustryVertical", "VARCHAR(100) NULL");
            SafeAddColumn(migrationBuilder, "Users", "MsaAccepted", "TINYINT(1) NOT NULL DEFAULT 0");
            SafeAddColumn(migrationBuilder, "Users", "MsaAcceptedAt", "DATETIME(6) NULL");
            SafeAddColumn(migrationBuilder, "Users", "PanNumber", "VARCHAR(10) NULL");

            // Add new / synchronized columns to LawyerProfiles
            SafeAddColumn(migrationBuilder, "LawyerProfiles", "PublicId", "VARCHAR(50) NULL");
            SafeAddColumn(migrationBuilder, "LawyerProfiles", "ConflictCheckRequired", "TINYINT(1) NOT NULL DEFAULT 0");
            SafeAddColumn(migrationBuilder, "LawyerProfiles", "Currency", "VARCHAR(5) NOT NULL DEFAULT 'INR'");
            SafeAddColumn(migrationBuilder, "LawyerProfiles", "GstinLawyer", "VARCHAR(20) NULL");
            SafeAddColumn(migrationBuilder, "LawyerProfiles", "HourlyRate", "DECIMAL(18,2) NULL");
            SafeAddColumn(migrationBuilder, "LawyerProfiles", "LawFirmName", "VARCHAR(200) NULL");
            SafeAddColumn(migrationBuilder, "LawyerProfiles", "MsaAccepted", "TINYINT(1) NOT NULL DEFAULT 0");
            SafeAddColumn(migrationBuilder, "LawyerProfiles", "PracticeStructure", "VARCHAR(50) NULL");
            SafeAddColumn(migrationBuilder, "LawyerProfiles", "ProfessionalIndemnityCoverage", "DECIMAL(18,2) NULL");
            SafeAddColumn(migrationBuilder, "LawyerProfiles", "ProfessionalIndemnityExpiryDate", "DATETIME(6) NULL");
            SafeAddColumn(migrationBuilder, "LawyerProfiles", "ProfessionalIndemnityInsurer", "VARCHAR(150) NULL");
            SafeAddColumn(migrationBuilder, "LawyerProfiles", "ProfessionalIndemnityPolicyNo", "VARCHAR(80) NULL");
            SafeAddColumn(migrationBuilder, "LawyerProfiles", "RetainerFee", "DECIMAL(18,2) NULL");
            SafeAddColumn(migrationBuilder, "LawyerProfiles", "StateBarCouncil", "VARCHAR(100) NULL");

            // Add new / synchronized columns to Consultations
            SafeAddColumn(migrationBuilder, "Consultations", "PublicId", "VARCHAR(50) NULL");

            // Backfill PublicId values for any records missing them
            migrationBuilder.Sql("UPDATE `Users` SET `PublicId` = CONCAT('usr_', SUBSTRING(MD5(CONCAT(Id, Email, NOW())), 1, 16)) WHERE `PublicId` IS NULL OR `PublicId` = '';");
            migrationBuilder.Sql("UPDATE `LawyerProfiles` SET `PublicId` = CONCAT('law_', SUBSTRING(MD5(CONCAT(Id, UserId, NOW())), 1, 16)) WHERE `PublicId` IS NULL OR `PublicId` = '';");
            migrationBuilder.Sql("UPDATE `Consultations` SET `PublicId` = CONCAT('inq_', SUBSTRING(MD5(CONCAT(Id, ClientEmail, NOW())), 1, 16)) WHERE `PublicId` IS NULL OR `PublicId` = '';");

            // Backfill metric zeroing
            migrationBuilder.Sql("UPDATE `LawyerProfiles` SET `CasesCompleted` = 0 WHERE `CasesCompleted` = 150;");
            migrationBuilder.Sql("UPDATE `LawyerProfiles` SET `SuccessRate` = 0 WHERE `SuccessRate` = 95;");

            // Create Unique Indexes safely
            SafeCreateIndex(migrationBuilder, "Users", "IX_Users_PublicId", "PublicId");
            SafeCreateIndex(migrationBuilder, "LawyerProfiles", "IX_LawyerProfiles_PublicId", "PublicId");
            SafeCreateIndex(migrationBuilder, "Consultations", "IX_Consultations_PublicId", "PublicId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            SafeDropColumn(migrationBuilder, "Users", "CIN");
            SafeDropColumn(migrationBuilder, "Users", "CompanySize");
            SafeDropColumn(migrationBuilder, "Users", "Currency");
            SafeDropColumn(migrationBuilder, "Users", "DpoContactEmail");
            SafeDropColumn(migrationBuilder, "Users", "DpoContactName");
            SafeDropColumn(migrationBuilder, "Users", "EntityType");
            SafeDropColumn(migrationBuilder, "Users", "Gstin");
            SafeDropColumn(migrationBuilder, "Users", "IncorporationNumber");
            SafeDropColumn(migrationBuilder, "Users", "IndustryVertical");
            SafeDropColumn(migrationBuilder, "Users", "IsBanned");
            SafeDropColumn(migrationBuilder, "Users", "IsCorporateEntity");
            SafeDropColumn(migrationBuilder, "Users", "IsDeactivatedByUser");
            SafeDropColumn(migrationBuilder, "Users", "IsDeleted");
            SafeDropColumn(migrationBuilder, "Users", "MsaAccepted");
            SafeDropColumn(migrationBuilder, "Users", "MsaAcceptedAt");
            SafeDropColumn(migrationBuilder, "Users", "PanNumber");
        }
    }
}
