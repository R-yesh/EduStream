<?php
/**
 * EduStream AI — api.php  (v2 — session-aware)
 * ─────────────────────────────────────────────────────────────
 *  GET  api.php                          → all resources + categories
 *  GET  api.php?category_id=1            → filter by category
 *  GET  api.php?q=react                  → search title / tags / desc
 *  GET  api.php?action=progress          → progress map for session user
 *  GET  api.php?action=categories        → category list
 *  GET  api.php?action=whoami            → current session user info
 *  POST api.php  {action:"complete",  resource_id:N}
 *  POST api.php  {action:"feedback",  resource_id:N,
 *                 content_relevance:N, tag_relevance:N, comment:""}
 * ─────────────────────────────────────────────────────────────
 */

session_start();
// Add this to ensure sessions work across different fetch requests
if (isset($_SERVER['HTTP_ORIGIN'])) {
    header('Access-Control-Allow-Origin: ' . $_SERVER['HTTP_ORIGIN']);
    header('Access-Control-Allow-Credentials: true');
}
require_once __DIR__ . '/db.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

/* ── Auth guard ─────────────────────────────────────────────── */
if (empty($_SESSION['user_id'])) {
    http_response_code(401);
    exit(json_encode(['error' => 'Not authenticated.', 'redirect' => 'login.html']));
}

$userId   = (int) $_SESSION['user_id'];
$username = $_SESSION['username'] ?? 'User';
$pdo      = getPDO();
$method   = $_SERVER['REQUEST_METHOD'];


/* ══════════════════════════════════════════════════════════════
   GET
   ══════════════════════════════════════════════════════════════ */
if ($method === 'GET') {
    $action = trim($_GET['action'] ?? '');

    /* ── who am i ────────────────────────────────────────── */
    if ($action === 'whoami') {
        exit(json_encode(['user_id' => $userId, 'username' => $username]));
    }

    /* ── categories ──────────────────────────────────────── */
    if ($action === 'categories') {
        $cats = $pdo->query('SELECT * FROM categories ORDER BY name')->fetchAll();
        exit(json_encode(['categories' => $cats]));
    }

    /* ── progress map ────────────────────────────────────── */
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

    /* ── resources (optionally filtered) ─────────────────── */
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

    if ($resourceId < 1) {
        http_response_code(400);
        exit(json_encode(['error' => 'Invalid resource_id.']));
    }

    /* ── Mark Completed ───────────────────────────────────── */
    if ($action === 'complete') {
        $pdo->prepare('
            INSERT INTO user_progress (user_id, resource_id, status)
            VALUES (?, ?, "Completed")
            ON DUPLICATE KEY UPDATE status = "Completed", updated_at = CURRENT_TIMESTAMP
        ')->execute([$userId, $resourceId]);
        exit(json_encode(['success' => true, 'status' => 'Completed']));
    }

    /* ── Save feedback ────────────────────────────────────── */
    if ($action === 'feedback') {
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

    http_response_code(400);
    exit(json_encode(['error' => 'Unknown action.']));
}

http_response_code(405);
exit(json_encode(['error' => 'Method not allowed.']));
