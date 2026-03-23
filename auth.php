<?php
// api/auth.php
require_once __DIR__ . '/config.php';

$action = $_GET['action'] ?? $_POST['action'] ?? '';
$body   = json_decode(file_get_contents('php://input'), true) ?? [];

switch ($action) {

    // ── GET /api/auth.php?action=me ─────────────────────────
    case 'me':
        if (empty($_SESSION['user_id'])) { json_ok(null); }
        $stmt = db()->prepare('SELECT id, username, email, preferred_difficulty, created_at FROM users WHERE id = ?');
        $stmt->execute([uid()]);
        json_ok($stmt->fetch() ?: null);

    // ── POST /api/auth.php?action=login ─────────────────────
    case 'login':
        $email    = trim($body['email']    ?? '');
        $password =      $body['password'] ?? '';

        if (!$email || !$password)              json_err('Email and password are required.');
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) json_err('Invalid email format.');

        $stmt = db()->prepare('SELECT * FROM users WHERE email = ?');
        $stmt->execute([$email]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($password, $user['password_hash'])) {
            json_err('Invalid email or password.', 401);
        }

        $_SESSION['user_id'] = $user['id'];
        json_ok([
            'id'                   => $user['id'],
            'username'             => $user['username'],
            'email'                => $user['email'],
            'preferred_difficulty' => $user['preferred_difficulty'],
        ]);

    // ── POST /api/auth.php?action=register ──────────────────
    case 'register':
        $username   = trim($body['username']   ?? '');
        $email      = trim($body['email']      ?? '');
        $password   =      $body['password']   ?? '';
        $confirm    =      $body['confirm']    ?? '';
        $difficulty =      $body['difficulty'] ?? 'Beginner';

        $errors = [];
        if (strlen($username) < 3 || strlen($username) > 60)          $errors[] = 'Username must be 3–60 characters.';
        if (!preg_match('/^[a-zA-Z0-9_\- ]+$/', $username))           $errors[] = 'Username contains invalid characters.';
        if (!filter_var($email, FILTER_VALIDATE_EMAIL))                $errors[] = 'Invalid email address.';
        if (strlen($password) < 8)                                     $errors[] = 'Password must be at least 8 characters.';
        if (!preg_match('/[A-Z]/', $password))                         $errors[] = 'Password needs at least one uppercase letter.';
        if (!preg_match('/[0-9]/', $password))                         $errors[] = 'Password needs at least one number.';
        if ($password !== $confirm)                                    $errors[] = 'Passwords do not match.';
        if (!in_array($difficulty, ['Beginner','Intermediate','Advanced'], true)) $difficulty = 'Beginner';

        if ($errors) json_err(implode(' | ', $errors));

        $dup = db()->prepare('SELECT id FROM users WHERE email = ?');
        $dup->execute([$email]);
        if ($dup->fetch()) json_err('An account with this email already exists.');

        $hash = password_hash($password, PASSWORD_BCRYPT);
        $ins  = db()->prepare('INSERT INTO users (username, email, password_hash, preferred_difficulty) VALUES (?,?,?,?)');
        $ins->execute([$username, $email, $hash, $difficulty]);
        $newId = (int) db()->lastInsertId();

        $_SESSION['user_id'] = $newId;
        json_ok([
            'id'                   => $newId,
            'username'             => $username,
            'email'                => $email,
            'preferred_difficulty' => $difficulty,
        ]);

    // ── POST /api/auth.php?action=logout ────────────────────
    case 'logout':
        $_SESSION = [];
        session_destroy();
        json_ok('Logged out.');

    default:
        json_err('Unknown action.', 404);
}
