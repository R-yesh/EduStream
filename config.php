<?php
// api/config.php — DB connection only. No HTML ever lives here.

define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_NAME', 'edustream_ai');

// Allow requests from the front-end origin (same server in XAMPP)
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

// PDO singleton
function db(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
    }
    return $pdo;
}

// Session
if (session_status() === PHP_SESSION_NONE) { session_start(); }

// Helpers
function json_ok(mixed $data): void  { echo json_encode(['ok' => true,  'data' => $data]);  exit; }
function json_err(string $msg, int $code = 400): void {
    http_response_code($code);
    echo json_encode(['ok' => false, 'error' => $msg]);
    exit;
}
function requireAuth(): void {
    if (empty($_SESSION['user_id'])) json_err('Unauthenticated', 401);
}
function uid(): int { return (int)$_SESSION['user_id']; }

// AI recommendation engine
function recommendResource(int $userId, string $difficulty, int $catId = 0): ?array {
    $valid = ['Beginner', 'Intermediate', 'Advanced'];
    if (!in_array($difficulty, $valid, true)) $difficulty = 'Beginner';

    $sql = '
        SELECT r.*, c.name AS category_name, c.icon AS category_icon
        FROM   resources r
        JOIN   categories c ON c.id = r.category_id
        WHERE  r.difficulty_level = :diff
          AND  r.id NOT IN (
               SELECT resource_id FROM user_progress
               WHERE  user_id = :uid AND status = "Completed")
    ';
    $p = [':diff' => $difficulty, ':uid' => $userId];
    if ($catId > 0) { $sql .= ' AND r.category_id = :cat'; $p[':cat'] = $catId; }
    $sql .= ' ORDER BY RAND() LIMIT 1';
    $stmt = db()->prepare($sql); $stmt->execute($p);
    $row = $stmt->fetch();
    if (!$row) {
        $stmt = db()->prepare('SELECT r.*, c.name AS category_name, c.icon AS category_icon FROM resources r JOIN categories c ON c.id=r.category_id WHERE r.difficulty_level=:diff ORDER BY RAND() LIMIT 1');
        $stmt->execute([':diff' => $difficulty]);
        $row = $stmt->fetch() ?: null;
    }
    return $row ?: null;
}
