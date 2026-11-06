<?php
// Public content reads; authenticated, CSRF-protected administration.
session_start(['cookie_httponly' => true, 'cookie_samesite' => 'Lax', 'cookie_secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off']);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
function respond($data, $code = 200) { http_response_code($code); echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); exit; }
function fail($message, $code = 400) { respond(['status' => 'error', 'message' => $message], $code); }
function content_url($value) {
    return $value === '' || (bool)preg_match('~^(https?://[^\s]+|asset/[A-Za-z0-9_./% -]+|uploads/content/[A-Za-z0-9_.-]+)$~i', $value);
}
$method = $_SERVER['REQUEST_METHOD'];
$seed = json_decode(file_get_contents(__DIR__ . '/asset/content-seed.json'), true);
$dataDirectory = getenv('CONTENT_DATA_DIR') ?: __DIR__ . '/content-data';
$store = $dataDirectory . '/store.json';
$groups = ['products', 'experts', 'merchants', 'news'];
if (!is_array($seed)) fail('Konten awal tidak tersedia.', 500);
if ($method === 'GET' && !isset($_GET['admin'])) {
    $data = is_file($store) ? json_decode(file_get_contents($store), true) : $seed;
    if (!is_array($data)) fail('Konten tidak dapat dibaca.', 500);
    foreach ($groups as $group) {
        $data[$group] = array_values(array_filter($data[$group] ?? [], fn($item) => !empty($item['published'])));
        usort($data[$group], fn($a, $b) => ($a['order'] ?? 0) <=> ($b['order'] ?? 0));
    }
    respond(['status' => 'success', 'data' => $data]);
}
// Optional deployment-defined admin credentials also allow local PHP testing without MySQL.
if ($method === 'POST' && ($_GET['action'] ?? '') === 'login') {
    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    $email = getenv('CONTENT_ADMIN_EMAIL'); $hash = getenv('CONTENT_ADMIN_PASSWORD_HASH');
    if (!$email || !$hash) fail('Gunakan akun admin website melalui form login utama.', 409);
    if (time() < ($_SESSION['content_retry_after'] ?? 0)) fail('Tunggu sebentar sebelum mencoba lagi.', 429);
    if (!hash_equals($email, (string)($input['email'] ?? '')) || !password_verify((string)($input['password'] ?? ''), $hash)) {
        $_SESSION['content_retry_after'] = time() + 3;
        fail('Email atau password salah.', 401);
    }
    session_regenerate_id(true); $_SESSION['content_admin'] = $email;
    $_SESSION['content_csrf'] = bin2hex(random_bytes(32));
    respond(['status' => 'success']);
}
if (empty($_SESSION['content_admin'])) fail('Silakan login sebagai admin.', 401);
if ($method === 'GET') {
    $_SESSION['content_csrf'] = $_SESSION['content_csrf'] ?? bin2hex(random_bytes(32));
    $data = is_file($store) ? json_decode(file_get_contents($store), true) : $seed;
    if (!is_array($data)) fail('Konten tidak dapat dibaca.', 500);
    respond(['status' => 'success', 'data' => $data, 'csrf' => $_SESSION['content_csrf'], 'user' => $_SESSION['content_admin'], 'version' => hash('sha256', json_encode($data))]);
}
if ($method !== 'POST') fail('Metode tidak didukung.', 405);
if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 8000000) fail('Berkas terlalu besar.', 413);
$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) fail('JSON tidak valid.');
if (!hash_equals($_SESSION['content_csrf'] ?? '', (string)($input['csrf'] ?? '')) || empty($_SESSION['content_csrf'])) fail('Sesi kedaluwarsa. Muat ulang dashboard.', 403);
if (($input['action'] ?? '') === 'logout') { unset($_SESSION['content_admin'], $_SESSION['content_csrf']); respond(['status' => 'success']); }
$group = $input['group'] ?? '';
if (!in_array($group, $groups, true)) fail('Jenis konten tidak valid.');
$action = $input['action'] ?? '';
if (!in_array($action, ['save', 'delete'], true)) fail('Aksi tidak valid.');
$item = $input['item'] ?? [];
if ($action === 'save') {
    if (trim((string)($item['name'] ?? '')) === '') fail('Nama atau judul wajib diisi.');
    $clean = [];
    foreach (['name'=>200, 'description'=>3000, 'body'=>30000, 'image'=>2000, 'url'=>2000, 'source'=>200, 'date'=>10, 'image_caption'=>500] as $field=>$limit) {
        $value = trim((string)($item[$field] ?? ''));
        if (strlen($value) > $limit * 4) fail('Kolom ' . $field . ' terlalu panjang.');
        $clean[$field] = $value;
    }
    foreach (['image', 'url'] as $field) if (!content_url($clean[$field]) || str_contains($clean[$field], '..')) fail('URL ' . $field . ' tidak valid.');
    if ($group === 'news' && (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $clean['date']) || date('Y-m-d', strtotime($clean['date'])) !== $clean['date'])) fail('Tanggal artikel tidak valid.');
    $clean['order'] = max(0, min(9999, (int)($item['order'] ?? 0)));
    $clean['published'] = ($item['published'] ?? false) === true;
    $id = (string)($item['id'] ?? '');
    if ($id !== '' && !preg_match('/^[a-zA-Z0-9_-]{1,80}$/', $id)) fail('ID tidak valid.');
    $clean['id'] = $id ?: bin2hex(random_bytes(12));
    $clean['updated_at'] = gmdate('c');
}
// One lock covers read, conflict check, and write to avoid concurrent lost updates.
$lock = fopen($dataDirectory . '/write.lock', 'c');
if (!$lock || !flock($lock, LOCK_EX)) fail('Penyimpanan tidak dapat dikunci.', 500);
$data = is_file($store) ? json_decode(file_get_contents($store), true) : $seed;
if (!is_array($data)) fail('Data tersimpan tidak valid.', 500);
if (!hash_equals(hash('sha256', json_encode($data)), (string)($input['version'] ?? ''))) fail('Konten telah berubah. Muat ulang daftar sebelum menyimpan.', 409);
if ($action === 'save' && !empty($input['file'])) {
    $file = $input['file'];
    $binary = base64_decode((string)($file['base64'] ?? ''), true);
    if ($binary === false || strlen($binary) > 5000000) fail('Ukuran gambar maksimum 5 MB.');
    $info = @getimagesizefromstring($binary);
    $extensions = ['image/jpeg'=>'jpg', 'image/png'=>'png', 'image/webp'=>'webp'];
    if (!$info || !isset($extensions[$info['mime']]) || $info[0] * $info[1] > 40000000) fail('Gunakan gambar JPEG, PNG, atau WebP yang valid.');
    $directory = __DIR__ . '/uploads/content';
    if (!is_dir($directory) && !mkdir($directory, 0755, true)) fail('Folder gambar tidak dapat dibuat.', 500);
    $relative = 'uploads/content/' . bin2hex(random_bytes(16)) . '.' . $extensions[$info['mime']];
    if (file_put_contents(__DIR__ . '/' . $relative, $binary) === false) fail('Gambar gagal disimpan.', 500);
    $clean['image'] = $relative;
}
$items = $data[$group] ?? [];
if ($action === 'delete') {
    $id = (string)($item['id'] ?? '');
    if ($id === '') fail('ID wajib diisi.');
    $items = array_values(array_filter($items, fn($row) => $row['id'] !== $id));
} else {
    $found = false;
    foreach ($items as &$row) if ($row['id'] === $clean['id']) { $row = $clean; $found = true; break; }
    unset($row);
    if (!$found) $items[] = $clean;
}
$data[$group] = $items;
$temporary = tempnam($dataDirectory, 'save-');
$json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
if (!$temporary || $json === false || file_put_contents($temporary, $json) === false || !rename($temporary, $store)) fail('Konten gagal disimpan.', 500);
flock($lock, LOCK_UN); fclose($lock);
respond(['status' => 'success', 'message' => 'Konten berhasil disimpan.']);
