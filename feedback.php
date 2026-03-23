<?php
// api/feedback.php
require_once __DIR__ . '/config.php';
requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_err('POST only.', 405);

$body    = json_decode(file_get_contents('php://input'), true) ?? [];
$name    = trim($body['name']    ?? '');
$email   = trim($body['email']   ?? '');
$subject = trim($body['subject'] ?? '');
$message = trim($body['message'] ?? '');
$rating  = (int)($body['rating'] ?? 0);

$errors = [];
if (strlen($name)    < 2)                                  $errors[] = 'Name must be at least 2 characters.';
if (!filter_var($email, FILTER_VALIDATE_EMAIL))            $errors[] = 'Invalid email address.';
if (strlen($subject) < 5)                                  $errors[] = 'Subject must be at least 5 characters.';
if (strlen($message) < 20)                                 $errors[] = 'Message must be at least 20 characters.';
if ($rating < 1 || $rating > 5)                            $errors[] = 'Rating must be between 1 and 5.';

if ($errors) json_err(implode(' | ', $errors));

$stmt = db()->prepare('INSERT INTO feedback (user_id, name, email, subject, message, rating) VALUES (?,?,?,?,?,?)');
$stmt->execute([uid(), $name, $email, $subject, $message, $rating]);

json_ok(['id' => (int)db()->lastInsertId()]);
