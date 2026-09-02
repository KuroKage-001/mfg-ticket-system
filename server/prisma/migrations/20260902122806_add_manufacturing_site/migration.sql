-- AlterTable
ALTER TABLE `tickets` ADD COLUMN `manufacturing_site` ENUM('ADCV', 'ADGT', 'ADPG', 'ADTH') NULL;
