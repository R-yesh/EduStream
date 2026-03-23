-- ============================================================
--  EduStream AI — Database Schema & Seed Data
--  Run this in phpMyAdmin or: mysql -u root -p < edustream.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS edustream_ai
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE edustream_ai;

-- ------------------------------------------------------------
-- 1. USERS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id            INT UNSIGNED     NOT NULL AUTO_INCREMENT,
    username      VARCHAR(60)      NOT NULL,
    email         VARCHAR(120)     NOT NULL,
    password_hash VARCHAR(255)     NOT NULL,
    preferred_difficulty ENUM('Beginner','Intermediate','Advanced') NOT NULL DEFAULT 'Beginner',
    created_at    TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_email (email)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 2. CATEGORIES
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
    id    INT UNSIGNED NOT NULL AUTO_INCREMENT,
    name  VARCHAR(80)  NOT NULL,
    slug  VARCHAR(80)  NOT NULL,
    icon  VARCHAR(10)  NOT NULL DEFAULT '📚',
    PRIMARY KEY (id),
    UNIQUE KEY uq_slug (slug)
) ENGINE=InnoDB;

INSERT INTO categories (name, slug, icon) VALUES
    ('Web Development',      'web-dev',       '🌐'),
    ('Artificial Intelligence','ai',           '🤖'),
    ('Data Science',         'data-science',  '📊'),
    ('Cybersecurity',        'cybersecurity', '🔐'),
    ('Mobile Development',   'mobile-dev',    '📱'),
    ('DevOps & Cloud',       'devops',        '☁️');

-- ------------------------------------------------------------
-- 3. RESOURCES
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS resources (
    id               INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    category_id      INT UNSIGNED  NOT NULL,
    title            VARCHAR(200)  NOT NULL,
    url              VARCHAR(500)  NOT NULL,
    description      TEXT,
    difficulty_level ENUM('Beginner','Intermediate','Advanced') NOT NULL,
    resource_type    ENUM('Article','Video','Course','Book','Tool') NOT NULL DEFAULT 'Article',
    author           VARCHAR(120),
    duration_minutes INT UNSIGNED,
    created_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY fk_resource_category (category_id),
    CONSTRAINT fk_resource_category
        FOREIGN KEY (category_id) REFERENCES categories (id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

INSERT INTO resources (category_id, title, url, description, difficulty_level, resource_type, author, duration_minutes) VALUES
-- Web Dev
(1,'HTML & CSS Crash Course','https://www.freecodecamp.org/learn/2022/responsive-web-design/','Complete intro to HTML5 and CSS3 with hands-on projects.','Beginner','Course','freeCodeCamp',600),
(1,'JavaScript 30','https://javascript30.com','30 day vanilla JS coding challenge — no frameworks, no libraries.','Beginner','Course','Wes Bos',1800),
(1,'The Odin Project','https://www.theodinproject.com','Full-stack curriculum from zero to employable.','Intermediate','Course','The Odin Project',NULL),
(1,'Advanced CSS & Sass','https://www.udemy.com/course/advanced-css-and-sass/','Flexbox, Grid, animations & responsive design deep dive.','Advanced','Course','Jonas Schmedtmann',280),
(1,'React Documentation','https://react.dev/learn','Official interactive React tutorial and reference.','Intermediate','Article','Meta',NULL),

-- AI
(2,'Elements of AI','https://www.elementsofai.com','Free, non-technical introduction to AI concepts.','Beginner','Course','University of Helsinki',360),
(2,'Fast.ai Deep Learning','https://course.fast.ai','Practical deep learning for coders — top-down approach.','Intermediate','Course','fast.ai',NULL),
(2,'Attention Is All You Need','https://arxiv.org/abs/1706.03762','The original Transformer architecture paper.','Advanced','Article','Vaswani et al.',90),
(2,'Prompt Engineering Guide','https://www.promptingguide.ai','Comprehensive guide to prompting LLMs effectively.','Beginner','Article','DAIR.AI',60),
(2,'CS231n: CNNs for Visual Recognition','https://cs231n.stanford.edu','Stanford's iconic computer vision course.','Advanced','Course','Stanford',NULL),

-- Data Science
(3,'Kaggle Learn','https://www.kaggle.com/learn','Micro-courses in Python, SQL, ML and more.','Beginner','Course','Kaggle',NULL),
(3,'Pandas Documentation','https://pandas.pydata.org/docs/','Official Pandas user guide and API reference.','Intermediate','Article','Pandas Team',NULL),
(3,'Statistics with Python Specialization','https://www.coursera.org/specializations/statistics-with-python','Inference, modelling and understanding data.','Intermediate','Course','University of Michigan',NULL),
(3,'Pattern Recognition & Machine Learning','https://www.microsoft.com/en-us/research/publication/pattern-recognition-machine-learning/','Bishop's classic textbook on probabilistic ML.','Advanced','Book','Christopher Bishop',NULL),

-- Cybersecurity
(4,'TryHackMe','https://tryhackme.com','Learn cybersecurity through hands-on browser labs.','Beginner','Course','TryHackMe',NULL),
(4,'OWASP Top 10','https://owasp.org/www-project-top-ten/','The 10 most critical web application security risks.','Intermediate','Article','OWASP Foundation',120),
(4,'Hacking: The Art of Exploitation','https://nostarch.com/hacking2','Deep technical dive into exploitation techniques.','Advanced','Book','Jon Erickson',NULL),

-- Mobile Dev
(5,'Flutter Get Started','https://flutter.dev/docs/get-started','Official Flutter tutorial to build your first app.','Beginner','Article','Google',120),
(5,'React Native Fundamentals','https://reactnative.dev/docs/getting-started','Build native apps with React Native step by step.','Intermediate','Article','Meta',NULL),
(5,'iOS & Swift - The Complete iOS App Development Bootcamp','https://www.udemy.com/course/ios-13-app-development-bootcamp/','Build 27 apps from scratch.','Advanced','Course','Angela Yu',5900),

-- DevOps
(6,'Docker for Beginners','https://docker-curriculum.com','Learn Docker from the ground up with a sample app.','Beginner','Article','Prakhar Srivastav',180),
(6,'Kubernetes the Hard Way','https://github.com/kelseyhightower/kubernetes-the-hard-way','Bootstrap K8s from scratch to deeply understand it.','Advanced','Course','Kelsey Hightower',NULL),
(6,'Linux Command Line Basics','https://ubuntu.com/tutorials/command-line-for-beginners','Get comfortable with the terminal quickly.','Beginner','Article','Ubuntu',120);

-- ------------------------------------------------------------
-- 4. USER PROGRESS  (tracks which resources a user has saved/completed)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_progress (
    id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id     INT UNSIGNED NOT NULL,
    resource_id INT UNSIGNED NOT NULL,
    status      ENUM('Saved','In Progress','Completed') NOT NULL DEFAULT 'Saved',
    saved_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_user_resource (user_id, resource_id),
    KEY fk_progress_user (user_id),
    KEY fk_progress_resource (resource_id),
    CONSTRAINT fk_progress_user
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_progress_resource
        FOREIGN KEY (resource_id) REFERENCES resources (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 5. FEEDBACK
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS feedback (
    id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id    INT UNSIGNED,
    name       VARCHAR(100) NOT NULL,
    email      VARCHAR(120) NOT NULL,
    subject    VARCHAR(200) NOT NULL,
    message    TEXT         NOT NULL,
    rating     TINYINT UNSIGNED CHECK (rating BETWEEN 1 AND 5),
    submitted_at TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY fk_feedback_user (user_id),
    CONSTRAINT fk_feedback_user
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB;
