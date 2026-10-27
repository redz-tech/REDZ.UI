<?php
// The probes' static server for php -S: the library's working tree as files, never cached; nothing outside it and no
// path through a dot folder.
$root = (string)realpath(__DIR__ . '/../..');
$path = rawurldecode((string)parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));
if (str_ends_with($path, '/')) {
	$path .= 'index.html';
}
$file = realpath($root . $path);
if ($file === false || !str_starts_with($file, $root . '/') || !is_file($file) || str_contains(substr($file, strlen($root)), '/.')) {
	http_response_code(404);
	header('Cache-Control: no-store');
	echo 'not found';
	return true;
}
$types = ['html' => 'text/html; charset=utf-8', 'css' => 'text/css', 'js' => 'text/javascript', 'svg' => 'image/svg+xml', 'json' => 'application/json', 'png' => 'image/png', 'webp' => 'image/webp'];
header('Content-Type: ' . ($types[pathinfo($file, PATHINFO_EXTENSION)] ?? 'application/octet-stream'));
header('Cache-Control: no-store');
readfile($file);
return true;
