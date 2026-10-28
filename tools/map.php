<?php
// map — the machine map Bootstrap 5.3.8 → REDZ.UI for the migration skill and the docs: every class of Bootstrap's
// stylesheet gets a row — its REDZ.UI form and the kind of change — by the first rule of tools/map/rules.tsv that
// matches it, a breakpoint infix turned into a width prefix; the attributes and calls of tools/map/extra.tsv follow.
// Writes skills/*/assets/map.tsv and classes.txt (every class of the library, the icons included) — real copies in
// each skill, as installers copy a skill's folder alone. A class with no rule, or a target the library does not have,
// is an error. Usage: php tools/map.php [--check] | refresh — refresh downloads bootstrap@5.3.8 from npm, checks its
// sha512 and writes the class list tools/map/bootstrap.txt.
require __DIR__ . '/lib.php';

const MAP_ROOT = __DIR__ . '/..';
const MAP_SKILLS = ['skills/redz-ui-from-bootstrap-5/assets', 'skills/redz-ui/assets'];
const MAP_SPACE = ['0' => '0', '1' => '4', '2' => '8', '3' => '16', '4' => '24', '5' => '48', 'auto' => 'auto'];
const MAP_RESPONSIVE = '~^(d|flex|justify-content|align-items|align-self|align-content|order|[mp][tbsexy]?|gap|row-gap|column-gap|text|float|col|row-cols|offset|g|gx|gy|object-fit|sticky)-(sm|md|lg|xl|xxl|print)(-[a-z0-9-]+)?$~';
const MAP_HEAD = "bs5\tredz\tkind\tscope\tpage\tnote";
const MAP_KINDS = ['same', 'rename', 'value', 'grid', 'state', 'trigger', 'remove', 'missing', 'review'];

/** refresh: downloads Bootstrap 5.3.8, checks the registry's sha512 and writes its sorted class list. */
function MAP__Refresh(): int
{
	$package = TOOL__NpmFile('bootstrap', '5.3.8', 'package/dist/css/bootstrap.css');
	$css = (string)preg_replace('~/\*.*?\*/~s', '', $package['body']);
	preg_match_all('~([^{}]+)\{~', $css, $selectors);
	$classes = [];
	foreach ($selectors[1] as $selector) {
		if (!str_starts_with(trim($selector), '@')) {
			preg_match_all('~\.([a-zA-Z_][\w-]*)~', $selector, $found);
			foreach ($found[1] as $class) {
				$classes[$class] = true;
			}
		}
	}
	ksort($classes, SORT_STRING);
	file_put_contents(__DIR__ . '/map/bootstrap.txt', '# bootstrap ' . $package['version'] . ' ' . $package['integrity'] . " dist/css/bootstrap.css — derived by php tools/map.php refresh, do not edit\n" . implode("\n", array_keys($classes)) . "\n");
	echo 'wrote tools/map/bootstrap.txt · ', count($classes), " classes\n";
	return 0;
}

/**
 * Every class of the library's stylesheets, unescaped — components, utilities with their prefixes, icons — with the
 * docs page of its stylesheet ('' for the base layers).
 * @return array<string, string>
 */
function MAP__Classes(): array
{
	$classes = [];
	foreach ([...glob(MAP_ROOT . '/css/*.css'), ...glob(MAP_ROOT . '/css/components/*.css')] as $file) {
		$page = basename($file, '.css');
		$page = in_array($page, ['base', 'reset', 'tokens', 'scales', 'layers', 'index'], true) ? '' : $page;
		$css = (string)preg_replace(['~/\*.*?\*/~s', '~url\([^)]*\)~'], '', (string)file_get_contents($file));
		preg_match_all('~([^{}]+)\{~', $css, $selectors);
		foreach ($selectors[1] as $selector) {
			if (str_starts_with(trim($selector), '@')) {
				continue;
			}
			preg_match_all('~\.((?:\\\\[0-9a-f]{1,6} ?|\\\\.|[\w-])+)~', $selector, $found);
			foreach ($found[1] as $class) {
				$class = (string)preg_replace_callback('~\\\\([0-9a-f]{1,6}) ?|\\\\(.)~', fn(array $m): string => ($m[2] ?? '') !== '' ? $m[2] : mb_chr((int)hexdec($m[1])), $class);
				$classes[$class][] = $page;
			}
		}
	}
	ksort($classes, SORT_STRING);
	foreach ($classes as $class => $pages) {
		$named = array_filter($pages, fn(string $page): bool => $page !== '' && ($class === $page || str_starts_with($class, $page . '-')));
		$classes[$class] = $named === [] ? $pages[0] : reset($named);
	}
	return $classes;
}

/**
 * The rules of a tab-separated file: [pattern or name, redz, kind, page, note], comments and blank lines skipped.
 * @return list<list<string>>
 */
function MAP__Rules(string $file): array
{
	$rules = [];
	foreach (explode("\n", (string)file_get_contents(__DIR__ . '/map/' . $file)) as $n => $line) {
		if (trim($line) === '' || str_starts_with($line, '#')) {
			continue;
		}
		$rule = array_pad(explode("\t", $line), 5, '');
		if (!in_array($rule[2], MAP_KINDS, true)) {
			throw new RuntimeException('tools/map/' . $file . ':' . ($n + 1) . ': the kind "' . $rule[2] . '" is not one of ' . implode(', ', MAP_KINDS));
		}
		$rules[] = $rule;
	}
	return $rules;
}

/** The REDZ.UI form of $target with its {space:N} placeholders resolved. */
function MAP__Target(string $target): string
{
	return (string)preg_replace_callback('~\{space:([0-9a-z]+)\}~', fn(array $m): string => MAP_SPACE[$m[1]] ?? '?', $target);
}

/**
 * The row of one Bootstrap class: [bs5, redz, kind, scope, page, note]; null when no rule matches.
 * @return ?list<string>
 */
function MAP__Row(string $class, array $rules, array $ours): ?array
{
	$prefix = '';
	$bare = $class;
	if (preg_match(MAP_RESPONSIVE, $class, $m) === 1) {
		$prefix = $m[2] === 'xxl' ? '2xl' : $m[2];
		$bare = $m[1] . ($m[3] ?? '');
	}
	foreach ($rules as [$pattern, $target, $kind, $page, $note]) {
		if (preg_match('~^(?:' . $pattern . ')$~', $bare, $found) !== 1) {
			continue;
		}
		$redz = MAP__Target((string)preg_replace_callback('~\$(\d)~', fn(array $g): string => $found[(int)$g[1]] ?? '', $target));
		if ($prefix !== '' && $redz !== '' && in_array($kind, ['same', 'rename', 'value', 'grid'], true)) {
			$prefixed = implode(' ', array_map(fn(string $one): string => $prefix . ':' . $one, explode(' ', $redz)));
			if (array_diff(explode(' ', $prefixed), array_keys($ours)) === []) {
				$redz = $prefixed;
				$kind = $kind === 'same' ? 'rename' : $kind;
			} else {
				$note = trim('no ' . $prefix . ': form here — set it at that width in the module\'s CSS, or rethink the layout. ' . $note);
				$kind = 'review';
			}
		}
		if ($prefix !== '' && $kind === 'same') {
			$kind = 'rename';
		}
		if ($redz !== '' && $redz !== $class && isset($ours[$class]) && in_array($kind, ['rename', 'value'], true)) {
			$note = trim('reused — ' . $class . ' means another thing in REDZ.UI; ' . $note);
		}
		$first = explode(' ', $redz)[0];
		$page = $page !== '' ? $page : (string)($ours[(string)preg_replace('~^[a-z0-9]+:~', '', $first)] ?? '');
		return [$class, $redz, $kind, 'class', $page, $note];
	}
	return null;
}

/**
 * The map's rows and what breaks it: a class without a rule, a target the library lacks.
 * @return array{list<list<string>>, list<string>}
 */
function MAP__Build(): array
{
	$ours = MAP__Classes();
	$rules = MAP__Rules('rules.tsv');
	$lines = explode("\n", trim((string)file_get_contents(__DIR__ . '/map/bootstrap.txt')));
	$rows = [];
	$errors = [];
	foreach (array_slice($lines, 1) as $class) {
		$row = MAP__Row($class, $rules, $ours);
		if ($row === null) {
			$errors[] = 'no rule in tools/map/rules.tsv maps the Bootstrap class "' . $class . '"';
			continue;
		}
		foreach ($row[1] === '' ? [] : explode(' ', $row[1]) as $target) {
			if (!isset($ours[$target]) && in_array($row[2], ['same', 'rename', 'value', 'grid'], true)) {
				$errors[] = '"' . $class . '" maps to "' . $target . '", which REDZ.UI does not have';
			}
		}
		$rows[] = $row;
	}
	foreach (MAP__Rules('extra.tsv') as [$names, $target, $kind, $page, $note]) {
		foreach (explode('|', $names) as $name) {
			$rows[] = [$name, $target, $kind, str_starts_with($name, 'data-') ? 'data-attr' : 'js', $page, $note];
		}
	}
	return [$rows, $errors];
}

/** The generated files: path => text. */
function MAP__Files(array $rows): array
{
	$map = MAP_HEAD . "\n" . implode("\n", array_map(fn(array $row): string => implode("\t", $row), $rows)) . "\n";
	$classes = implode("\n", array_keys(MAP__Classes())) . "\n";
	$files = [];
	foreach (MAP_SKILLS as $folder) {
		$files[$folder . '/map.tsv'] = $map;
		$files[$folder . '/classes.txt'] = $classes;
	}
	return $files;
}

/**
 * Writes the map and the class list, or with --check only compares; refresh renews the Bootstrap class list. The exit
 * code.
 * @param list<string> $argv
 */
function MAP__Main(array $argv): int
{
	if (($argv[1] ?? '') === 'refresh') {
		return MAP__Refresh();
	}
	$check = in_array('--check', $argv, true);
	[$rows, $errors] = MAP__Build();
	foreach ($errors as $error) {
		fwrite(STDERR, $error . "\n");
	}
	if ($errors !== []) {
		return 1;
	}
	$stale = [];
	foreach (MAP__Files($rows) as $file => $text) {
		$path = MAP_ROOT . '/' . $file;
		if (is_file($path) && file_get_contents($path) === $text) {
			continue;
		}
		if ($check) {
			$stale[] = $file;
			continue;
		}
		@mkdir(dirname($path), 0777, true);
		file_put_contents($path, $text);
		echo 'wrote ', $file, "\n";
	}
	if ($stale !== []) {
		fwrite(STDERR, 'out of date: ' . implode(', ', $stale) . " — run php tools/map.php\n");
		return 1;
	}
	$kinds = array_count_values(array_column($rows, 2));
	echo 'map · ', count($rows), ' rows · ', implode(' · ', array_map(fn(string $kind, int $n): string => $kind . ' ' . $n, array_keys($kinds), $kinds)), "\n";
	return 0;
}

exit(MAP__Main($argv));
