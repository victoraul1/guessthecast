-- MySQL schema for the Guess the Cast 20 Club.
-- Select the guessthecast database before running this file.

CREATE TABLE IF NOT EXISTS winners (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    username VARCHAR(24) NOT NULL,
    ip_hash CHAR(64) NOT NULL,
    user_agent_hash CHAR(64) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_winners_created (created_at, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
