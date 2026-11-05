<?php
// min - what the release serves: dist/css/redz-ui.min.css, the stylesheets css/index.css pulls in, squeezed;
// dist/js/redz-ui.min.js, the modules js/index.js pulls in, joined into one ES module, squeezed and given short local
// names; and each package's files the same way, dist/css/redz-ui-NAME.min.css and dist/js/redz-ui-NAME.min.js. The JS scanner - strings, regular expressions and a template's text copied as written, white space kept only
// where two tokens would fuse - and its verdict come from the REDZ ERP's kernel minifier; the CSS pass, the joiner and
// the names are this library's. Every pass proves its result before it is written; the probes run what it writes.

// The at-rules whose block holds rules, and those whose block holds declarations.
const MIN_CSS_RULES = ['media', 'supports', 'container', 'layer', 'starting-style', 'keyframes', 'scope'];
const MIN_CSS_DECLARATIONS = ['font-face', 'property', 'page', 'counter-style'];

// The words after which a `/` begins a regular expression: none of them can end an expression.
const MIN_JS_BEFORE_REGEXP = ['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'do', 'else', 'case', 'yield', 'await', 'throw'];

// The punctuators of more than one byte, the longest first.
const MIN_JS_PUNCTUATORS = ['>>>=', '...', '===', '!==', '**=', '<<=', '>>=', '>>>', '&&=', '||=', '??=', '=>', '==', '!=', '<=', '>=', '&&', '||', '??', '?.', '++', '--', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '**', '<<', '>>'];

// The reserved words of a module, which are never a name.
const MIN_JS_KEYWORDS = ['await', 'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default', 'delete', 'do', 'else', 'enum', 'export', 'extends', 'false', 'finally', 'for', 'function', 'if', 'implements', 'import', 'in', 'instanceof', 'interface', 'let', 'new', 'null', 'package', 'private', 'protected', 'public', 'return', 'static', 'super', 'switch', 'this', 'throw', 'true', 'try', 'typeof', 'var', 'void', 'while', 'with', 'yield'];
// Names the pass neither lets a script declare nor gives: their meaning is fixed, or its parse reads them as words.
const MIN_JS_FIXED = ['arguments', 'async', 'eval', 'Infinity', 'NaN', 'of', 'undefined'];
// Names a script may declare but the pass never gives: the words of forms it does not read.
const MIN_JS_CONTEXTUAL = ['as', 'from', 'get', 'set'];

/** Whether $c is a byte of a CSS name. */
function MIN__CssNameByte(string $c): bool
{
	return $c !== '' && (ctype_alnum($c) || $c === '-' || $c === '_' || $c === '\\' || ord($c) >= 0x80);
}

/**
 * Whether the white space between $p, the byte written last, and $c, the next, means something - in a declaration
 * block, a selector or an at-rule's prelude. In a selector it is the descendant combinator, also before `:`; an
 * at-rule's prelude keeps it all, as `@supports` keeps its condition's text.
 */
function MIN__CssSpace(string $p, string $c, string $where): bool
{
	if ($p === '' || str_contains('{};,(', $p) || str_contains('{};,)', $c)) {
		return false;
	}
	return match ($where) {
		'declarations' => $p !== ':' && $c !== ':' && $c !== '!',
		'selector' => !str_contains('>+~', $p) && !str_contains('>+~', $c),
		default => true,
	};
}

/** The text of the declaration value after the `:` at $i, up to its `;` or `}` outside strings and brackets. */
function MIN__CssValue(string $css, int $i): string
{
	$n = strlen($css);
	$depth = 0;
	$j = $i + 1;
	while ($j < $n) {
		$c = $css[$j];
		if ($c === '"' || $c === "'") {
			$j++;
			while ($j < $n && $css[$j] !== $c) {
				$j += $css[$j] === '\\' ? 2 : 1;
			}
		} elseif ($c === '(') {
			$depth++;
		} elseif ($c === ')') {
			$depth--;
		} elseif ($depth === 0 && ($c === ';' || $c === '}')) {
			break;
		}
		$j++;
	}
	return substr($css, $i + 1, $j - $i - 1);
}

/**
 * The stylesheet squeezed: comments gone; strings and escapes as written; white space kept only where it means
 * something - and wherever it stood but before a value the engine keeps as written, a custom property's or one with
 * `var()` or `env()`, as Firefox 132 keeps even its trailing space; a declaration block's last `;` dropped. A comment
 * between two names, an unquoted `url(`, a rule nested in declarations and an at-rule not named above stop it.
 */
function MIN__Css(string $css): string
{
	$out = '';
	$n = strlen($css);
	$blocks = ['rules'];
	$prelude = 0;
	$declaration = 0;
	$value = -1;
	$verbatim = false;
	$space = false;
	$i = 0;
	while ($i < $n) {
		$c = $css[$i];
		if ($c === '/' && ($css[$i + 1] ?? '') === '*') {
			$end = strpos($css, '*/', $i + 2);
			if ($end === false) {
				throw new RuntimeException('an unclosed comment at byte ' . $i);
			}
			$i = $end + 2;
			if (!$space && MIN__CssNameByte(substr($out, -1)) && MIN__CssNameByte($css[$i] ?? '')) {
				throw new RuntimeException('a comment between two names at byte ' . $i);
			}
			continue;
		}
		if (ctype_space($c)) {
			$space = true;
			$i++;
			continue;
		}
		$block = $blocks[array_key_last($blocks)];
		$where = $block === 'declarations' ? 'declarations' : (($out[$prelude] ?? $c) === '@' ? 'at' : 'selector');
		if ($space && ($verbatim ? strlen($out) > $value || str_contains(';}', $c) : MIN__CssSpace(substr($out, -1), $c, $where))) {
			$out .= ' ';
		}
		$space = false;
		if ($c === '"' || $c === "'") {
			$end = $i + 1;
			while ($end < $n && $css[$end] !== $c) {
				if ($css[$end] === "\n") {
					throw new RuntimeException('a string runs past its line at byte ' . $i);
				}
				$end += $css[$end] === '\\' ? 2 : 1;
			}
			$out .= substr($css, $i, $end + 1 - $i);
			$i = $end + 1;
			continue;
		}
		if ($c === '\\') {
			preg_match('~\G\\\\(?:[0-9a-fA-F]{1,6}[ \t\n]?|.)~s', $css, $m, 0, $i);
			$out .= $m[0];
			$i += strlen($m[0]);
			continue;
		}
		if ($c === '(' && preg_match('~url$~i', $out) === 1 && preg_match('~\G\(\s*["\']~', $css, $m, 0, $i) !== 1) {
			throw new RuntimeException('an unquoted url( at byte ' . $i);
		}
		if ($c === '{') {
			if ($block === 'declarations') {
				throw new RuntimeException('a rule nested in declarations at byte ' . $i);
			}
			$name = preg_match('~^@([\w-]+)~', substr($out, $prelude), $m) === 1 ? strtolower($m[1]) : '';
			$blocks[] = match (true) {
				$name === '', in_array($name, MIN_CSS_DECLARATIONS, true) => 'declarations',
				in_array($name, MIN_CSS_RULES, true) => 'rules',
				default => throw new RuntimeException('the at-rule @' . $name . ' at byte ' . $i . ' is not one this pass knows'),
			};
			$out .= '{';
			$prelude = $declaration = strlen($out);
			$value = -1;
			$verbatim = false;
			$i++;
			continue;
		}
		if ($c === '}') {
			if (count($blocks) === 1) {
				throw new RuntimeException('a } without its { at byte ' . $i);
			}
			if (array_pop($blocks) === 'declarations' && str_ends_with($out, ';')) {
				$out = substr($out, 0, -1);
			}
			$out .= '}';
			$prelude = $declaration = strlen($out);
			$value = -1;
			$verbatim = false;
			$i++;
			continue;
		}
		$out .= $c;
		if ($c === ':' && $block === 'declarations' && $value < 0) {
			$value = strlen($out);
			$verbatim = str_starts_with(substr($out, $declaration), '--') || preg_match('~(?<![\w-])(?:var|env)\(~i', MIN__CssValue($css, $i)) === 1;
		} elseif ($c === ';') {
			$prelude = $declaration = strlen($out);
			$value = -1;
			$verbatim = false;
		}
		$i++;
	}
	if (count($blocks) !== 1) {
		throw new RuntimeException('a { without its }');
	}
	return $out;
}

/** The stylesheet without comments, white space outside strings and a block's last `;` - what squeezing keeps. */
function MIN__CssBare(string $css): string
{
	$bare = (string)preg_replace_callback('~"(?:\\\\.|[^"\\\\\n])*"|\'(?:\\\\.|[^\'\\\\\n])*\'|/\*.*?\*/|\s+~s', fn(array $m): string => $m[0][0] === '"' || $m[0][0] === "'" ? $m[0] : '', $css);
	return str_replace(';}', '}', $bare);
}

/** The squeezed stylesheet, proved: squeezing it again changes nothing, and only comments and white space are gone. */
function MIN__CssSafe(string $css): string
{
	$min = MIN__Css($css);
	if (MIN__Css($min) !== $min) {
		throw new RuntimeException('the squeezed stylesheet changes when squeezed again');
	}
	if (MIN__CssBare($min) !== MIN__CssBare($css)) {
		throw new RuntimeException('the squeezed stylesheet differs from its files beyond comments and white space');
	}
	return $min;
}

/** Whether $c is a byte of a JavaScript name. */
function MIN__JsWord(string $c): bool
{
	return $c !== '' && (ctype_alnum($c) || $c === '_' || $c === '$');
}

/**
 * Whether $prev and $next written side by side would fuse into a token the source does not have; $lastWord, the run
 * before $prev, tells a number before `.` from a name ending in a digit.
 */
function MIN__JsGlue(string $prev, string $next, string $lastWord): bool
{
	if (MIN__JsWord($prev) && MIN__JsWord($next)) {
		return true;
	}
	if (($prev === '+' || $prev === '-') && $next === $prev) {
		return true;
	}
	if ($prev === '/' && ($next === '/' || $next === '*')) {
		return true;
	}
	if ($prev === '<' && $next === '!') {
		return true;
	}
	return $next === '.' && $lastWord !== '' && ctype_digit($lastWord);
}

/** Whether a `/` after $prev, the last byte written, and the word $lastWord begins a regular expression, not a division. */
function MIN__JsRegexpOk(string $prev, string $lastWord): bool
{
	if ($prev === '' || str_contains('(,=:[!&|?{};+-*/%<>~^', $prev)) {
		return true;
	}
	return MIN__JsWord($prev) && in_array($lastWord, MIN_JS_BEFORE_REGEXP, true);
}

/**
 * One template literal from its backtick at $i: the text as written, each `${…}` scanned as code.
 * @param list<string> $tokens
 * @param list<string> $hazards
 * @return array{string, int} the template and the index past it
 */
function MIN__JsTemplate(string $js, int $i, array &$tokens, array &$hazards): array
{
	$n = strlen($js);
	$out = $js[$i];
	$chunk = $js[$i];
	$i++;
	while ($i < $n) {
		$c = $js[$i];
		if ($c === '\\' && $i + 1 < $n) {
			$out .= $c . $js[$i + 1];
			$chunk .= $c . $js[$i + 1];
			$i += 2;
			continue;
		}
		if ($c === '`') {
			$tokens[] = 'T' . $chunk . $c;
			return [$out . $c, $i + 1];
		}
		if ($c === '$' && ($js[$i + 1] ?? '') === '{') {
			$out .= '${';
			$tokens[] = 'T' . $chunk;
			$tokens[] = 'P${';
			$chunk = '';
			[$code, $inner, $innerHazards, $i] = MIN__JsScan($js, $i + 2, true);
			$out .= $code;
			array_push($tokens, ...$inner);
			array_push($hazards, ...$innerHazards);
			continue;
		}
		$out .= $c;
		$chunk .= $c;
		$i++;
	}
	$tokens[] = 'T' . $chunk;
	return [$out, $i];
}

/**
 * The scanner: the code from $from squeezed onto one line, with the significant tokens it saw and the places where
 * a newline was the only separator that changes the parse when gone. With $inner it stops after the `}` closing the
 * `${` it was called for.
 * @return array{string, list<string>, list<string>, int} [squeezed, tokens, hazards, next index]
 */
function MIN__JsScan(string $js, int $from = 0, bool $inner = false): array
{
	$n = strlen($js);
	$out = '';
	$prev = '';
	$lastWord = '';
	$word = '';
	$tokens = [];
	$hazards = [];
	$depth = 0;
	$gap = false;
	$i = $from;
	$flush = function () use (&$word, &$tokens): void {
		if ($word !== '') {
			$tokens[] = 'W' . $word;
			$word = '';
		}
	};
	while ($i < $n) {
		$c = $js[$i];
		$c2 = $js[$i + 1] ?? '';
		if ($c === '/' && $c2 === '/') {
			$flush();
			$gap = true;
			$i += 2;
			while ($i < $n && $js[$i] !== "\n") {
				$i++;
			}
			continue;
		}
		if ($c === '/' && $c2 === '*') {
			$flush();
			$i += 2;
			while ($i < $n && !($js[$i] === '*' && ($js[$i + 1] ?? '') === '/')) {
				$i++;
			}
			$i += 2;
			// A comment can be the only separator: `a/*c*/b` and `a+/*c*/+b` fuse once it is gone.
			if (MIN__JsGlue($prev, $js[$i] ?? '', $lastWord)) {
				$out .= ' ';
			}
			$gap = true;
			continue;
		}
		if ($c === '"' || $c === "'") {
			$flush();
			$literal = $c;
			$i++;
			while ($i < $n) {
				$ch = $js[$i];
				if ($ch === '\\' && $i + 1 < $n) {
					$literal .= $ch . $js[$i + 1];
					$i += 2;
					continue;
				}
				$literal .= $ch;
				$i++;
				if ($ch === $c) {
					break;
				}
			}
			$out .= $literal;
			$tokens[] = 'S' . $literal;
			$prev = $c;
			$lastWord = '';
			$gap = false;
			continue;
		}
		if ($c === '`') {
			$flush();
			[$literal, $i] = MIN__JsTemplate($js, $i, $tokens, $hazards);
			$out .= $literal;
			$prev = '`';
			$lastWord = '';
			$gap = false;
			continue;
		}
		// After `++` or `--` a `/` divides: a pattern cannot follow them.
		if ($c === '/' && MIN__JsRegexpOk($prev, $lastWord) && !in_array(substr($out, -2), ['++', '--'], true)) {
			$flush();
			$literal = $c;
			$i++;
			$class = false;
			while ($i < $n) {
				$ch = $js[$i];
				if ($ch === '\\' && $i + 1 < $n) {
					$literal .= $ch . $js[$i + 1];
					$i += 2;
					continue;
				}
				$literal .= $ch;
				$i++;
				if ($ch === '[') {
					$class = true;
				} elseif ($ch === ']') {
					$class = false;
				} elseif ($ch === '/' && !$class) {
					break;
				}
			}
			while ($i < $n && ctype_alpha($js[$i])) {
				$literal .= $js[$i++];
			}
			$out .= $literal;
			$tokens[] = 'R' . $literal;
			$prev = '/';
			$lastWord = '';
			$gap = false;
			continue;
		}
		if ($c === ' ' || $c === "\t" || $c === "\n" || $c === "\r") {
			$flush();
			$j = $i;
			$newline = false;
			while ($j < $n && ($js[$j] === ' ' || $js[$j] === "\t" || $js[$j] === "\n" || $js[$j] === "\r")) {
				$newline = $newline || $js[$j] === "\n";
				$j++;
			}
			$next = $js[$j] ?? '';
			$comment = $next === '/' && (($js[$j + 1] ?? '') === '/' || ($js[$j + 1] ?? '') === '*');
			if (!$comment && MIN__JsGlue($prev, $next, $lastWord)) {
				$out .= ' ';
			}
			// Two expressions a newline alone keeps apart - a literal after a literal or a name - become one once joined.
			if ($newline && ($next === "'" || $next === '"' || $next === '`') && (str_contains(')]}\'"`', $prev) && $prev !== '' || MIN__JsWord($prev))) {
				$hazards[] = substr($out, -60);
			}
			$gap = true;
			$i = $j;
			continue;
		}
		if ($c === '}' && $inner && $depth === 0) {
			$flush();
			$tokens[] = 'P}';
			return [$out . $c, $tokens, $hazards, $i + 1];
		}
		if ($c === '{') {
			$depth++;
		} elseif ($c === '}' && $depth > 0) {
			$depth--;
		}
		if (MIN__JsWord($c)) {
			if ($gap || !MIN__JsWord($prev)) {
				$lastWord = '';
			}
			$word .= $c;
			$lastWord .= $c;
		} else {
			$flush();
			$tokens[] = 'P' . $c;
			$lastWord = '';
		}
		$out .= $c;
		$prev = $c;
		$gap = false;
		$i++;
	}
	$flush();
	return [trim($out), $tokens, $hazards, $i];
}

/**
 * The script squeezed onto one line, proved: no newline it removes changes the parse, scanning the result again
 * changes nothing, its tokens are the source's, and it is not empty or longer.
 */
function MIN__JsSafe(string $js): string
{
	[$min, $tokens, $hazards] = MIN__JsScan($js);
	if ($hazards !== []) {
		throw new RuntimeException('a newline is the only separator at ' . count($hazards) . ' place(s) - add the operator or `;` it lacks: …' . trim($hazards[0]));
	}
	if (trim($js) !== '' && $min === '') {
		throw new RuntimeException('the squeezed script is empty');
	}
	if (strlen($min) > strlen($js)) {
		throw new RuntimeException('the squeezed script grew');
	}
	[$again, $againTokens] = MIN__JsScan($min);
	if ($again !== $min) {
		throw new RuntimeException('the squeezed script changes when scanned again');
	}
	if ($againTokens !== $tokens) {
		$at = 0;
		while (($tokens[$at] ?? null) === ($againTokens[$at] ?? null)) {
			$at++;
		}
		throw new RuntimeException('the squeezed script\'s tokens differ at #' . $at . ' (' . substr($tokens[$at] ?? '<end>', 0, 40) . ' → ' . substr($againTokens[$at] ?? '<end>', 0, 40) . ')');
	}
	return $min;
}

/**
 * The modules $files, paths under $root each after those it imports, as one ES module: a module that exports runs in
 * a function returning its exports, any other in a block, and each starts by reading what it imports. Only `import
 * {a, b} from './x.js'`, `import './x.js'` - or from a folder beside, '../js/x.js' -, `export const` and `import.meta`
 * are taken; any other form, or two modules of one name, stops the build.
 * @param list<string> $files
 */
function MIN__JsJoin(string $root, array $files): string
{
	$holder = fn(string $module): string => 'REDZ_UI_' . preg_replace('~\W~', '_', $module);
	$all = implode("\n", array_map(fn(string $file): string => (string)file_get_contents($root . '/' . $file), $files));
	$named = array_count_values(array_map(fn(string $file): string => basename($file, '.js'), $files));
	if (max($named) > 1) {
		throw new RuntimeException('two modules are named ' . array_search(max($named), $named, true) . '.js, which the joiner tells apart by name alone');
	}
	$exports = [];
	$parts = [];
	foreach ($files as $file) {
		$own = $holder(basename($file, '.js'));
		if (str_contains($all, $own)) {
			throw new RuntimeException('a module uses the name ' . $own . ', which the joiner gives the exports of ' . $file);
		}
		$reads = [];
		$names = [];
		$body = [];
		foreach (explode("\n", (string)file_get_contents($root . '/' . $file)) as $line) {
			if (preg_match('~^import \{([\w, ]+)\} from \'(?:\./|\.\./[\w-]+/)([\w-]+)\.js\';$~', $line, $m) === 1) {
				$wanted = array_map('trim', explode(',', $m[1]));
				$missing = array_diff($wanted, $exports[$holder($m[2])] ?? []);
				if ($missing !== []) {
					throw new RuntimeException($file . ' imports ' . implode(', ', $missing) . ' from ./' . $m[2] . '.js, which comes later or does not export it');
				}
				$reads[] = 'const {' . implode(', ', $wanted) . '} = ' . $holder($m[2]) . ';';
				continue;
			}
			if (preg_match('~^import \'(?:\./|\.\./[\w-]+/)[\w-]+\.js\';$~', $line) === 1) {
				continue;
			}
			if (preg_match('~^export const (\w+)~', $line, $m) === 1) {
				$names[] = $m[1];
				$line = substr($line, strlen('export '));
			}
			$body[] = $line;
		}
		$code = implode("\n", $reads) . "\n" . implode("\n", $body);
		$tokens = MIN__JsScan($code)[1];
		foreach ($tokens as $k => $token) {
			if ($token === 'Wexport' || ($token === 'Wimport' && ($tokens[$k + 1] ?? '') !== 'P.')) {
				throw new RuntimeException($file . ' has an import or an export the joiner does not take: only import {…} from \'./x.js\', import \'./x.js\', export const and import.meta');
			}
		}
		$exports[$own] = $names;
		$parts[] = $names === [] ? "{\n" . $code . "\n}" : 'const ' . $own . " = (() => {\n" . $code . "\nreturn {" . implode(', ', $names) . "};\n})();";
	}
	return implode("\n", $parts) . "\n";
}

/**
 * The tokens of a squeezed script, [kind, text]: name, number, string, template - a template's text from its backtick
 * or the `}` ending an interpolation to the next `${` or backtick -, regexp and punctuator. A `/` after `}` stops it:
 * the end of a block and of an object read it differently.
 * @return list<array{string, string}>
 */
function MIN__JsLex(string $js): array
{
	$tokens = [];
	$n = strlen($js);
	$depths = [];
	$i = 0;
	while ($i < $n) {
		$c = $js[$i];
		if (ctype_space($c)) {
			$i++;
			continue;
		}
		[$lastKind, $lastText] = $tokens === [] ? ['', ''] : $tokens[count($tokens) - 1];
		if (preg_match('~\G[A-Za-z_$][\w$]*~', $js, $m, 0, $i) === 1) {
			$tokens[] = ['name', $m[0]];
			$i += strlen($m[0]);
			continue;
		}
		if (ctype_digit($c) || ($c === '.' && ctype_digit($js[$i + 1] ?? ''))) {
			preg_match('~\G(?:0[xXoObB][\da-fA-F_]+|(?:\d[\d_]*\.?[\d_]*|\.\d[\d_]*)(?:[eE][+-]?\d[\d_]*)?)n?~', $js, $m, 0, $i);
			$tokens[] = ['number', $m[0]];
			$i += strlen($m[0]);
			continue;
		}
		if ($c === '"' || $c === "'") {
			$end = $i + 1;
			while ($end < $n && $js[$end] !== $c) {
				$end += $js[$end] === '\\' ? 2 : 1;
			}
			$tokens[] = ['string', substr($js, $i, $end + 1 - $i)];
			$i = $end + 1;
			continue;
		}
		if ($c === '`' || ($c === '}' && $depths !== [] && $depths[count($depths) - 1] === 0)) {
			if ($c === '}') {
				array_pop($depths);
			}
			$end = $i + 1;
			while ($end < $n && $js[$end] !== '`' && !($js[$end] === '$' && ($js[$end + 1] ?? '') === '{')) {
				$end += $js[$end] === '\\' ? 2 : 1;
			}
			if ($end >= $n) {
				throw new RuntimeException('a template runs to the end of the script');
			}
			if ($js[$end] === '$') {
				$depths[] = 0;
				$end += 2;
			} else {
				$end++;
			}
			$tokens[] = ['template', substr($js, $i, $end - $i)];
			$i = $end;
			continue;
		}
		if ($c === '/' && $lastKind === 'punctuator' && $lastText === '}') {
			throw new RuntimeException('a / after } at byte ' . $i . ': the end of a block and of an object read it differently');
		}
		$regexp = $lastKind === '' || ($lastKind === 'punctuator' && !in_array($lastText, [')', ']', '++', '--'], true)) || ($lastKind === 'name' && in_array($lastText, MIN_JS_BEFORE_REGEXP, true)) || ($lastKind === 'template' && str_ends_with($lastText, '${'));
		if ($c === '/' && $regexp) {
			$end = $i + 1;
			$class = false;
			while ($end < $n && ($js[$end] !== '/' || $class)) {
				if ($js[$end] === '\\') {
					$end++;
				} elseif ($js[$end] === '[') {
					$class = true;
				} elseif ($js[$end] === ']') {
					$class = false;
				}
				$end++;
			}
			$end++;
			while ($end < $n && ctype_alpha($js[$end])) {
				$end++;
			}
			$tokens[] = ['regexp', substr($js, $i, $end - $i)];
			$i = $end;
			continue;
		}
		foreach (MIN_JS_PUNCTUATORS as $punctuator) {
			if (substr($js, $i, strlen($punctuator)) === $punctuator && !($punctuator === '?.' && ctype_digit($js[$i + 2] ?? ''))) {
				$tokens[] = ['punctuator', $punctuator];
				$i += strlen($punctuator);
				continue 2;
			}
		}
		if (!str_contains('{}()[];,<>+-*/%&|^!~?:=.', $c)) {
			throw new RuntimeException('the byte 0x' . bin2hex($c) . ' at ' . $i . ' is not one the names pass reads');
		}
		if ($depths !== [] && ($c === '{' || $c === '}')) {
			$depths[count($depths) - 1] += $c === '{' ? 1 : -1;
		}
		$tokens[] = ['punctuator', $c];
		$i++;
	}
	return $tokens;
}

/**
 * The names of a squeezed script's tokens: which declaration each name token uses - by the scopes of `const`, `let`,
 * arrow parameters, `catch`, `for` heads and blocks - and which names are free, the page's globals. A property, an
 * object key or a word of the language is no use; a shorthand `{a}` is one, which the names pass writes out as
 * `{a:x}`. `var`, `function`, `class`, labels, accessors and methods with computed or modified keys, generators,
 * `import`, `export`, `eval`, `arguments`, and a `for` or `catch` body without braces stop it: the library's scripts
 * have none.
 * @param list<array{string, string}> $tokens
 * @return array{uses: array<int, int>, shorthand: array<int, true>, counts: list<int>, scopes: list<?int>, names: list<array<string, int>>, free: array<string, true>}
 */
function MIN__JsScopes(array $tokens): array
{
	$count = count($tokens);
	$match = [];
	$open = [];
	foreach ($tokens as $t => [$kind, $text]) {
		$closes = ($kind === 'punctuator' && in_array($text, [')', ']', '}'], true)) || ($kind === 'template' && $text[0] === '}');
		$opens = ($kind === 'punctuator' && in_array($text, ['(', '[', '{'], true)) || ($kind === 'template' && str_ends_with($text, '${'));
		if ($closes) {
			if ($open === []) {
				throw new RuntimeException('a ' . $text[0] . ' without its opening at token ' . $t);
			}
			$match[array_pop($open)] = $t;
		}
		if ($opens) {
			$open[] = $t;
		}
	}
	if ($open !== []) {
		throw new RuntimeException('a bracket without its closing');
	}
	$scopes = [null];
	$names = [[]];
	$counts = [];
	$uses = [];
	$shorthand = [];
	$refs = [];
	$stack = [['type' => 'program', 'scope' => 0, 'bind' => 0, 'pos' => '', 'ternary' => 0, 'decl' => null, 'case' => false]];
	$fn = null;
	$head = null;
	$colon = false;
	$scope = function (int $parent) use (&$scopes, &$names): int {
		$scopes[] = $parent;
		$names[] = [];
		return count($scopes) - 1;
	};
	$declare = function (int $in, int $t) use (&$names, &$counts, &$uses, $tokens): void {
		$name = $tokens[$t][1];
		if (in_array($name, MIN_JS_KEYWORDS, true) || in_array($name, MIN_JS_FIXED, true)) {
			throw new RuntimeException('the word ' . $name . ' is declared at token ' . $t);
		}
		if (isset($names[$in][$name])) {
			throw new RuntimeException('the name ' . $name . ' is declared twice in one scope at token ' . $t);
		}
		$counts[] = 0;
		$names[$in][$name] = count($counts) - 1;
		$uses[$t] = count($counts) - 1;
	};
	$push = function (array $context) use (&$stack): void {
		$stack[] = $context + ['pos' => '', 'ternary' => 0, 'decl' => null, 'case' => false];
	};
	$arrows = function () use (&$stack): void {
		while ($stack[count($stack) - 1]['type'] === 'arrow') {
			array_pop($stack);
		}
	};
	for ($t = 0; $t < $count; $t++) {
		[$kind, $text] = $tokens[$t];
		$prev = $tokens[$t - 1][1] ?? '';
		$next = $tokens[$t + 1][1] ?? '';
		$nextKind = $tokens[$t + 1][0] ?? '';
		$k = count($stack) - 1;
		$top = $stack[$k];
		$type = $top['type'];
		$pos = $top['pos'];
		$declPos = $top['decl']['pos'] ?? '';
		$caseColon = $colon;
		$colon = false;
		if ($fn !== null && $text !== '=>' && $text !== '{') {
			throw new RuntimeException('parameters without their => or body at token ' . $t);
		}
		if ($kind === 'name') {
			if ($prev === '.' || $prev === '?.') {
				continue;
			}
			if (($type === 'object' || $type === 'objpat') && $pos === 'key') {
				if ($next === ':') {
					$stack[$k]['pos'] = 'colon';
				} elseif ($next === '(' && $type === 'object') {
					$stack[$k]['pos'] = 'method';
				} elseif ($next === ',' || $next === '}' || $next === '=') {
					$shorthand[$t] = true;
					if ($type === 'objpat') {
						$declare($top['bind'], $t);
					} else {
						$refs[] = [$t, $top['scope']];
					}
					$stack[$k]['pos'] = 'after';
				} else {
					throw new RuntimeException('the key ' . $text . ' before ' . $next . ' at token ' . $t . ': accessors and modified methods are not read here');
				}
				continue;
			}
			if (in_array($text, MIN_JS_KEYWORDS, true)) {
				// import.meta declares and reads no name: the module's own address.
				if ($text === 'import' && $next === '.' && ($tokens[$t + 2][1] ?? '') === 'meta') {
					continue;
				}
				if (in_array($text, ['var', 'function', 'class', 'with', 'import', 'export', 'yield', 'enum'], true)) {
					throw new RuntimeException($text . ' at token ' . $t . ' is not read by the names pass');
				}
				if (($text === 'break' || $text === 'continue') && $nextKind === 'name') {
					throw new RuntimeException('a label at token ' . $t);
				}
				if ($text === 'const' || $text === 'let') {
					if (!in_array($type, ['program', 'block', 'forhead'], true)) {
						throw new RuntimeException($text . ' outside a block at token ' . $t);
					}
					$stack[$k]['decl'] = ['scope' => $top['scope'], 'pos' => 'binding'];
				} elseif ($text === 'case' || ($text === 'default' && $next === ':')) {
					$stack[$k]['case'] = true;
				} elseif ($text === 'in' && $type === 'forhead' && $declPos === 'after') {
					$stack[$k]['decl'] = null;
				}
				continue;
			}
			if ($text === 'of' && $type === 'forhead' && $declPos === 'after') {
				$stack[$k]['decl'] = null;
				continue;
			}
			if ($text === 'async' && ($next === '(' || ($nextKind === 'name' && ($tokens[$t + 2][1] ?? '') === '=>'))) {
				continue;
			}
			if ($text === 'arguments' || $text === 'eval') {
				throw new RuntimeException($text . ' at token ' . $t . ' is not read by the names pass');
			}
			if ($next === '=>') {
				$fn = $scope($top['scope']);
				$declare($fn, $t);
				continue;
			}
			if (in_array($type, ['params', 'arrpat', 'objpat', 'catch'], true) && $pos === 'binding') {
				$declare($top['bind'], $t);
				$stack[$k]['pos'] = 'after';
				continue;
			}
			if ($declPos === 'binding') {
				$declare($top['decl']['scope'], $t);
				$stack[$k]['decl']['pos'] = 'after';
				continue;
			}
			$refs[] = [$t, $top['scope']];
			continue;
		}
		if ($kind === 'string' || $kind === 'number') {
			if (($type === 'object' || $type === 'objpat') && $pos === 'key') {
				$stack[$k]['pos'] = $next === '(' ? 'method' : 'colon';
			}
			continue;
		}
		if ($kind === 'template') {
			if ($text[0] === '}') {
				$arrows();
				if (array_pop($stack)['type'] !== 'tpl') {
					throw new RuntimeException('a template\'s } out of place at token ' . $t);
				}
			}
			if (str_ends_with($text, '${')) {
				$k = count($stack) - 1;
				$push(['type' => 'tpl', 'scope' => $stack[$k]['scope'], 'bind' => $stack[$k]['bind']]);
			}
			continue;
		}
		if ($kind !== 'punctuator') {
			continue;
		}
		$binding = (in_array($type, ['params', 'arrpat', 'objpat', 'catch'], true) && $pos === 'binding') || $declPos === 'binding';
		switch ($text) {
			case '{':
				if ($fn !== null) {
					$push(['type' => 'block', 'scope' => $fn, 'bind' => $fn]);
					$fn = null;
				} elseif ($binding) {
					$push(['type' => 'objpat', 'scope' => $top['scope'], 'bind' => $declPos === 'binding' ? $top['decl']['scope'] : $top['bind'], 'pos' => 'key']);
					if ($declPos === 'binding') {
						$stack[$k]['decl']['pos'] = 'after';
					} else {
						$stack[$k]['pos'] = 'after';
					}
				} elseif ($prev === ')' || in_array($prev, ['else', 'try', 'catch', 'finally', 'do'], true) || $caseColon || (($type === 'program' || $type === 'block') && in_array($prev, ['', ';', '{', '}'], true))) {
					$block = $scope($head ?? $top['scope']);
					$head = null;
					$push(['type' => 'block', 'scope' => $block, 'bind' => $block]);
				} else {
					$push(['type' => 'object', 'scope' => $top['scope'], 'bind' => $top['bind'], 'pos' => 'key']);
				}
				break;
			case '[':
				if ($binding) {
					$push(['type' => 'arrpat', 'scope' => $top['scope'], 'bind' => $declPos === 'binding' ? $top['decl']['scope'] : $top['bind'], 'pos' => 'binding']);
					if ($declPos === 'binding') {
						$stack[$k]['decl']['pos'] = 'after';
					} else {
						$stack[$k]['pos'] = 'after';
					}
				} else {
					if (($type === 'object' || $type === 'objpat') && $pos === 'key') {
						$stack[$k]['pos'] = 'colon';
					}
					$push(['type' => 'array', 'scope' => $top['scope'], 'bind' => $top['bind']]);
				}
				break;
			case '(':
				if ($type === 'object' && $pos === 'colon') {
					throw new RuntimeException('a method with a computed key at token ' . $t . ' is not read here');
				}
				if (($prev === 'for' || $prev === 'catch') && !in_array($tokens[$t - 2][1] ?? '', ['.', '?.'], true)) {
					$inner = $scope($top['scope']);
					$push(['type' => $prev === 'for' ? 'forhead' : 'catch', 'scope' => $inner, 'bind' => $inner, 'pos' => $prev === 'for' ? '' : 'binding']);
				} elseif (($tokens[$match[$t] + 1][1] ?? '') === '=>' || ($type === 'object' && $pos === 'method')) {
					if ($type === 'object') {
						$stack[$k]['pos'] = 'after';
					}
					$inner = $scope($top['scope']);
					$push(['type' => 'params', 'scope' => $inner, 'bind' => $inner, 'pos' => 'binding']);
				} else {
					$push(['type' => 'paren', 'scope' => $top['scope'], 'bind' => $top['bind']]);
				}
				break;
			case '}':
			case ']':
			case ')':
				$arrows();
				$closed = array_pop($stack);
				if ($stack === [] || $closed['type'] === 'tpl') {
					throw new RuntimeException('a ' . $text . ' out of place at token ' . $t);
				}
				if ($closed['type'] === 'params') {
					$fn = $closed['scope'];
				} elseif ($closed['type'] === 'forhead' || $closed['type'] === 'catch') {
					if ($next !== '{') {
						throw new RuntimeException('a for or catch body without braces at token ' . $t);
					}
					$head = $closed['scope'];
				}
				break;
			case ',':
				$arrows();
				$k = count($stack) - 1;
				if (in_array($stack[$k]['type'], ['params', 'arrpat'], true)) {
					$stack[$k]['pos'] = 'binding';
				} elseif (in_array($stack[$k]['type'], ['object', 'objpat'], true)) {
					$stack[$k]['pos'] = 'key';
				}
				if ($stack[$k]['decl'] !== null) {
					$stack[$k]['decl']['pos'] = 'binding';
				}
				break;
			case ';':
				$arrows();
				$k = count($stack) - 1;
				$stack[$k]['decl'] = null;
				$stack[$k]['ternary'] = 0;
				break;
			case '=':
				if (in_array($type, ['params', 'arrpat', 'objpat', 'catch'], true) && $pos === 'after') {
					$stack[$k]['pos'] = 'expr';
				} elseif ($type === 'object' && $pos === 'after') {
					$stack[$k]['pos'] = 'value';
				}
				if ($declPos === 'after') {
					$stack[$k]['decl']['pos'] = 'expr';
				}
				break;
			case '=>':
				if ($fn === null) {
					throw new RuntimeException('=> without parameters at token ' . $t);
				}
				if ($next !== '{') {
					$push(['type' => 'arrow', 'scope' => $fn, 'bind' => $fn]);
					$fn = null;
				}
				break;
			case '?':
				$stack[$k]['ternary']++;
				break;
			case ':':
				while ($stack[count($stack) - 1]['type'] === 'arrow' && $stack[count($stack) - 1]['ternary'] === 0) {
					array_pop($stack);
				}
				$k = count($stack) - 1;
				if ($stack[$k]['ternary'] > 0) {
					$stack[$k]['ternary']--;
				} elseif ($stack[$k]['type'] === 'object' && $stack[$k]['pos'] === 'colon') {
					$stack[$k]['pos'] = 'value';
				} elseif ($stack[$k]['type'] === 'objpat' && $stack[$k]['pos'] === 'colon') {
					$stack[$k]['pos'] = 'binding';
				} elseif ($stack[$k]['case']) {
					$stack[$k]['case'] = false;
					$colon = true;
				} else {
					throw new RuntimeException('a label or a stray : at token ' . $t);
				}
				break;
			case '...':
				if (in_array($type, ['params', 'arrpat', 'objpat'], true) && ($pos === 'binding' || $pos === 'key')) {
					$stack[$k]['pos'] = 'binding';
				} elseif ($type === 'object' && $pos === 'key') {
					$stack[$k]['pos'] = 'value';
				}
				break;
		}
	}
	if (count($stack) !== 1 || $fn !== null) {
		throw new RuntimeException('the script ends inside a bracket or a function');
	}
	$free = [];
	foreach ($refs as [$t, $from]) {
		$name = $tokens[$t][1];
		$uses[$t] = -1;
		for ($s = $from; $s !== null; $s = $scopes[$s]) {
			if (isset($names[$s][$name])) {
				$uses[$t] = $names[$s][$name];
				break;
			}
		}
		if ($uses[$t] === -1) {
			$free[$name] = true;
		}
	}
	foreach ($uses as $use) {
		if ($use >= 0) {
			$counts[$use]++;
		}
	}
	ksort($uses);
	return ['uses' => $uses, 'shorthand' => $shorthand, 'counts' => $counts, 'scopes' => $scopes, 'names' => $names, 'free' => $free];
}

/** The $i-th short name: a byte of $first, then bytes of $rest. */
function MIN__JsName(int $i, array $first, array $rest): string
{
	$name = $first[$i % count($first)];
	$i = intdiv($i, count($first));
	while ($i > 0) {
		$i--;
		$name .= $rest[$i % count($rest)];
		$i = intdiv($i, count($rest));
	}
	return $name;
}

/**
 * The squeezed script with short local names. As esbuild does, a scope's declarations take slots after its parent's,
 * so a name never hides one from outside it, sibling scopes share slots, and the most used slot gets the shortest
 * name; names are spelled with the bytes the rest of the script uses most, and none is a free name or a reserved
 * word. Properties, keys and free names stay; a shorthand is written out.
 */
function MIN__JsNames(string $min): string
{
	$tokens = MIN__JsLex($min);
	$a = MIN__JsScopes($tokens);
	$base = [];
	$slot = [];
	foreach ($a['scopes'] as $s => $parent) {
		$base[$s] = $parent === null ? 0 : $base[$parent] + count($a['names'][$parent]);
		$ids = array_values($a['names'][$s]);
		usort($ids, fn(int $x, int $y): int => [$a['counts'][$y], $x] <=> [$a['counts'][$x], $y]);
		foreach ($ids as $j => $id) {
			$slot[$id] = $base[$s] + $j;
		}
	}
	$weight = [];
	foreach ($slot as $id => $s) {
		$weight[$s] = ($weight[$s] ?? 0) + $a['counts'][$id];
	}
	$order = array_keys($weight);
	usort($order, fn(int $x, int $y): int => [$weight[$y], $x] <=> [$weight[$x], $y]);
	$bytes = [];
	foreach ($tokens as $t => [, $text]) {
		if (($a['uses'][$t] ?? -1) < 0) {
			foreach (count_chars($text, 1) as $byte => $times) {
				$bytes[$byte] = ($bytes[$byte] ?? 0) + $times;
			}
		}
	}
	$rank = function (string $set) use ($bytes): array {
		$list = str_split($set);
		usort($list, fn(string $x, string $y): int => [$bytes[ord($y)] ?? 0, $x] <=> [$bytes[ord($x)] ?? 0, $y]);
		return $list;
	};
	$first = $rank('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_$');
	$rest = $rank('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_$0123456789');
	$taken = array_flip([...MIN_JS_KEYWORDS, ...MIN_JS_FIXED, ...MIN_JS_CONTEXTUAL, ...array_keys($a['free'])]);
	$given = [];
	$i = 0;
	foreach ($order as $s) {
		do {
			$name = MIN__JsName($i++, $first, $rest);
		} while (isset($taken[$name]));
		$given[$s] = $name;
	}
	$out = '';
	$lastKind = '';
	$lastText = '';
	foreach ($tokens as $t => [$kind, $text]) {
		if (($a['uses'][$t] ?? -1) >= 0) {
			$name = $given[$slot[$a['uses'][$t]]];
			$text = isset($a['shorthand'][$t]) && $name !== $text ? $text . ':' . $name : $name;
		}
		if ($out !== '' && MIN__JsGlue(substr($out, -1), $text[0], $lastKind === 'number' ? $lastText : '')) {
			$out .= ' ';
		}
		$out .= $text;
		$lastKind = $kind;
		$lastText = $text;
	}
	return $out;
}

/**
 * The script with short names, proved: its tokens are the squeezed script's but for the names and the written-out
 * shorthands; each name uses the declaration its original used, one new name for each, free names unchanged; and
 * scanning it again changes nothing.
 */
function MIN__JsNamesSafe(string $min): string
{
	$named = MIN__JsNames($min);
	$before = MIN__JsLex($min);
	$after = MIN__JsLex($named);
	$a = MIN__JsScopes($before);
	$b = MIN__JsScopes($after);
	$map = [];
	$o = 0;
	foreach ($before as $t => [$kind, $text]) {
		$use = $a['uses'][$t] ?? null;
		if (isset($a['shorthand'][$t]) && ($after[$o][1] ?? '') === $text && ($after[$o + 1][1] ?? '') === ':') {
			$o += 2;
		}
		[$kindAfter, $textAfter] = $after[$o] ?? ['', ''];
		$useAfter = $b['uses'][$o] ?? null;
		$same = $kindAfter === $kind && ($use === null) === ($useAfter === null) && ($use === -1) === ($useAfter === -1);
		if (!$same || (($use ?? -1) < 0 && $textAfter !== $text)) {
			throw new RuntimeException('the names pass changed token #' . $t . ': ' . $text . ' → ' . $textAfter);
		}
		if ($use !== null && $use >= 0) {
			if (isset($map[$use]) && $map[$use] !== $useAfter) {
				throw new RuntimeException('the name ' . $text . ' at token #' . $t . ' now uses another declaration');
			}
			$map[$use] = $useAfter;
		}
		$o++;
	}
	if ($o !== count($after)) {
		throw new RuntimeException('the named script has ' . (count($after) - $o) . ' more tokens');
	}
	if (count(array_unique($map)) !== count($map)) {
		throw new RuntimeException('two declarations share a name in the named script');
	}
	if (MIN__JsScan($named)[0] !== $named) {
		throw new RuntimeException('the named script changes when scanned again');
	}
	return $named;
}

/**
 * The release's stylesheet from the files of $entry under $root, and its script from the modules of $entry, under the
 * $banner comment: [text, the sizes in bytes as written, joined and squeezed].
 * @param list<string> $files
 * @return array{string, array<string, int>}
 */
function MIN__Bundle(string $root, array $files, string $banner): array
{
	$joined = str_ends_with($files[0], '.css') ? implode("\n", array_map(fn(string $file): string => (string)file_get_contents($root . '/' . $file), $files)) : MIN__JsJoin($root, $files);
	$sizes = ['files' => array_sum(array_map(fn(string $file): int => (int)filesize($root . '/' . $file), $files)), 'joined' => strlen($joined)];
	if (str_ends_with($files[0], '.css')) {
		$min = MIN__CssSafe($joined);
	} else {
		$squeezed = MIN__JsSafe($joined);
		$sizes['squeezed'] = strlen($squeezed);
		$min = MIN__JsNamesSafe($squeezed);
	}
	$sizes['min'] = strlen($min);
	return [$banner . "\n" . $min . "\n", $sizes];
}
