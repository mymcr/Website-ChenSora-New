<?php
$path = rawurldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));
if (preg_match('~^/(?:content-data|scratch|\.git)(?:/|$)~', $path) || str_contains($path, '/.')) {
    http_response_code(403); echo 'Forbidden'; return true;
}
return false;
