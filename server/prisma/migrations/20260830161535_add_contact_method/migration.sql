-- AlterTable
ALTER TABLE `tickets` ADD COLUMN `contact_method` ENUM('EMAIL', 'PHONE', 'TEAMS') NULL;
