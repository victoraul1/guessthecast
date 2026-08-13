<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function respond(int $status, array $payload): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function database(): PDO
{
    $config = require __DIR__ . '/config.php';
    $dsn = sprintf(
        'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
        $config['host'],
        $config['port'],
        $config['database']
    );

    $pdo = new PDO($dsn, $config['username'], $config['password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);

    // First-run setup makes deployment possible without a separate migration step.
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS winners (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            username VARCHAR(24) NOT NULL,
            ip_hash CHAR(64) NOT NULL,
            user_agent_hash CHAR(64) NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            INDEX idx_winners_created (created_at, id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );

    return $pdo;
}

function cleanUsername($value): string
{
    if (!is_string($value)) {
        return '';
    }
    $value = trim(preg_replace('/\s+/u', ' ', $value) ?? '');
    return $value;
}

if (!in_array($_SERVER['REQUEST_METHOD'] ?? '', ['GET', 'POST'], true)) {
    header('Allow: GET, POST');
    respond(405, ['error' => 'Method not allowed.']);
}

try {
    $pdo = database();

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $statement = $pdo->query(
            'SELECT username, created_at
             FROM winners
             ORDER BY created_at ASC, id ASC
             LIMIT 50'
        );
        respond(200, ['winners' => $statement->fetchAll()]);
    }

    $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
    if (strpos(strtolower($contentType), 'application/json') !== 0) {
        respond(415, ['error' => 'Expected a JSON request.']);
    }

    $body = json_decode(file_get_contents('php://input') ?: '', true);
    if (!is_array($body)) {
        respond(400, ['error' => 'Invalid JSON request.']);
    }

    $username = cleanUsername($body['username'] ?? null);
    $length = mb_strlen($username);
    if ($length < 2 || $length > 24) {
        respond(422, ['error' => 'Username must contain between 2 and 24 characters.']);
    }

    // Keep control characters and markup-like input out of the public table.
    if (preg_match('/[\x00-\x1F\x7F<>]/u', $username)) {
        respond(422, ['error' => 'Username contains unsupported characters.']);
    }

    $statement = $pdo->prepare(
        'INSERT INTO winners (username, ip_hash, user_agent_hash)
         VALUES (:username, :ip_hash, :user_agent_hash)'
    );
    $statement->execute([
        ':username' => $username,
        ':ip_hash' => hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . '|guessthecast'),
        ':user_agent_hash' => hash('sha256', $_SERVER['HTTP_USER_AGENT'] ?? ''),
    ]);

    respond(201, ['ok' => true]);
} catch (PDOException $error) {
    error_log('Guess the Cast database error: ' . $error->getMessage());
    respond(503, ['error' => 'The winners table is temporarily unavailable.']);
} catch (Throwable $error) {
    error_log('Guess the Cast API error: ' . $error->getMessage());
    respond(500, ['error' => 'Unexpected server error.']);
}
