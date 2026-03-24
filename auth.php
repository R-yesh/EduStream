<?php
/**
 * EduStream AI — auth.php
 * Handles login (POST) and logout (?action=logout).
 * Called by login.html via fetch() for login,
 * and linked directly for logout.
 */

session_start();
require_once __DIR__ . '/db.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

/* ── Logout ─────────────────────────────────────────────────── */
if (isset($_GET['action']) && $_GET['action'] === 'logout') {
    $_SESSION = [];
    session_destroy();
    /* For direct browser nav, redirect to login page */
    header('Location: login.html');
    exit;
}

/* ── Login Debug Mode ──────────────────────────────────────────── */
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true);

    $username = trim($body['username'] ?? '');
    $password = trim($body['password'] ?? '');

    $pdo  = getPDO();
    $stmt = $pdo->prepare('SELECT id, username, password_hash FROM users WHERE username = ? LIMIT 1');
    $stmt->execute([$username]);
    $user = $stmt->fetch();

    // --- DEBUG START ---
    if (!$user) {
        exit(json_encode(['success' => false, 'error' => "DEBUG: User '$username' not found in database."]));
    }

    $isValid = password_verify(trim($password), trim($user['password_hash']));
    
    if (!$isValid) {
        exit(json_encode([
            'success' => false, 
            'error' => "DEBUG: Hash mismatch!",
            'typed_pass' => $password,
            'db_hash' => $user['password_hash']
        ]));
    }
    // --- DEBUG END ---

    /* Successful login — set session */
    session_regenerate_id(true);
    $_SESSION['user_id']   = (int) $user['id'];
    $_SESSION['username']  = $user['username'];

    exit(json_encode([
        'success'  => true,
        'user_id'  => (int) $user['id'],
        'username' => $user['username'],
    ]));
}

http_response_code(405);
exit(json_encode(['error' => 'Method not allowed.']));
