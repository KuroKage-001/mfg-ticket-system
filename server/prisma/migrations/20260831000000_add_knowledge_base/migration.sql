-- CreateTable
CREATE TABLE `knowledge_base` (
    `id`            INTEGER      NOT NULL AUTO_INCREMENT,
    `title`         VARCHAR(255) NOT NULL,
    `filename`      VARCHAR(255) NOT NULL,
    `original_name` VARCHAR(255) NOT NULL,
    `file_type`     VARCHAR(100) NOT NULL,
    `url`           VARCHAR(500) NOT NULL,
    `uploaded_by_id` INTEGER     NOT NULL,
    `created_at`    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `knowledge_base_uploaded_by_id_idx`(`uploaded_by_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `knowledge_base`
    ADD CONSTRAINT `knowledge_base_uploaded_by_id_fkey`
    FOREIGN KEY (`uploaded_by_id`) REFERENCES `users`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;
