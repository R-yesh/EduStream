<?php
/**
 * EduStream AI — auth.php
 * Handles login (POST) and logout (?action=logout).
 * Called by login.html via fetch() for login,
 * and linked directly for logout.
 */

session_start();
require_once __DIR__ . '/php/db.php';

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

/* ── Login ──────────────────────────────────────────────────── */
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true);

    $username = trim($body['username'] ?? '');
    $password = trim($body['password'] ?? '');

    if ($username === '' || $password === '') {
        http_response_code(400);
        exit(json_encode(['success' => false, 'error' => 'Username and password are required.']));
    }

    $pdo  = getPDO();
    $stmt = $pdo->prepare('SELECT id, username, password_hash FROM users WHERE username = ? LIMIT 1');
    $stmt->execute([$username]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password_hash'])) {
        http_response_code(401);
        exit(json_encode(['success' => false, 'error' => 'Invalid username or password.']));
    }

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
