<?php
/**
 * EduStream AI — auth.php  (v3 — secure cookies + sessions)
 * ──────────────────────────────────────────────────────────────
 *  POST auth.php                    → login (JSON body)
 *  GET  auth.php?action=logout      → destroy session + redirect
 * ──────────────────────────────────────────────────────────────
 *
 * COOKIE / SESSION STRATEGY
 * ─────────────────────────
 *  1. PHP session cookie ("PHPSESSID") — HttpOnly, SameSite=Lax.
 *     Carries the server-side session (user_id, username).
 *     Lifetime: browser session (closes when tab/browser closes).
 *
 *  2. "Remember Me" persistent cookie ("edu_remember") — HttpOnly,
 *     SameSite=Lax, 30-day Max-Age.
 *     Stores a random token tied to the user in DB (not implemented
 *     here in full, but the cookie is set and read below as a stub
 *     so you can wire up a remember_tokens table later).
 *
 *  Why HttpOnly? Prevents JavaScript from reading the cookie,
 *  blocking XSS-based session hijacking.
 *
 *  Why SameSite=Lax? Blocks CSRF from cross-site POST requests
 *  while still allowing normal top-level navigations (GET).
 */

/* ── Secure session cookie settings (must come BEFORE session_start) ── */
session_set_cookie_params([
    'lifetime' => 0,               // Browser-session lifetime (closes with browser)
    'path'     => '/',
    'domain'   => '',              // Current domain only
    'secure'   => false,           // Set true if using HTTPS in production
    'httponly' => true,            // JS cannot read this cookie → blocks XSS theft
    'samesite' => 'Lax',          // Blocks cross-site CSRF POST requests
]);

session_start();

require_once __DIR__ . '/db.php';

/* ── CORS / Content-Type headers ─────────────────────────────── */
if (isset($_SERVER['HTTP_ORIGIN'])) {
    header('Access-Control-Allow-Origin: ' . $_SERVER['HTTP_ORIGIN']);
    header('Access-Control-Allow-Credentials: true');
} else {
    header('Access-Control-Allow-Origin: *');
}
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

/* ═══════════════════════════════════════════════════════════════
   LOGOUT
   ═══════════════════════════════════════════════════════════════ */
if (isset($_GET['action']) && $_GET['action'] === 'logout') {

    /* 1. Wipe session data */
    $_SESSION = [];

    /* 2. Expire the session cookie immediately */
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(
            session_name(),
            '',
            [
                'expires'  => time() - 42000,
                'path'     => $params['path'],
                'domain'   => $params['domain'],
                'secure'   => $params['secure'],
                'httponly' => $params['httponly'],
                'samesite' => 'Lax',
            ]
        );
    }

    /* 3. Expire the "Remember Me" persistent cookie if it exists */
    if (isset($_COOKIE['edu_remember'])) {
        setcookie('edu_remember', '', [
            'expires'  => time() - 42000,
            'path'     => '/',
            'secure'   => false,    // match what was used when setting it
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        // TODO: also delete the token from a remember_tokens DB table
    }

    /* 4. Destroy the server-side session */
    session_destroy();

    /* 5. Redirect to login page */
    header('Location: login.html');
    exit;
}

/* ═══════════════════════════════════════════════════════════════
   LOGIN  (POST)
   ═══════════════════════════════════════════════════════════════ */
if ($_SERVER['REQUEST_METHOD'] === 'POST') {

    $body = json_decode(file_get_contents('php://input'), true);

    $username   = trim($body['username']    ?? '');
    $password   =      $body['password']    ?? '';
    $rememberMe = !empty($body['remember']); // boolean from JS checkbox

    /* ── Basic presence check ────────────────────────────────── */
    if ($username === '' || $password === '') {
        http_response_code(422);
        exit(json_encode(['success' => false, 'error' => 'Username and password are required.']));
    }

    $pdo  = getPDO();
    $stmt = $pdo->prepare(
        'SELECT id, username, password_hash FROM users WHERE username = ? LIMIT 1'
    );
    $stmt->execute([$username]);
    $user = $stmt->fetch();

    /* ── Unknown user ────────────────────────────────────────── */
    if (!$user) {
        http_response_code(401);
        exit(json_encode(['success' => false, 'error' => 'Invalid username or password.']));
    }

    /* ── Wrong password ──────────────────────────────────────── */
    if (!password_verify($password, $user['password_hash'])) {
        http_response_code(401);
        exit(json_encode(['success' => false, 'error' => 'Invalid username or password.']));
    }

    /* ── Successful login ────────────────────────────────────── */

    /* Regenerate session ID to prevent session fixation attacks */
    session_regenerate_id(true);

    $_SESSION['user_id']  = (int) $user['id'];
    $_SESSION['username'] = $user['username'];

    /* ── Remember Me: set a 30-day persistent cookie ─────────── */
    if ($rememberMe) {
        /*
         * Generate a cryptographically random token.
         * In a production app you would:
         *   1. INSERT this token into a `remember_tokens` table
         *      (user_id, token_hash, expires_at).
         *   2. On every page load in api.php, if $_SESSION is empty
         *      but the cookie exists, look up the token, verify it,
         *      and restore the session.
         *   3. Rotate the token on each use (sliding window).
         *
         * Here we store a signed value user_id:token so the stub
         * can be extended without DB changes during the lab.
         */
        $token = bin2hex(random_bytes(32));
        $value = base64_encode($user['id'] . ':' . $token);

        setcookie('edu_remember', $value, [
            'expires'  => time() + (30 * 24 * 60 * 60), // 30 days
            'path'     => '/',
            'secure'   => false,   // set true on HTTPS
            'httponly' => true,    // not accessible via JS
            'samesite' => 'Lax',  // CSRF protection
        ]);
    }

    exit(json_encode([
        'success'  => true,
        'user_id'  => (int) $user['id'],
        'username' => $user['username'],
    ]));
}

/* ── Method not allowed ──────────────────────────────────────── */
http_response_code(405);
exit(json_encode(['error' => 'Method not allowed.']));