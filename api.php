<?php
/**
 * EduStream AI — api.php  (v4 — admin panel)
 * ─────────────────────────────────────────────────────────────
 *  GET  api.php                          → all resources + categories
 *  GET  api.php?category_id=1            → filter by category
 *  GET  api.php?q=react                  → search title / tags / desc
 *  GET  api.php?action=progress          → progress map for session user
 *  GET  api.php?action=categories        → category list
 *  GET  api.php?action=whoami            → current session user info
 *
 *  ADMIN-ONLY GETs:
 *  GET  api.php?action=admin_users       → all users + stats
 *  GET  api.php?action=admin_user_detail&user_id=N → user + progress
 *
 *  POST api.php  {action:"complete",  resource_id:N}
 *  POST api.php  {action:"feedback",  resource_id:N, ...}
 *
 *  ADMIN-ONLY POSTs:
 *  POST api.php  {action:"add_resource",    ...fields}
 *  POST api.php  {action:"edit_resource",   id:N, ...fields}
 *  POST api.php  {action:"delete_resource", resource_id:N}
 *  POST api.php  {action:"add_category",    name, slug, icon}
 *  POST api.php  {action:"edit_user",       user_id:N, ...fields}
 *  POST api.php  {action:"reset_progress",  user_id:N}
 * ─────────────────────────────────────────────────────────────
 */

/* ── Secure session cookie (must be BEFORE session_start) ──── */
session_set_cookie_params([
    'lifetime' => 0,
    'path'     => '/',
    'domain'   => '',
    'secure'   => false,
    'httponly' => true,
    'samesite' => 'Lax',
]);

session_start();

if (isset($_SERVER['HTTP_ORIGIN'])) {
    header('Access-Control-Allow-Origin: ' . $_SERVER['HTTP_ORIGIN']);
    header('Access-Control-Allow-Credentials: true');
}

require_once __DIR__ . '/db.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

/* ── Auth guard ─────────────────────────────────────────────── */
if (empty($_SESSION['user_id'])) {
    if (isset($_COOKIE['edu_remember'])) {
        // TODO: implement token lookup + session restore
    }
    http_response_code(401);
    exit(json_encode(['error' => 'Not authenticated.', 'redirect' => 'login.html']));
}

$userId   = (int) $_SESSION['user_id'];
$username = $_SESSION['username'] ?? 'User';
$pdo      = getPDO();
$method   = $_SERVER['REQUEST_METHOD'];

/* ── Resolve is_admin from DB (cache in session) ─────────────── */
if (!isset($_SESSION['is_admin'])) {
    $stmt = $pdo->prepare('SELECT is_admin FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    $row = $stmt->fetch();
    $_SESSION['is_admin'] = (int) ($row['is_admin'] ?? 0);
}
$isAdmin = (bool) $_SESSION['is_admin'];

/* ── Helper: require admin or 403 ─────────────────────────────── */
function requireAdmin(bool $isAdmin): void {
    if (!$isAdmin) {
        http_response_code(403);
        exit(json_encode(['error' => 'Admin access required.']));
    }
}

/* ── Helper: validate resource fields ─────────────────────────── */
function validateResourceFields(array $b): ?string {
    if (empty($b['title']))       return 'title is required.';
    if (empty($b['url']))         return 'url is required.';
    if (empty($b['category_id'])) return 'category_id is required.';
    $validDiff  = ['Beginner', 'Intermediate', 'Advanced'];
    $validTypes = ['Article', 'Video', 'Course', 'Book', 'Tool'];
    if (!in_array($b['difficulty_level'] ?? '', $validDiff, true))  return 'Invalid difficulty_level.';
    if (!in_array($b['resource_type']    ?? '', $validTypes, true)) return 'Invalid resource_type.';
    return null;
}


/* ══════════════════════════════════════════════════════════════
   GET
   ══════════════════════════════════════════════════════════════ */
if ($method === 'GET') {
    $action = trim($_GET['action'] ?? '');

    /* ── whoami ──────────────────────────────────────────────── */
    if ($action === 'whoami') {
        exit(json_encode([
            'user_id'  => $userId,
            'username' => $username,
            'is_admin' => $isAdmin,
        ]));
    }

    /* ── categories ──────────────────────────────────────────── */
    if ($action === 'categories') {
        $cats = $pdo->query('SELECT * FROM categories ORDER BY name')->fetchAll();
        exit(json_encode(['categories' => $cats]));
    }

    /* ── progress map ────────────────────────────────────────── */
    if ($action === 'progress') {
        $stmt = $pdo->prepare(
            'SELECT resource_id, status FROM user_progress WHERE user_id = ?'
        );
        $stmt->execute([$userId]);
        $map = [];
        foreach ($stmt->fetchAll() as $r) {
            $map[(int)$r['resource_id']] = $r['status'];
        }
        exit(json_encode(['progress' => $map]));
    }

    /* ── ADMIN: all users ────────────────────────────────────── */
    if ($action === 'admin_users') {
        requireAdmin($isAdmin);
        $users = $pdo->query('
            SELECT u.id, u.username, u.email, u.preferred_difficulty, u.is_admin,
                   u.created_at,
                   COUNT(DISTINCT p.resource_id) AS completed_count
            FROM users u
            LEFT JOIN user_progress p ON p.user_id = u.id AND p.status = "Completed"
            GROUP BY u.id
            ORDER BY u.created_at ASC
        ')->fetchAll();
        foreach ($users as &$u) {
            $u['id']             = (int) $u['id'];
            $u['is_admin']       = (bool) $u['is_admin'];
            $u['completed_count']= (int) $u['completed_count'];
        }
        exit(json_encode(['users' => $users]));
    }

    /* ── ADMIN: single user detail ───────────────────────────── */
    if ($action === 'admin_user_detail') {
        requireAdmin($isAdmin);
        $targetId = (int) ($_GET['user_id'] ?? 0);
        if ($targetId < 1) { http_response_code(400); exit(json_encode(['error' => 'Invalid user_id.'])); }

        $uStmt = $pdo->prepare('SELECT id, username, email, preferred_difficulty, is_admin, created_at FROM users WHERE id = ?');
        $uStmt->execute([$targetId]);
        $user = $uStmt->fetch();
        if (!$user) { http_response_code(404); exit(json_encode(['error' => 'User not found.'])); }
        $user['is_admin'] = (bool) $user['is_admin'];

        $pStmt = $pdo->prepare('
            SELECT p.resource_id, p.status, p.updated_at, r.title, r.resource_type, c.name AS category_name
            FROM user_progress p
            JOIN resources r ON r.id = p.resource_id
            JOIN categories c ON c.id = r.category_id
            WHERE p.user_id = ?
            ORDER BY p.updated_at DESC
        ');
        $pStmt->execute([$targetId]);
        $progress = $pStmt->fetchAll();

        $fStmt = $pdo->prepare('
            SELECT f.resource_id, f.content_relevance, f.tag_relevance, f.comment, f.created_at, r.title
            FROM feedback f
            JOIN resources r ON r.id = f.resource_id
            WHERE f.user_id = ?
            ORDER BY f.created_at DESC
        ');
        $fStmt->execute([$targetId]);
        $feedback = $fStmt->fetchAll();

        exit(json_encode(['user' => $user, 'progress' => $progress, 'feedback' => $feedback]));
    }

    /* ── resources (optionally filtered) ─────────────────────── */
    $sql    = '
        SELECT r.*,
               c.name AS category_name,
               c.slug AS category_slug,
               c.icon AS category_icon
        FROM   resources r
        JOIN   categories c ON c.id = r.category_id
        WHERE  1 = 1
    ';
    $params = [];

    if (!empty($_GET['category_id'])) {
        $sql     .= ' AND r.category_id = ?';
        $params[] = (int) $_GET['category_id'];
    }

    if (!empty($_GET['q'])) {
        $like     = '%' . trim($_GET['q']) . '%';
        $sql     .= ' AND (r.title LIKE ? OR r.tags LIKE ? OR r.description LIKE ?)';
        $params[] = $like;
        $params[] = $like;
        $params[] = $like;
    }

    $sql .= ' ORDER BY r.category_id ASC, r.id ASC';

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $resources = $stmt->fetchAll();

    foreach ($resources as &$res) {
        $res['id']          = (int) $res['id'];
        $res['category_id'] = (int) $res['category_id'];
        $res['tags_array']  = array_map('trim', explode(',', $res['tags'] ?? ''));
    }
    unset($res);

    exit(json_encode(['resources' => $resources]));
}


/* ══════════════════════════════════════════════════════════════
   POST
   ══════════════════════════════════════════════════════════════ */
if ($method === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true);

    if (!$body || empty($body['action'])) {
        http_response_code(400);
        exit(json_encode(['error' => 'Missing action.']));
    }

    $action     = $body['action'];
    $resourceId = isset($body['resource_id']) ? (int) $body['resource_id'] : 0;

    /* ── Mark Completed ───────────────────────────────────────── */
    if ($action === 'complete') {
        if ($resourceId < 1) { http_response_code(400); exit(json_encode(['error' => 'Invalid resource_id.'])); }
        $pdo->prepare('
            INSERT INTO user_progress (user_id, resource_id, status)
            VALUES (?, ?, "Completed")
            ON DUPLICATE KEY UPDATE status = "Completed", updated_at = CURRENT_TIMESTAMP
        ')->execute([$userId, $resourceId]);
        exit(json_encode(['success' => true, 'status' => 'Completed']));
    }

    /* ── Save feedback ────────────────────────────────────────── */
    if ($action === 'feedback') {
        if ($resourceId < 1) { http_response_code(400); exit(json_encode(['error' => 'Invalid resource_id.'])); }
        $cr      = isset($body['content_relevance']) ? (int) $body['content_relevance'] : 0;
        $tr      = isset($body['tag_relevance'])     ? (int) $body['tag_relevance']     : 0;
        $comment = trim($body['comment'] ?? '');

        if ($cr < 1 || $cr > 5 || $tr < 1 || $tr > 5) {
            http_response_code(422);
            exit(json_encode(['error' => 'Ratings must be 1–5.']));
        }

        $pdo->prepare('
            INSERT INTO feedback (user_id, resource_id, content_relevance, tag_relevance, comment)
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                content_relevance = VALUES(content_relevance),
                tag_relevance     = VALUES(tag_relevance),
                comment           = VALUES(comment),
                created_at        = CURRENT_TIMESTAMP
        ')->execute([$userId, $resourceId, $cr, $tr, $comment]);

        $pdo->prepare('
            INSERT INTO user_progress (user_id, resource_id, status)
            VALUES (?, ?, "Completed")
            ON DUPLICATE KEY UPDATE status = "Completed", updated_at = CURRENT_TIMESTAMP
        ')->execute([$userId, $resourceId]);

        exit(json_encode(['success' => true, 'message' => 'Feedback saved!']));
    }

    /* ════════════════════════════════════════════════════════════
       ADMIN-ONLY ACTIONS
       ════════════════════════════════════════════════════════════ */

    /* ── Add Resource ─────────────────────────────────────────── */
    if ($action === 'add_resource') {
        requireAdmin($isAdmin);
        $err = validateResourceFields($body);
        if ($err) { http_response_code(422); exit(json_encode(['error' => $err])); }

        $stmt = $pdo->prepare('
            INSERT INTO resources (category_id, title, url, description, difficulty_level, resource_type, author, tags)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ');
        $stmt->execute([
            (int)   $body['category_id'],
            trim(   $body['title']),
            trim(   $body['url']),
            trim(   $body['description']    ?? ''),
                    $body['difficulty_level'],
                    $body['resource_type'],
            trim(   $body['author']         ?? ''),
            trim(   $body['tags']           ?? ''),
        ]);
        $newId = (int) $pdo->lastInsertId();
        exit(json_encode(['success' => true, 'id' => $newId, 'message' => 'Resource added.']));
    }

    /* ── Edit Resource ────────────────────────────────────────── */
    if ($action === 'edit_resource') {
        requireAdmin($isAdmin);
        $id = (int) ($body['id'] ?? 0);
        if ($id < 1) { http_response_code(400); exit(json_encode(['error' => 'Invalid id.'])); }
        $err = validateResourceFields($body);
        if ($err) { http_response_code(422); exit(json_encode(['error' => $err])); }

        $pdo->prepare('
            UPDATE resources SET
                category_id      = ?,
                title            = ?,
                url              = ?,
                description      = ?,
                difficulty_level = ?,
                resource_type    = ?,
                author           = ?,
                tags             = ?
            WHERE id = ?
        ')->execute([
            (int)   $body['category_id'],
            trim(   $body['title']),
            trim(   $body['url']),
            trim(   $body['description']    ?? ''),
                    $body['difficulty_level'],
                    $body['resource_type'],
            trim(   $body['author']         ?? ''),
            trim(   $body['tags']           ?? ''),
            $id,
        ]);
        exit(json_encode(['success' => true, 'message' => 'Resource updated.']));
    }

    /* ── Delete Resource ──────────────────────────────────────── */
    if ($action === 'delete_resource') {
        requireAdmin($isAdmin);
        if ($resourceId < 1) { http_response_code(400); exit(json_encode(['error' => 'Invalid resource_id.'])); }
        $pdo->prepare('DELETE FROM resources WHERE id = ?')->execute([$resourceId]);
        exit(json_encode(['success' => true, 'message' => 'Resource deleted.']));
    }

    /* ── Add Category ─────────────────────────────────────────── */
    if ($action === 'add_category') {
        requireAdmin($isAdmin);
        $name = trim($body['name'] ?? '');
        $slug = trim($body['slug'] ?? '');
        $icon = trim($body['icon'] ?? 'bi-folder');
        if (!$name || !$slug) { http_response_code(422); exit(json_encode(['error' => 'name and slug are required.'])); }

        try {
            $pdo->prepare('INSERT INTO categories (name, slug, icon) VALUES (?, ?, ?)')->execute([$name, $slug, $icon]);
            exit(json_encode(['success' => true, 'id' => (int)$pdo->lastInsertId(), 'message' => 'Category added.']));
        } catch (\PDOException $e) {
            http_response_code(409);
            exit(json_encode(['error' => 'Slug already exists.']));
        }
    }

    /* ── Edit User (admin: update email, difficulty, admin flag) ─ */
    if ($action === 'edit_user') {
        requireAdmin($isAdmin);
        $targetId = (int) ($body['user_id'] ?? 0);
        if ($targetId < 1) { http_response_code(400); exit(json_encode(['error' => 'Invalid user_id.'])); }

        $email    = trim($body['email']                ?? '');
        $diff     = $body['preferred_difficulty']      ?? 'Beginner';
        $newAdmin = !empty($body['is_admin']) ? 1 : 0;

        // Prevent removing your own admin flag accidentally
        if ($targetId === $userId && !$newAdmin) {
            http_response_code(422);
            exit(json_encode(['error' => 'You cannot remove your own admin privileges.']));
        }

        $validDiff = ['Beginner', 'Intermediate', 'Advanced'];
        if (!in_array($diff, $validDiff, true)) { http_response_code(422); exit(json_encode(['error' => 'Invalid difficulty.'])); }

        $fields = ['preferred_difficulty = ?', 'is_admin = ?'];
        $vals   = [$diff, $newAdmin];

        if ($email !== '') {
            $fields[] = 'email = ?';
            $vals[]   = $email;
        }

        $vals[] = $targetId;
        $pdo->prepare('UPDATE users SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($vals);

        // Update session cache if editing self
        if ($targetId === $userId) {
            $_SESSION['is_admin'] = $newAdmin;
        }

        exit(json_encode(['success' => true, 'message' => 'User updated.']));
    }

    /* ── Reset User Progress ──────────────────────────────────── */
    if ($action === 'reset_progress') {
        requireAdmin($isAdmin);
        $targetId = (int) ($body['user_id'] ?? 0);
        if ($targetId < 1) { http_response_code(400); exit(json_encode(['error' => 'Invalid user_id.'])); }
        $pdo->prepare('DELETE FROM user_progress WHERE user_id = ?')->execute([$targetId]);
        $pdo->prepare('DELETE FROM feedback      WHERE user_id = ?')->execute([$targetId]);
        exit(json_encode(['success' => true, 'message' => 'Progress and feedback reset.']));
    }

    http_response_code(400);
    exit(json_encode(['error' => 'Unknown action.']));
}

http_response_code(405);
exit(json_encode(['error' => 'Method not allowed.']));