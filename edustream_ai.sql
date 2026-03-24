-- ============================================================
--  EduStream AI — Full Database Setup
--  Run this entire file in phpMyAdmin → SQL tab
--  Database: edustream_ai  |  MariaDB / MySQL
-- ============================================================

CREATE DATABASE IF NOT EXISTS `edustream_ai`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `edustream_ai`;

-- ─────────────────────────────────────────────────────────────
--  1. CATEGORIES
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `categories` (
  `id`   INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100)     NOT NULL,
  `slug` VARCHAR(100)     NOT NULL,
  `icon` VARCHAR(60)      NOT NULL DEFAULT 'bi-folder',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────
--  2. RESOURCES
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `resources` (
  `id`               INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  `category_id`      INT UNSIGNED     NOT NULL,
  `title`            VARCHAR(255)     NOT NULL,
  `url`              VARCHAR(2048)    NOT NULL,
  `description`      TEXT,
  `difficulty_level` ENUM('Beginner','Intermediate','Advanced') NOT NULL DEFAULT 'Beginner',
  `resource_type`    ENUM('Article','Video','Course','Book','Tool')  NOT NULL DEFAULT 'Article',
  `author`           VARCHAR(150),
  `tags`             VARCHAR(500),
  `created_at`       TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_category` (`category_id`),
  CONSTRAINT `fk_res_cat`
    FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────
--  3. USERS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `users` (
  `id`                   INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `username`             VARCHAR(80)   NOT NULL,
  `email`                VARCHAR(180)  NOT NULL,
  `password_hash`        VARCHAR(255)  NOT NULL,
  `preferred_difficulty` ENUM('Beginner','Intermediate','Advanced') DEFAULT 'Beginner',
  `created_at`           TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_username` (`username`),
  UNIQUE KEY `uq_email`    (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────
--  4. USER_PROGRESS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `user_progress` (
  `id`          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `user_id`     INT UNSIGNED  NOT NULL,
  `resource_id` INT UNSIGNED  NOT NULL,
  `status`      ENUM('Saved','In Progress','Completed') NOT NULL DEFAULT 'Saved',
  `updated_at`  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
                              ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_resource` (`user_id`, `resource_id`),
  CONSTRAINT `fk_prog_user`
    FOREIGN KEY (`user_id`)     REFERENCES `users`     (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_prog_res`
    FOREIGN KEY (`resource_id`) REFERENCES `resources` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────
--  5. FEEDBACK (Fixed Version)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `feedback` (
  `id`                INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `user_id`           INT UNSIGNED  NOT NULL,
  `resource_id`       INT UNSIGNED  NOT NULL,
  /* Moving CHECK constraints directly to columns for better compatibility */
  `content_relevance` TINYINT UNSIGNED NOT NULL CHECK (`content_relevance` BETWEEN 1 AND 5),
  `tag_relevance`     TINYINT UNSIGNED NOT NULL CHECK (`tag_relevance` BETWEEN 1 AND 5),
  `comment`           TEXT,
  `created_at`        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_fb_user_res` (`user_id`, `resource_id`),
  CONSTRAINT `fk_fb_user`
    FOREIGN KEY (`user_id`)     REFERENCES `users`     (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_fb_res`
    FOREIGN KEY (`resource_id`) REFERENCES `resources` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
--  SEED DATA
-- ============================================================

-- Categories
INSERT INTO `categories` (`id`, `name`, `slug`, `icon`) VALUES
  (1, 'Web Development',        'web-development',        'bi-code-slash'),
  (2, 'Artificial Intelligence','artificial-intelligence', 'bi-cpu-fill');

-- Demo user  (password plain-text: demo1234)
INSERT INTO `users` (`id`, `username`, `email`, `password_hash`, `preferred_difficulty`) VALUES
  (1, 'demo_user', 'demo@edustream.ai',
   '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
   'Intermediate');

-- Resources — Web Development
INSERT INTO `resources`
  (`id`,`category_id`,`title`,`url`,`description`,`difficulty_level`,`resource_type`,`author`,`tags`)
VALUES
(1, 1,
 'The Modern JavaScript Tutorial',
 'https://javascript.info',
 'A comprehensive, up-to-date guide that takes you from JavaScript basics all the way through advanced topics like closures, prototypes, async/await, and the DOM API. Highly regarded in the dev community.',
 'Beginner', 'Course', 'Ilya Kantor',
 'JavaScript, ES6, DOM, Async, Closures, Beginner, Web'),

(2, 1,
 'React – Official Documentation',
 'https://react.dev',
 'The canonical resource for mastering React. Covers components, hooks, state management, concurrent features, and the new React 19 server components — all with live interactive sandboxes.',
 'Intermediate', 'Article', 'Meta Open Source',
 'React, JSX, Hooks, useState, useEffect, Components, JavaScript, Frontend'),

(3, 1,
 'Full-Stack Open 2024 — University of Helsinki',
 'https://fullstackopen.com',
 'A rigorous, free course covering the full modern web stack: React, Node.js, Express, MongoDB, GraphQL, TypeScript, and CI/CD pipelines. Used by thousands of developers worldwide each year.',
 'Advanced', 'Course', 'University of Helsinki',
 'React, Node.js, Express, MongoDB, GraphQL, TypeScript, Full-Stack, JavaScript, REST');

-- Resources — Artificial Intelligence
INSERT INTO `resources`
  (`id`,`category_id`,`title`,`url`,`description`,`difficulty_level`,`resource_type`,`author`,`tags`)
VALUES
(4, 2,
 'Fast.ai – Practical Deep Learning for Coders',
 'https://course.fast.ai',
 'A top-down, code-first approach to deep learning using PyTorch. Covers image recognition, NLP transfer learning, tabular models, and generative AI — deliberately avoiding heavy math up front.',
 'Intermediate', 'Course', 'Jeremy Howard & Rachel Thomas',
 'Python, PyTorch, Deep Learning, Neural Networks, NLP, Image Recognition, AI, Beginner-Friendly'),

(5, 2,
 'Neural Networks: Zero to Hero — Andrej Karpathy',
 'https://karpathy.ai/zero-to-hero.html',
 'A celebrated YouTube lecture series by former Tesla AI director Andrej Karpathy. Builds GPT-style transformer language models entirely from scratch in pure Python, with zero shortcuts.',
 'Advanced', 'Video', 'Andrej Karpathy',
 'Python, Neural Networks, GPT, Backpropagation, Transformers, LLM, AI, Deep Learning'),

(6, 2,
 'Elements of AI — University of Helsinki & Reaktor',
 'https://www.elementsofai.com',
 'A free, beginner-friendly online course introducing the core concepts of AI: machine learning, neural networks, probability, and the societal implications of intelligent systems. No coding required.',
 'Beginner', 'Course', 'University of Helsinki & Reaktor',
 'AI, Machine Learning, Neural Networks, Beginner, Ethics, No-Code, Python');
