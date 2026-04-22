<?php 
session_set_cookie_params([
    'lifetime' => 0,
    'path'     => '/',
    'domain'   => '',
    'secure'   => false,
    'httponly' => true,
    'samesite' => 'Lax',
]);
/**
 * EduStream AI — register.php
 * ─────────────────────────────────────────────────────────────────
 * Handles POST /register.php  (JSON body)
 * Returns JSON {success, error?, field?}
 *
 * Validates all TC_REG_01 → TC_REG_09:
 *  TC_REG_01  Valid data           → registers user
 *  TC_REG_02  Empty fields         → "required fields" error
 *  TC_REG_03  Invalid email        → "Invalid email format"
 *  TC_REG_04  Password mismatch    → "Passwords do not match"
 *  TC_REG_05  Weak password        → "Weak password" (min 8, mixed)
 *  TC_REG_06  Existing user/email  → "User already exists"
 *  TC_REG_07  Boundary pw length   → Accepted (exactly 8 chars OK)
 *  TC_REG_08  Special chars uname  → Validated per rules (alphanum + _ -)
 *  TC_REG_09  Successful redirect  → {success:true, redirect:'login.html'}
 * ─────────────────────────────────────────────────────────────────
 */

session_start();
require_once __DIR__ . '/db.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405); exit(json_encode(['error' => 'Method not allowed.']));
}

$body = json_decode(file_get_contents('php://input'), true);

$username  = trim($body['username']  ?? '');
$email     = trim($body['email']     ?? '');
$password  = $body['password']       ?? '';
$confirm   = $body['confirm']        ?? '';
$preferred = trim($body['preferred_difficulty'] ?? 'Beginner');

/* ── TC_REG_02: Empty fields ─────────────────────────────────── */
if ($username === '' || $email === '' || $password === '' || $confirm === '') {
    http_response_code(422);
    exit(json_encode([
        'success' => false,
        'error'   => 'Error messages for required fields.',
        'field'   => 'all',
    ]));
}

/* ── TC_REG_03: Invalid email format ─────────────────────────── */
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(422);
    exit(json_encode([
        'success' => false,
        'error'   => 'Error: Invalid email format.',
        'field'   => 'email',
    ]));
}

/* ── TC_REG_04: Password mismatch ────────────────────────────── */
if ($password !== $confirm) {
    http_response_code(422);
    exit(json_encode([
        'success' => false,
        'error'   => 'Error: Passwords do not match.',
        'field'   => 'confirm',
    ]));
}

/* ── TC_REG_05 / TC_REG_07: Weak password / boundary length ─── */
/* Rule: min 8 chars (boundary accepted), must have letter + digit */
if (strlen($password) < 8) {
    http_response_code(422);
    exit(json_encode([
        'success' => false,
        'error'   => 'Error: Weak password. Min 8 characters with letters and numbers.',
        'field'   => 'password',
    ]));
}
if (!preg_match('/[A-Za-z]/', $password) || !preg_match('/[0-9]/', $password)) {
    http_response_code(422);
    exit(json_encode([
        'success' => false,
        'error'   => 'Error: Weak password. Must contain letters and numbers.',
        'field'   => 'password',
    ]));
}

/* ── TC_REG_08: Username validation (alphanum + _ -) ─────────── */
if (!preg_match('/^[A-Za-z0-9_\-@#]{3,80}$/', $username)) {
    http_response_code(422);
    exit(json_encode([
        'success' => false,
        'error'   => 'Validation as per rules: Username must be 3–80 chars, letters/numbers/@/#/_/- only.',
        'field'   => 'username',
    ]));
}

$pdo = getPDO();

/* ── TC_REG_06: Existing user / email ───────────────────────── */
$stmt = $pdo->prepare('SELECT id FROM users WHERE username = ? OR email = ? LIMIT 1');
$stmt->execute([$username, $email]);
if ($stmt->fetch()) {
    http_response_code(409);
    exit(json_encode([
        'success' => false,
        'error'   => 'Error: User already exists.',
        'field'   => 'username',
    ]));
}

/* ── TC_REG_01: Valid registration ──────────────────────────── */
$validDifficulties = ['Beginner', 'Intermediate', 'Advanced'];
if (!in_array($preferred, $validDifficulties, true)) {
    $preferred = 'Beginner';
}

$hash = password_hash($password, PASSWORD_BCRYPT);
$stmt = $pdo->prepare(
    'INSERT INTO users (username, email, password_hash, preferred_difficulty)
     VALUES (?, ?, ?, ?)'
);
$stmt->execute([$username, $email, $hash, $preferred]);

/* ── TC_REG_09: Successful redirect ─────────────────────────── */
http_response_code(201);
exit(json_encode([
    'success'  => true,
    'message'  => 'User registered successfully.',
    'redirect' => 'login.html',
]));