<?php
declare(strict_types=1);

// Copy this file to config.php and supply the production database values.
// api/config.php is ignored by Git so credentials are never committed.
return [
    'host' => getenv('GTC_DB_HOST') ?: 'your-mysql-host',
    'port' => 3306,
    'database' => getenv('GTC_DB_NAME') ?: 'your-database-name',
    'username' => getenv('GTC_DB_USER') ?: 'your-database-user',
    'password' => getenv('GTC_DB_PASSWORD') ?: 'your-database-password',
];

