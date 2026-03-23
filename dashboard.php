<?php
// api/dashboard.php
require_once __DIR__ . '/config.php';
requireAuth();

$action = $_GET['action'] ?? '';

switch ($action) {

    // ── GET ?action=stats ────────────────────────────────────
    case 'stats':
        $stmt = db()->prepare('SELECT status, COUNT(*) AS cnt FROM user_progress WHERE user_id = ? GROUP BY status');
        $stmt->execute([uid()]);
        $raw = $stmt->fetchAll();
        $stats = ['Saved' => 0, 'In Progress' => 0, 'Completed' => 0];
        foreach ($raw as $r) $stats[$r['status']] = (int)$r['cnt'];
        json_ok($stats);

    // ── GET ?action=recent ───────────────────────────────────
    case 'recent':
        $stmt = db()->prepare('
            SELECT up.status, up.saved_at, r.id, r.title, r.url, r.difficulty_level,
                   c.name AS cat_name, c.icon AS cat_icon
            FROM   user_progress up
            JOIN   resources r ON r.id = up.resource_id
            JOIN   categories c ON c.id = r.category_id
            WHERE  up.user_id = ?
            ORDER  BY up.saved_at DESC
            LIMIT  8
        ');
        $stmt->execute([uid()]);
        json_ok($stmt->fetchAll());

    default:
        json_err('Unknown action.', 404);
}
