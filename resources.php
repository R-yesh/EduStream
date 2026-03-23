<?php
// api/resources.php
require_once __DIR__ . '/config.php';
requireAuth();

$action = $_GET['action'] ?? '';

switch ($action) {

    // ── GET ?action=list ─────────────────────────────────────
    // Query params: q, difficulty, category, page (default 1), per_page (default 9)
    case 'list':
        $q       = trim($_GET['q']          ?? '');
        $diff    = trim($_GET['difficulty'] ?? '');
        $catId   = (int)($_GET['category']  ?? 0);
        $page    = max(1, (int)($_GET['page']     ?? 1));
        $perPage = min(50, max(1, (int)($_GET['per_page'] ?? 9)));
        $offset  = ($page - 1) * $perPage;

        $where = ['1=1']; $params = [];
        if ($q !== '') {
            $where[] = '(r.title LIKE :q OR r.description LIKE :q OR c.name LIKE :q OR r.author LIKE :q)';
            $params[':q'] = '%' . $q . '%';
        }
        if (in_array($diff, ['Beginner','Intermediate','Advanced'], true)) {
            $where[] = 'r.difficulty_level = :diff';
            $params[':diff'] = $diff;
        }
        if ($catId > 0) { $where[] = 'r.category_id = :cat'; $params[':cat'] = $catId; }

        $w = implode(' AND ', $where);

        $cnt = db()->prepare("SELECT COUNT(*) FROM resources r JOIN categories c ON c.id=r.category_id WHERE $w");
        $cnt->execute($params);
        $total = (int)$cnt->fetchColumn();

        $sql = "SELECT r.*, c.name AS cat_name, c.icon AS cat_icon FROM resources r
                JOIN categories c ON c.id=r.category_id WHERE $w
                ORDER BY r.difficulty_level ASC, r.title ASC LIMIT :lim OFFSET :off";
        $stmt = db()->prepare($sql);
        foreach ($params as $k => $v) $stmt->bindValue($k, $v);
        $stmt->bindValue(':lim', $perPage, PDO::PARAM_INT);
        $stmt->bindValue(':off', $offset,  PDO::PARAM_INT);
        $stmt->execute();
        $rows = $stmt->fetchAll();

        // Attach progress status for current user
        $ids = array_column($rows, 'id');
        $savedMap = [];
        if ($ids) {
            $placeholders = implode(',', array_fill(0, count($ids), '?'));
            $ps = db()->prepare("SELECT resource_id, status FROM user_progress WHERE user_id = ? AND resource_id IN ($placeholders)");
            $ps->execute(array_merge([uid()], $ids));
            foreach ($ps->fetchAll() as $r) $savedMap[(int)$r['resource_id']] = $r['status'];
        }
        foreach ($rows as &$row) {
            $row['user_status'] = $savedMap[(int)$row['id']] ?? null;
        }
        unset($row);

        json_ok([
            'resources'   => $rows,
            'total'       => $total,
            'page'        => $page,
            'total_pages' => max(1, (int)ceil($total / $perPage)),
        ]);

    // ── GET ?action=categories ───────────────────────────────
    case 'categories':
        $rows = db()->query('SELECT * FROM categories ORDER BY name')->fetchAll();
        json_ok($rows);

    // ── POST ?action=progress ────────────────────────────────
    case 'progress':
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $rid    = (int)($body['resource_id'] ?? 0);
        $status = $body['status'] ?? '';
        $valid  = ['Saved', 'In Progress', 'Completed'];

        if ($rid <= 0 || !in_array($status, $valid, true)) json_err('Invalid resource_id or status.');

        // Verify resource exists
        $chk = db()->prepare('SELECT id FROM resources WHERE id = ?');
        $chk->execute([$rid]);
        if (!$chk->fetch()) json_err('Resource not found.', 404);

        $stmt = db()->prepare('
            INSERT INTO user_progress (user_id, resource_id, status)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE status = VALUES(status), saved_at = CURRENT_TIMESTAMP
        ');
        $stmt->execute([uid(), $rid, $status]);
        json_ok(['resource_id' => $rid, 'status' => $status]);

    // ── GET ?action=recommend ────────────────────────────────
    case 'recommend':
        $diff  = trim($_GET['difficulty'] ?? '');
        $catId = (int)($_GET['category']  ?? 0);

        $user  = db()->prepare('SELECT preferred_difficulty FROM users WHERE id = ?');
        $user->execute([uid()]);
        $u = $user->fetch();
        if (!$diff || !in_array($diff, ['Beginner','Intermediate','Advanced'], true)) {
            $diff = $u['preferred_difficulty'] ?? 'Beginner';
        }

        $diffMap = ['Beginner'=>'Intermediate','Intermediate'=>'Advanced','Advanced'=>'Intermediate'];
        $rec1 = recommendResource(uid(), $diff, $catId);
        $rec2 = recommendResource(uid(), $diff, $catId ? $catId + 1 : 0);
        $rec3 = recommendResource(uid(), $diffMap[$diff] ?? 'Intermediate');

        json_ok(array_values(array_filter([$rec1, $rec2, $rec3])));

    default:
        json_err('Unknown action.', 404);
}
