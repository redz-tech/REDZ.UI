<?php
// probes, the sheet: the shots as WebP and the page that shows them with the findings beside, on the library's own CSS
// copied in, so the folder opens anywhere — from disk, as a CI artifact, on the site.

/** The PNG $png without its iCCP chunk: libpng warns on the colour profile Safari writes, and GD ignores profiles. */
function PROBE__PngPlain(string $png): string
{
	if (!str_starts_with($png, "\x89PNG\r\n\x1a\n")) {
		return $png;
	}
	$plain = substr($png, 0, 8);
	$at = 8;
	while ($at + 12 <= strlen($png)) {
		$length = unpack('N', $png, $at)[1];
		if (substr($png, $at + 4, 4) !== 'iCCP') {
			$plain .= substr($png, $at, 12 + $length);
		}
		$at += 12 + $length;
	}
	return $plain;
}

/** Writes the PNG $png as WebP $file at one image pixel a CSS pixel ($scale device pixels each), at most 16 000 tall;
 *  answers its width and height. */
function PROBE__ShotWrite(string $png, float $scale, string $file): array
{
	$image = imagecreatefromstring(PROBE__PngPlain($png));
	if ($image === false) {
		throw new RuntimeException('a shot that is not an image: ' . basename($file));
	}
	$width = max(1, (int)round(imagesx($image) / $scale));
	$height = min(16000, max(1, (int)round(imagesy($image) / $scale)));
	$small = imagecreatetruecolor($width, $height);
	imagecopyresampled($small, $image, 0, 0, 0, 0, $width, $height, (int)round($width * $scale), (int)round($height * $scale));
	imagewebp($small, $file, 80);
	return [$width, $height];
}

/** The first page of the PDF $pdf as a WebP shot $file through macOS sips; answers its size, or [] where sips is
 *  missing. */
function PROBE__PrintShotWrite(string $pdf, string $file): array
{
	if (!is_file('/usr/bin/sips')) {
		return [];
	}
	$png = $file . '.png';
	PROBE__Run(['/usr/bin/sips', '-s', 'format', 'png', $pdf, '--out', $png]);
	$size = is_file($png) ? PROBE__ShotWrite((string)file_get_contents($png), 1.0, $file) : [];
	@unlink($png);
	return $size;
}

/** Copies the library's stylesheets into the sheet folder $dir, so its page needs nothing outside it. */
function PROBE__SheetCss(string $dir): void
{
	foreach (['css', 'css/components'] as $folder) {
		@mkdir($dir . '/' . $folder, 0777, true);
		foreach (glob(PROBE_ROOT . '/' . $folder . '/*.css') ?: [] as $file) {
			if (basename($file) !== 'icons.css') {
				copy($file, $dir . '/' . $folder . '/' . basename($file));
			}
		}
	}
	copy(__DIR__ . '/sheet.css', $dir . '/sheet.css');
}

/** HTML text of $text. */
function PROBE__Html(string $text): string
{
	return htmlspecialchars($text, ENT_QUOTES | ENT_HTML5, 'UTF-8');
}

/** Writes the sheet $dir/index.html: the run, then for each page its engines with their shots and findings. */
function PROBE__SheetWrite(string $dir, array $report): void
{
	PROBE__SheetCss($dir);
	$total = count($report['findings']);
	$out = ['<!doctype html>', '<html lang="en">', '<head>', '<meta charset="utf-8">', '<meta name="viewport" content="width=device-width, initial-scale=1">', '<title>REDZ.UI checks</title>', '<link rel="stylesheet" href="css/index.css">', '<link rel="stylesheet" href="sheet.css">', '</head>', '<body>', '<main class="region sheet vstack gap-24">'];
	$out[] = '<header class="vstack gap-8"><h1>Checks</h1><p class="text-muted">' . PROBE__Html($report['when'] . ' · ' . $report['commit']) . ' · the library\'s pages in real engines, light LTR and dark RTL, at ' . PROBE__Html(implode(', ', $report['widths'])) . ' px</p>';
	$out[] = '<div class="hstack flex-wrap gap-8">' . ($total === 0 ? '<span class="badge badge-subtle-success">no findings</span>' : '<span class="badge badge-subtle-danger">' . $total . ' findings</span>');
	foreach ($report['engines'] as $name => $engine) {
		$out[] = '<span class="badge">' . PROBE__Html($name . ' · ' . $engine['version'] . ' · ' . $engine['cells'] . ' cells') . '</span>';
	}
	foreach ($report['skipped'] as $name => $why) {
		$out[] = '<span class="badge badge-subtle-warning">' . PROBE__Html($name . ' skipped: ' . $why) . '</span>';
	}
	$out[] = '</div></header>';
	if ($total > 0) {
		$out[] = '<section class="card"><div class="card-header"><h2>Findings</h2></div><div class="card-body"><ul class="sheet-findings">';
		foreach ($report['findings'] as $finding) {
			$out[] = '<li>' . PROBE__Html($finding) . '</li>';
		}
		$out[] = '</ul></div></section>';
	}
	if ($report['walked'] !== []) {
		$out[] = '<section class="card"><div class="card-header"><h2>Walked by keyboard</h2></div><div class="card-body vstack gap-8"><p class="text-muted">Each menu, modal dialog and tab list driven by real keys against the WAI-ARIA patterns, at 1440 px in both directions.</p><ul class="sheet-findings">';
		foreach ($report['walked'] as $page => $widgets) {
			foreach ($widgets as $widget => $engines) {
				$out[] = '<li>' . PROBE__Html($page . ' — ' . $widget . ' · ' . implode(', ', array_keys($engines))) . '</li>';
			}
		}
		$out[] = '</ul></div></section>';
	}
	if ($report['guarded'] !== []) {
		$out[] = '<section class="card"><div class="card-header"><h2>Placed by js/menu-place.js</h2></div><div class="card-body vstack gap-8"><p class="text-muted">Menus the engine did not anchor beside their button, placed by the script instead — the measure of where the guard is still needed.</p><ul class="sheet-findings">';
		foreach ($report['guarded'] as $note) {
			$out[] = '<li>' . PROBE__Html($note) . '</li>';
		}
		$out[] = '</ul></div></section>';
	}
	foreach ($report['shots'] as $page => $engines) {
		$out[] = '<section class="card"><div class="card-header"><h2>' . PROBE__Html($page) . '</h2></div><div class="card-body vstack gap-24">';
		foreach ($engines as $name => $shots) {
			$out[] = '<div class="vstack gap-8"><h3>' . PROBE__Html($name . ' · ' . $report['engines'][$name]['version']) . '</h3><div class="sheet-shots">';
			foreach ($shots as $shot) {
				$out[] = '<figure><a href="' . PROBE__Html($shot['file']) . '"><img src="' . PROBE__Html($shot['file']) . '" width="' . $shot['size'][0] . '" height="' . $shot['size'][1] . '" loading="lazy" alt="' . PROBE__Html($page . ', ' . $name . ', ' . $shot['label']) . '"></a><figcaption class="text-muted fs-12">' . PROBE__Html($shot['label']) . '</figcaption></figure>';
			}
			$out[] = '</div></div>';
		}
		$out[] = '</div></section>';
	}
	$out[] = '</main>';
	$out[] = '</body>';
	$out[] = '</html>';
	file_put_contents($dir . '/index.html', implode("\n", $out) . "\n");
}
