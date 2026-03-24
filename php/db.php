<?php
/**
 * EduStream AI — db.php
 * ─────────────────────────────────────────────────────────────
 * Secure singleton PDO connection.
 * Included by api.php — never called directly.
 * ─────────────────────────────────────────────────────────────
 */

define('DB_HOST',    'localhost');
define('DB_NAME',    'edustream_ai');
define('DB_USER',    'root');      // ← change for production
define('DB_PASS',    '');          // ← change for production
define('DB_CHARSET', 'utf8mb4');

function getPDO(): PDO {
    static $pdo = null;

    if ($pdo === null) {
        $dsn = sprintf(
            'mysql:host=%s;dbname=%s;charset=%s',
            DB_HOST, DB_NAME, DB_CHARSET
        );

        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ];

        try {
            $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
        } catch (PDOException $e) {
            http_response_code(500);
            header('Content-Type: application/json');
            exit(json_encode([
                'error' => 'Database connection failed.',
                'detail' => $e->getMessage(),
            ]));
        }
    }

    return $pdo;
}
