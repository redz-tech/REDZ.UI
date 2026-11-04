<?php
// convert.php - rewrites a stored Bootstrap 5.3 body, an HTML fragment, into REDZ.UI markup once, by the skill's
// assets/map.tsv: a class of kind same stays, rename, value and grid take their REDZ.UI form, remove goes; a row gets
// the columns its children's spans need; a few review rows follow their context (CONVERT__Context); a --bs-* custom
// property in a style attribute takes its renamed form. Everything else is left as it was and told: the other review
// rows, state classes, missing parts, data-bs-* attributes, unknown classes. Needs PHP 8.4+ (Dom\HTMLDocument).
// Usage: php convert.php FILE... - each file rewritten in place, its notes printed as FILE: TOKEN · KIND · NOTE;
// php convert.php < BODY > NEW - stdin to stdout, the notes to stderr. From PHP: define CONVERT_LIBRARY, require this
// file, then [$html, $notes] = CONVERT__Body($html); a note is [token, kind, note, count].

const CONVERT_MAP = __DIR__ . '/../assets/map.tsv';
const CONVERT_CLASSES = __DIR__ . '/../assets/classes.txt';
const CONVERT_TONES = ['primary', 'secondary', 'success', 'danger', 'warning', 'info'];

/**
 * The map's rows by Bootstrap's name: [form, kind, note]; classes and custom properties.
 * @return array<string, array{string, string, string}>
 */
function CONVERT__Map(): array
{
	static $map = null;
	if ($map === null) {
		$map = [];
		foreach (array_slice(file(CONVERT_MAP, FILE_IGNORE_NEW_LINES) ?: [], 1) as $line) {
			$cells = explode("\t", $line);
			if (in_array($cells[3] ?? '', ['class', 'property'], true)) {
				$map[$cells[0]] = [$cells[1] ?? '', $cells[2] ?? '', $cells[5] ?? ''];
			}
		}
	}
	return $map;
}

/**
 * REDZ.UI's classes, as keys.
 * @return array<string, int>
 */
function CONVERT__Ours(): array
{
	static $ours = null;
	return $ours ??= array_flip(file(CONVERT_CLASSES, FILE_IGNORE_NEW_LINES) ?: []);
}

/**
 * A class's REDZ.UI tokens by its context, for the review rows this converter decides: null when no rule takes it.
 * @param array<string, int> $has the element's classes as they came
 * @return ?list<string>
 */
function CONVERT__Context(string $token, Dom\Element $element, array $has): ?array
{
	if (preg_match('~^text-bg-(primary|secondary|success|danger|warning|info|light|dark)$~', $token, $m) === 1 && isset($has['badge'])) {
		return match ($m[1]) {
			'light' => [],
			'dark' => ['badge-inverse'],
			default => ['badge-' . $m[1]],
		};
	}
	if ($token === 'table-sm' && $element->localName === 'table') {
		$element->setAttribute('data-density', 'compact');
		return [];
	}
	if ($token === 'text-white') {
		foreach (CONVERT_TONES as $tone) {
			if (isset($has['bg-' . $tone])) {
				return ['text-' . $tone . '-contrast'];
			}
		}
		return null;
	}
	return match (true) {
		$token === 'lead' => ['fs-16', 'text-muted'],
		preg_match('~^display-[1-6]$~', $token) === 1 => ['fs-32'],
		in_array($token, ['img-fluid', 'alert-light', 'alert-secondary'], true) => [],
		default => null,
	};
}

/**
 * The columns a row's grid needs for its children's spans: cols-12 from the narrowest width one of them spans at, or
 * as many equal columns as it has children of class col; [] when its row-cols-* already set them.
 * @param array<string, int> $has the row's classes as they came
 * @return list<string>
 */
function CONVERT__Columns(Dom\Element $row, array $has): array
{
	foreach (array_keys($has) as $class) {
		if (str_starts_with((string)$class, 'row-cols-')) {
			return [];
		}
	}
	$widths = ['' => 0, 'sm' => 1, 'md' => 2, 'lg' => 3, 'xl' => 4, 'xxl' => 5];
	$narrowest = null;
	$equal = 0;
	foreach ($row->children as $child) {
		foreach (preg_split('~\s+~', trim($child->getAttribute('class') ?? ''), -1, PREG_SPLIT_NO_EMPTY) as $class) {
			if ($class === 'col') {
				$equal++;
			} elseif (preg_match('~^col(?:-(sm|md|lg|xl|xxl))?-(\d+)$~', $class, $m) === 1 && ($narrowest === null || $widths[$m[1]] < $widths[$narrowest])) {
				$narrowest = $m[1];
			}
		}
	}
	if ($narrowest !== null) {
		return [($narrowest === '' ? '' : ($narrowest === 'xxl' ? '2xl' : $narrowest) . ':') . 'cols-12'];
	}
	return $equal > 0 ? ['cols-' . min($equal, 12)] : [];
}

/**
 * Tells a token once more.
 * @param array<string, array{string, string, string, int}> $notes
 */
function CONVERT__Note(array &$notes, string $token, string $kind, string $note): void
{
	$notes[$token] ??= [$token, $kind, $note, 0];
	$notes[$token][3]++;
}

/**
 * Rewrites the element and everything under it, the element's classes read before its children are.
 * @param array<string, array{string, string, string, int}> $notes
 */
function CONVERT__Element(Dom\Element $element, array &$notes): void
{
	$map = CONVERT__Map();
	$ours = CONVERT__Ours();
	$tokens = preg_split('~\s+~', trim($element->getAttribute('class') ?? ''), -1, PREG_SPLIT_NO_EMPTY);
	$has = array_flip($tokens);
	$out = [];
	foreach ($tokens as $token) {
		$context = CONVERT__Context($token, $element, $has);
		if ($context !== null) {
			array_push($out, ...$context);
			continue;
		}
		[$form, $kind, $note] = $map[$token] ?? ['', isset($ours[$token]) ? 'ours' : 'unknown', ''];
		if (in_array($kind, ['rename', 'value', 'grid'], true)) {
			array_push($out, ...preg_split('~\s+~', $form, -1, PREG_SPLIT_NO_EMPTY));
		} elseif ($kind !== 'remove') {
			$out[] = $token;
			if (!in_array($kind, ['same', 'ours'], true)) {
				CONVERT__Note($notes, $token, $kind, $note);
			}
		}
	}
	if ($tokens !== []) {
		$out = array_values(array_unique([...$out, ...(isset($has['row']) ? CONVERT__Columns($element, $has) : [])]));
		if ($out === []) {
			$element->removeAttribute('class');
		} else {
			$element->setAttribute('class', implode(' ', $out));
		}
	}
	$style = $element->getAttribute('style');
	if ($style !== null && str_contains($style, '--bs-')) {
		$element->setAttribute('style', (string)preg_replace_callback('~--bs-[a-z0-9-]*[a-z0-9]~', function (array $m) use ($map, &$notes): string {
			[$form, $kind, $note] = $map[$m[0]] ?? ['', 'review', 'a custom property Bootstrap 5.3 does not define'];
			if ($kind === 'rename' && $form !== '') {
				return $form;
			}
			CONVERT__Note($notes, $m[0], $kind, $note);
			return $m[0];
		}, $style));
	}
	foreach ($element->attributes as $attribute) {
		if (str_starts_with($attribute->name, 'data-bs-')) {
			CONVERT__Note($notes, $attribute->name, 'trigger', 'by hand: the skill\'s references/states-and-triggers.md');
		}
	}
	foreach ($element->children as $child) {
		CONVERT__Element($child, $notes);
	}
}

/**
 * The body in REDZ.UI markup and what was left as it came.
 * @return array{string, list<array{string, string, string, int}>}
 */
function CONVERT__Body(string $html): array
{
	$document = Dom\HTMLDocument::createFromString('<!doctype html><html><head><meta charset="utf-8"></head><body>' . $html . '</body></html>', LIBXML_NOERROR);
	$notes = [];
	foreach ($document->body->children as $child) {
		CONVERT__Element($child, $notes);
	}
	return [$document->body->innerHTML, array_values($notes)];
}

/**
 * The command line: files rewritten in place, or stdin to stdout; the exit code.
 * @param list<string> $argv
 */
function CONVERT__Main(array $argv): int
{
	$files = array_slice($argv, 1);
	if ($files === []) {
		[$html, $notes] = CONVERT__Body((string)stream_get_contents(STDIN));
		echo $html;
		foreach ($notes as [$token, $kind, $note, $count]) {
			fwrite(STDERR, $token . ' · ' . $kind . ' · ' . $note . ($count > 1 ? ' (' . $count . ')' : '') . "\n");
		}
		return 0;
	}
	foreach ($files as $file) {
		[$html, $notes] = CONVERT__Body((string)file_get_contents($file));
		file_put_contents($file, $html);
		foreach ($notes as [$token, $kind, $note, $count]) {
			echo $file, ': ', $token, ' · ', $kind, ' · ', $note, $count > 1 ? ' (' . $count . ')' : '', "\n";
		}
	}
	return 0;
}

if (!defined('CONVERT_LIBRARY')) {
	exit(CONVERT__Main($argv));
}
