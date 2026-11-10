<?php
// The probes' static server for php -S: the library's working tree as files, never cached; nothing outside it and no
// path through a dot folder. The pages require Trusted Types, as a strict consumer does: only the editor's policy and
// the behaviour checks' own may make markup. PROBE_CSP in the environment replaces that Content-Security-Policy, and
// empty sends none. For the checks of pages that change, a query asks of a page: probe-wait - an answer so many ms late,
// up to 5000; probe-transition - that data-transition on its html; probe-scroll - that data-scroll on its app-sidebar;
// probe-trace - REDZ_PROBE_REVEAL, what its pagereveal brought: a view transition, whether it ran, and how many
// animations of the page's root it ran beside its group's.
$root = (string)realpath(__DIR__ . '/../..');
$path = rawurldecode((string)parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));
if (str_ends_with($path, '/')) {
	$path .= 'index.html';
}
$file = realpath($root . $path);
if ($file === false || !str_starts_with($file, $root . DIRECTORY_SEPARATOR) || !is_file($file) || str_contains(substr($file, strlen($root)), DIRECTORY_SEPARATOR . '.')) {
	http_response_code(404);
	header('Cache-Control: no-store');
	echo 'not found';
	return true;
}
$types = ['html' => 'text/html; charset=utf-8', 'css' => 'text/css', 'js' => 'text/javascript', 'svg' => 'image/svg+xml', 'json' => 'application/json', 'png' => 'image/png', 'webp' => 'image/webp'];
header('Content-Type: ' . ($types[pathinfo($file, PATHINFO_EXTENSION)] ?? 'application/octet-stream'));
header('Cache-Control: no-store');
$policy = getenv('PROBE_CSP');
$policy = $policy === false ? "require-trusted-types-for 'script'; trusted-types redz-editor redz-probe 'allow-duplicates'" : $policy;
if (str_ends_with($file, '.html') && $policy !== '') {
	header('Content-Security-Policy: ' . $policy);
}
parse_str((string)parse_url($_SERVER['REQUEST_URI'], PHP_URL_QUERY), $asked);
usleep(1000 * min(5000, max(0, (int)($asked['probe-wait'] ?? 0))));
if (!str_ends_with($file, '.html') || array_intersect_key($asked, ['probe-transition' => 1, 'probe-scroll' => 1, 'probe-trace' => 1]) === []) {
	readfile($file);
	return true;
}
$page = (string)file_get_contents($file);
if (isset($asked['probe-transition'])) {
	$page = (string)preg_replace('~<html\b~', '<html data-transition="' . htmlspecialchars((string)$asked['probe-transition']) . '"', $page, 1);
}
if (isset($asked['probe-scroll'])) {
	$page = (string)preg_replace('~class="app-sidebar"~', 'class="app-sidebar" data-scroll="' . htmlspecialchars((string)$asked['probe-scroll']) . '"', $page, 1);
}
if (isset($asked['probe-trace'])) {
	$page = (string)preg_replace('~<head>~', "<head>\n<script>addEventListener('pagereveal', (event) => { const shown = event.viewTransition ?? null; window.REDZ_PROBE_REVEAL = {transition: shown !== null, ready: '', root: -1}; shown?.ready.then(() => { REDZ_PROBE_REVEAL.ready = 'ran'; REDZ_PROBE_REVEAL.root = document.getAnimations().filter((one) => /^::view-transition-(old|new)\(root\)$/.test(one.effect?.pseudoElement ?? '')).length; }, () => { REDZ_PROBE_REVEAL.ready = 'skipped'; }); });</script>", $page, 1);
}
echo $page;
return true;
