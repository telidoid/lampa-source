#!/bin/sh
set -e

MODIFICATION_FILE="/usr/local/apache2/htdocs/plugins/modification.js"

substitute() {
    placeholder="$1"
    value="$2"

    if [ -n "$value" ]; then
        sed -i "s#${placeholder}#${value}#g" "$MODIFICATION_FILE"
    fi
}

substitute '%%TORRSERVER_URL%%' "$TORRSERVER_URL"
substitute '%%JACKETT_URL%%' "$JACKETT_URL"
substitute '%%JACKETT_KEY%%' "$JACKETT_KEY"
substitute '%%PROWLARR_URL%%' "$PROWLARR_URL"
substitute '%%PROWLARR_KEY%%' "$PROWLARR_KEY"
substitute '%%PARSER_TORRENT_TYPE%%' "$PARSER_TORRENT_TYPE"
substitute '%%PARSER_USE%%' "$PARSER_USE"

exec httpd-foreground
