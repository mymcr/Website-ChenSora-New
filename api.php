<?php
session_start(['cookie_httponly' => true, 'cookie_samesite' => 'Lax', 'cookie_secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off']);
// Mengatur header agar outputnya adalah JSON
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit(); }
$requestInput = json_decode(file_get_contents('php://input'), true) ?? [];
$requestAction = $_GET['action'] ?? $requestInput['action'] ?? null;
if (($_SERVER['REQUEST_METHOD'] === 'POST' && $requestAction !== 'login') || $requestAction === 'getTrashData') {
    if (empty($_SESSION['content_admin'])) {
        http_response_code(401);
        echo json_encode(['status' => 'error', 'message' => 'Sesi admin berakhir. Silakan login kembali.']);
        exit();
    }
}

// --- KONFIGURASI DATABASE: tetapkan pada environment hosting ---
$db_host = getenv('DB_HOST') ?: 'localhost';
$db_user = getenv('DB_USER') ?: '';
$db_pass = getenv('DB_PASSWORD') ?: '';
$db_name = getenv('DB_NAME') ?: '';
if ($db_user === '' || $db_name === '') {
    http_response_code(503);
    echo json_encode(['status' => 'error', 'message' => 'Database belum dikonfigurasi. Tetapkan DB_HOST, DB_USER, DB_PASSWORD, dan DB_NAME pada environment hosting.']);
    exit();
}

// Buat koneksi ke database; jangan tampilkan detail koneksi kepada klien.
if (!class_exists('mysqli')) {
    http_response_code(503);
    echo json_encode(['status' => 'error', 'message' => 'Login database memerlukan ekstensi PHP mysqli. Gunakan server hosting yang terkonfigurasi atau akun admin melalui konfigurasi environment.']);
    exit();
}
try {
    $conn = new mysqli($db_host, $db_user, $db_pass, $db_name);
} catch (mysqli_sql_exception $error) {
    http_response_code(503);
    echo json_encode(['status' => 'error', 'message' => 'Database admin belum tersedia pada server ini. Periksa konfigurasi database server.']);
    exit();
}

if ($conn->connect_error) {
    http_response_code(503);
    echo json_encode(['status' => 'error', 'message' => 'Database admin belum tersedia pada server ini.']);
    exit();
}

$input = json_decode(file_get_contents('php://input'), true);
$action = $_GET['action'] ?? $input['action'] ?? null;

$response = ['status' => 'error', 'message' => 'Aksi tidak valid.'];

// --- Helper Function untuk Upload File ---
function uploadFile($fileData) {
    if (isset($fileData) && $fileData['base64']) {
        $base64_string = $fileData['base64'];
        $file_name = uniqid() . '-' . preg_replace('/[^A-Za-z0-9\.\-]/', '', $fileData['name']);
        if (!is_dir('uploads')) {
            mkdir('uploads', 0755, true);
        }
        $file_path = 'uploads/' . $file_name;
        $file_data = base64_decode($base64_string);

        if (file_put_contents($file_path, $file_data)) {
            $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' || $_SERVER['SERVER_PORT'] == 443) ? "https://" : "http://";
            $domainName = $_SERVER['HTTP_HOST'];
            $script_dir = dirname($_SERVER['SCRIPT_NAME']);
            return rtrim($protocol . $domainName . $script_dir, '/') . '/' . $file_path;
        }
    }
    return null;
}

// Router untuk GET requests
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $product = $_GET['product'] ?? null;
    $type = $_GET['type'] ?? '';

    switch ($action) {
        case 'getResellers':
        case 'getWebResellers':
        case 'getAcara':
        case 'getInfluencerVideos':
        case 'getDoctorVideos':
            $tables = [
                'getResellers' => ['name' => 'resellers', 'fields' => 'id, nama, nomor, provinsi, kota, alamat, gmaps, gmaps_embed'],
                'getWebResellers' => ['name' => 'web_resellers', 'fields' => 'id, domain, nomor, products'],
                'getAcara' => ['name' => 'acara', 'fields' => 'id, judul, tanggal, waktu, lokasi, harga_awal, harga_diskon, poster_url'],
                'getInfluencerVideos' => ['name' => 'video_influencer', 'fields' => 'id, title, videoid, product'],
                'getDoctorVideos' => ['name' => 'video_dokter', 'fields' => 'id, title, author, videoid, product']
            ];
            $table_info = $tables[$action];
            $sql = "SELECT {$table_info['fields']} FROM {$table_info['name']} WHERE deleted = FALSE";
            if ($product) {
                $sql .= " AND product = ?";
                $stmt = $conn->prepare($sql);
                $stmt->bind_param("s", $product);
            } else {
                $stmt = $conn->prepare($sql);
            }
            $stmt->execute();
            $result = $stmt->get_result();
            $data = [];
            while ($row = $result->fetch_assoc()) { $data[] = $row; }
            $response = ['status' => 'success', 'data' => $data];
            $stmt->close();
            break;

        case 'getTrashData':
            $tables = [
                'reseller' => 'resellers', 'web-reseller' => 'web_resellers', 'acara' => 'acara',
                'influencer' => 'video_influencer', 'doctor' => 'video_dokter'
            ];
            if (array_key_exists($type, $tables)) {
                $tableName = $tables[$type];
                $stmt = $conn->prepare("SELECT * FROM {$tableName} WHERE deleted = TRUE");
                $stmt->execute();
                $result = $stmt->get_result();
                $data = [];
                while ($row = $result->fetch_assoc()) { $data[] = $row; }
                $response = ['status' => 'success', 'data' => $data];
                $stmt->close();
            } else {
                $response = ['status' => 'error', 'message' => 'Tipe sampah tidak valid.'];
            }
            break;
    }
}


// Router untuk POST requests
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    switch ($action) {
        case 'login':
            $email = $input['email'] ?? ''; $password = $input['password'] ?? '';
            if (empty($email) || empty($password)) { $response = ['status' => 'error', 'message' => 'Email dan password tidak boleh kosong.']; }
            else {
                $stmt = $conn->prepare("SELECT password FROM login WHERE email = ?");
                $stmt->bind_param("s", $email); $stmt->execute(); $result = $stmt->get_result();
                if ($result->num_rows > 0) {
                    $user = $result->fetch_assoc();
                    $isHashed = password_get_info($user['password'])['algo'] !== null;
                    if (($isHashed && password_verify($password, $user['password'])) || (!$isHashed && hash_equals($user['password'], $password))) { session_regenerate_id(true); $_SESSION['content_admin'] = $email; $_SESSION['content_csrf'] = bin2hex(random_bytes(32)); $response = ['status' => 'success', 'user' => ['email' => $email]]; }
                    else { $response = ['status' => 'error', 'message' => 'Email atau password salah.']; }
                } else { $response = ['status' => 'error', 'message' => 'Email atau password salah.']; }
                $stmt->close();
            }
            break;

        // Generic CRUD Actions
        case 'addReseller': $data = $input['data']; $stmt = $conn->prepare("INSERT INTO resellers (nama, nomor, provinsi, kota, alamat, gmaps, gmaps_embed) VALUES (?, ?, ?, ?, ?, ?, ?)"); $stmt->bind_param("sssssss", $data['nama'], $data['nomor'], $data['provinsi'], $data['kota'], $data['alamat'], $data['gmaps'], $data['gmaps_embed']); if ($stmt->execute()) { $response = ['status' => 'success', 'message' => 'Reseller berhasil ditambahkan.']; } else { $response = ['status' => 'error', 'message' => 'Gagal: ' . $stmt->error]; } $stmt->close(); break;
        case 'updateReseller': $data = $input['data']; $stmt = $conn->prepare("UPDATE resellers SET nama=?, nomor=?, provinsi=?, kota=?, alamat=?, gmaps=?, gmaps_embed=? WHERE id=?"); $stmt->bind_param("sssssssi", $data['nama'], $data['nomor'], $data['provinsi'], $data['kota'], $data['alamat'], $data['gmaps'], $data['gmaps_embed'] , $data['id']); if ($stmt->execute()) { $response = ['status' => 'success', 'message' => 'Reseller berhasil diperbarui.']; } else { $response = ['status' => 'error', 'message' => 'Gagal: ' . $stmt->error]; } $stmt->close(); break;
        case 'addWebReseller': $data = $input['data']; $products = implode(', ', $data['products']); $stmt = $conn->prepare("INSERT INTO web_resellers (domain, nomor, products) VALUES (?, ?, ?)"); $stmt->bind_param("sss", $data['domain'], $data['nomor'], $products); if ($stmt->execute()) { $response = ['status' => 'success', 'message' => 'Web-Reseller berhasil ditambahkan.']; } else { $response = ['status' => 'error', 'message' => 'Gagal: ' . $stmt->error]; } $stmt->close(); break;
        case 'updateWebReseller': $data = $input['data']; $products = implode(', ', $data['products']); $stmt = $conn->prepare("UPDATE web_resellers SET domain=?, nomor=?, products=? WHERE id=?"); $stmt->bind_param("sssi", $data['domain'], $data['nomor'], $products, $data['id']); if ($stmt->execute()) { $response = ['status' => 'success', 'message' => 'Web-Reseller berhasil diperbarui.']; } else { $response = ['status' => 'error', 'message' => 'Gagal: ' . $stmt->error]; } $stmt->close(); break;
        case 'addAcara': $data = $input['data']; $poster_url = uploadFile($data['fileData'] ?? null); $stmt = $conn->prepare("INSERT INTO acara (judul, tanggal, waktu, lokasi, harga_awal, harga_diskon, poster_url) VALUES (?, ?, ?, ?, ?, ?, ?)"); $stmt->bind_param("ssssiis", $data['judul'], $data['tanggal'], $data['waktu'], $data['lokasi'], $data['harga_awal'], $data['harga_diskon'], $poster_url); if ($stmt->execute()) { $response = ['status' => 'success', 'message' => 'Acara berhasil ditambahkan.']; } else { $response = ['status' => 'error', 'message' => 'Gagal: ' . $stmt->error]; } $stmt->close(); break;
        case 'updateAcara':
            $data = $input['data']; $poster_url = uploadFile($data['fileData'] ?? null);
            if ($poster_url) {
                $stmt = $conn->prepare("UPDATE acara SET judul=?, tanggal=?, waktu=?, lokasi=?, harga_awal=?, harga_diskon=?, poster_url=? WHERE id=?");
                $stmt->bind_param("ssssiisi", $data['judul'], $data['tanggal'], $data['waktu'], $data['lokasi'], $data['harga_awal'], $data['harga_diskon'], $poster_url, $data['id']);
            } else {
                $stmt = $conn->prepare("UPDATE acara SET judul=?, tanggal=?, waktu=?, lokasi=?, harga_awal=?, harga_diskon=? WHERE id=?");
                $stmt->bind_param("ssssiii", $data['judul'], $data['tanggal'], $data['waktu'], $data['lokasi'], $data['harga_awal'], $data['harga_diskon'], $data['id']);
            }
            if ($stmt->execute()) { $response = ['status' => 'success', 'message' => 'Acara berhasil diperbarui.']; } else { $response = ['status' => 'error', 'message' => 'Gagal: ' . $stmt->error]; }
            $stmt->close();
            break;
        case 'addInfluencerVideo': $data = $input['data']; $stmt = $conn->prepare("INSERT INTO video_influencer (title, videoid, product) VALUES (?, ?, ?)"); $stmt->bind_param("sss", $data['title'], $data['videoid'], $data['product']); if ($stmt->execute()) { $response = ['status' => 'success', 'message' => 'Video berhasil ditambahkan.']; } else { $response = ['status' => 'error', 'message' => 'Gagal: ' . $stmt->error]; } $stmt->close(); break;
        case 'updateInfluencerVideo': $data = $input['data']; $stmt = $conn->prepare("UPDATE video_influencer SET title=?, videoid=?, product=? WHERE id=?"); $stmt->bind_param("sssi", $data['title'], $data['videoid'], $data['product'], $data['id']); if ($stmt->execute()) { $response = ['status' => 'success', 'message' => 'Video berhasil diperbarui.']; } else { $response = ['status' => 'error', 'message' => 'Gagal: ' . $stmt->error]; } $stmt->close(); break;
        case 'addDoctorVideo': $data = $input['data']; $stmt = $conn->prepare("INSERT INTO video_dokter (title, author, videoid, product) VALUES (?, ?, ?, ?)"); $stmt->bind_param("ssss", $data['title'], $data['author'], $data['videoid'], $data['product']); if ($stmt->execute()) { $response = ['status' => 'success', 'message' => 'Video dokter berhasil ditambahkan.']; } else { $response = ['status' => 'error', 'message' => 'Gagal: ' . $stmt->error]; } $stmt->close(); break;
        case 'updateDoctorVideo': $data = $input['data']; $stmt = $conn->prepare("UPDATE video_dokter SET title=?, author=?, videoid=?, product=? WHERE id=?"); $stmt->bind_param("ssssi", $data['title'], $data['author'], $data['videoid'], $data['product'], $data['id']); if ($stmt->execute()) { $response = ['status' => 'success', 'message' => 'Video dokter berhasil diperbarui.']; } else { $response = ['status' => 'error', 'message' => 'Gagal: ' . $stmt->error]; } $stmt->close(); break;

        // Generic Delete, Restore, Perm-Delete
        case 'deleteReseller': case 'deleteWebReseller': case 'deleteAcara': case 'deleteInfluencerVideo': case 'deleteDoctorVideo':
            $tables = ['deleteReseller' => 'resellers', 'deleteWebReseller' => 'web_resellers', 'deleteAcara' => 'acara', 'deleteInfluencerVideo' => 'video_influencer', 'deleteDoctorVideo' => 'video_dokter'];
            $tableName = $tables[$action];
            $stmt = $conn->prepare("UPDATE {$tableName} SET deleted = TRUE WHERE id = ?");
            $stmt->bind_param("i", $input['data']['id']);
            if ($stmt->execute()) { $response = ['status' => 'success', 'message' => 'Data berhasil dipindahkan ke sampah.']; }
            else { $response = ['status' => 'error', 'message' => 'Gagal menghapus: ' . $stmt->error]; }
            $stmt->close();
            break;
        case 'restoreReseller': case 'restoreWebReseller': case 'restoreAcara': case 'restoreInfluencerVideo': case 'restoreDoctorVideo':
            $tables = ['restoreReseller' => 'resellers', 'restoreWebReseller' => 'web_resellers', 'restoreAcara' => 'acara', 'restoreInfluencerVideo' => 'video_influencer', 'restoreDoctorVideo' => 'video_dokter'];
            $tableName = $tables[$action];
            $stmt = $conn->prepare("UPDATE {$tableName} SET deleted = FALSE WHERE id = ?");
            $stmt->bind_param("i", $input['data']['id']);
            if ($stmt->execute()) { $response = ['status' => 'success', 'message' => 'Data berhasil dipulihkan.']; }
            else { $response = ['status' => 'error', 'message' => 'Gagal memulihkan: ' . $stmt->error]; }
            $stmt->close();
            break;
        case 'permanentlyDeleteReseller': case 'permanentlyDeleteWebReseller': case 'permanentlyDeleteAcara': case 'permanentlyDeleteInfluencerVideo': case 'permanentlyDeleteDoctorVideo':
             $tables = ['permanentlyDeleteReseller' => 'resellers', 'permanentlyDeleteWebReseller' => 'web_resellers', 'permanentlyDeleteAcara' => 'acara', 'permanentlyDeleteInfluencerVideo' => 'video_influencer', 'permanentlyDeleteDoctorVideo' => 'video_dokter'];
            $tableName = $tables[$action];
            $stmt = $conn->prepare("DELETE FROM {$tableName} WHERE id = ?");
            $stmt->bind_param("i", $input['data']['id']);
            if ($stmt->execute()) { $response = ['status' => 'success', 'message' => 'Data berhasil dihapus permanen.']; }
            else { $response = ['status' => 'error', 'message' => 'Gagal menghapus permanen: ' . $stmt->error]; }
            $stmt->close();
            break;
    }
}

$conn->close();
echo json_encode($response);
?>

