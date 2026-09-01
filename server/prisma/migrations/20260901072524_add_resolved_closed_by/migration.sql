-- AlterTable
ALTER TABLE `tickets` ADD COLUMN `closed_by_id` INTEGER NULL,
    ADD COLUMN `resolved_by_id` INTEGER NULL;

-- CreateIndex
CREATE INDEX `tickets_resolved_by_id_idx` ON `tickets`(`resolved_by_id`);

-- CreateIndex
CREATE INDEX `tickets_closed_by_id_idx` ON `tickets`(`closed_by_id`);

-- AddForeignKey
ALTER TABLE `tickets` ADD CONSTRAINT `tickets_resolved_by_id_fkey` FOREIGN KEY (`resolved_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tickets` ADD CONSTRAINT `tickets_closed_by_id_fkey` FOREIGN KEY (`closed_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
