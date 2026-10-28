# scan.awk — the reading behind scan.sh: the map and the class list first, then the project's files line by line.
BEGIN {
	FS = "\t"
	owned = split(own, prefixes, " ")
}

FILENAME == ARGV[1] {
	if (FNR > 1) {
		kind[$1] = $3
		target[$1] = $2
	}
	next
}

FILENAME == ARGV[2] {
	known[$0] = 1
	next
}

function report(token, what, form) {
	printf "%s:%d:%s:%s:%s\n", FILENAME, FNR, token, what, form
	found++
}

function check(token,    i) {
	if (token == "" || token ~ /[<>{}$()]/) {
		return
	}
	if (token in kind) {
		if (kind[token] != "same") {
			report(token, kind[token], target[token])
		}
		return
	}
	if (token in known) {
		return
	}
	for (i = 1; i <= owned; i++) {
		if (index(token, prefixes[i]) == 1) {
			return
		}
	}
	report(token, "unknown", "")
}

function classes(value,    n, i, tokens) {
	n = split(value, tokens, /[ \t]+/)
	for (i = 1; i <= n; i++) {
		check(tokens[i])
	}
}

{
	rest = $0
	while (match(rest, /class(Name)?[ \t]*=[ \t]*("[^"]*"|'[^']*')/)) {
		value = substr(rest, RSTART, RLENGTH)
		rest = substr(rest, RSTART + RLENGTH)
		sub(/^class(Name)?[ \t]*=[ \t]*./, "", value)
		sub(/.$/, "", value)
		if (value ~ /<\?|\{\{|\{%|\$\{|<%/) {
			report("class", "review", "a class built in code: write every class name out whole")
		}
		classes(value)
	}
	rest = $0
	while (match(rest, /classList\.(add|remove|toggle|contains)\([^)]*\)/)) {
		value = substr(rest, RSTART, RLENGTH)
		rest = substr(rest, RSTART + RLENGTH)
		gsub(/^classList\.[a-z]+\(|\)$|['"]/, "", value)
		gsub(/,/, " ", value)
		classes(value)
	}
	rest = $0
	while (match(rest, /(querySelector(All)?|closest|matches)\(['"][^'"]*['"]/)) {
		value = substr(rest, RSTART, RLENGTH)
		rest = substr(rest, RSTART + RLENGTH)
		while (match(value, /\.[a-zA-Z][a-zA-Z0-9_-]*/)) {
			check(substr(value, RSTART + 1, RLENGTH - 1))
			value = substr(value, RSTART + RLENGTH)
		}
	}
	rest = $0
	while (match(rest, /data-bs-[a-z-]+(="[^"]*")?/)) {
		value = substr(rest, RSTART, RLENGTH)
		rest = substr(rest, RSTART + RLENGTH)
		name = value
		sub(/=.*/, "", name)
		if (value in kind) {
			report(value, kind[value], target[value])
		} else if (name in kind) {
			report(name, kind[name], target[name])
		} else {
			report(name, "review", "no REDZ.UI form: see the skill's references/triggers.md")
		}
	}
	rest = $0
	while (match(rest, /bootstrap\.[A-Z][A-Za-z]+/)) {
		value = substr(rest, RSTART, RLENGTH)
		rest = substr(rest, RSTART + RLENGTH)
		report(value, value in kind ? kind[value] : "review", value in kind ? target[value] : "")
	}
	if ($0 ~ /['"](btn|alert|badge|text|bg|border|col|table|d|m[tbsexy]?|p[tbsexy]?)-['"][ \t]*\./) {
		report("class", "review", "a class built in code: write every class name out whole")
	}
}

END {
	exit found > 0 ? 1 : 0
}
