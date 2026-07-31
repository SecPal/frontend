#!/bin/sh
# SPDX-FileCopyrightText: 2026 SecPal Contributors
# SPDX-License-Identifier: MIT

set -eu

umask 077

fail_origin_contract() {
  echo "ERROR: SECPAL_API_URL must be an exact ASCII HTTPS origin with a valid hostname and optional port 1-65535." >&2
  exit 1
}

validate_origin() {
  printf '%s\n' "$1" | awk '
    function all_digits(value, index_, character_) {
      if (length(value) == 0) return 0
      for (index_ = 1; index_ <= length(value); index_++) {
        character_ = substr(value, index_, 1)
        if (character_ < "0" || character_ > "9") return 0
      }
      return 1
    }

    function valid_ipv4(value, parts_, count_, index_, octet_) {
      count_ = split(value, parts_, ".")
      if (count_ != 4) return 0
      for (index_ = 1; index_ <= count_; index_++) {
        octet_ = parts_[index_]
        if (!all_digits(octet_)) return 0
        if (length(octet_) > 1 && substr(octet_, 1, 1) == "0") return 0
        if ((octet_ + 0) > 255) return 0
      }
      return 1
    }

    function is_loopback_ipv4(value, parts_, count_) {
      count_ = split(value, parts_, ".")
      if (count_ != 4) return 0
      return (parts_[1] + 0) == 127 || value == "0.0.0.0"
    }

    function is_loopback_hostname(value, normalized_) {
      normalized_ = tolower(value)
      if (normalized_ == "localhost" || normalized_ ~ /\.localhost$/) return 1
      return valid_ipv4(normalized_) && is_loopback_ipv4(normalized_)
    }

    function is_ipv4_number_syntax(value, parts_, count_, index_, part_) {
      count_ = split(value, parts_, ".")
      if (count_ < 1 || count_ > 4) return 0
      for (index_ = 1; index_ <= count_; index_++) {
        part_ = parts_[index_]
        if (all_digits(part_)) continue
        if (part_ ~ /^0[xX][0-9A-Fa-f]+$/) continue
        return 0
      }
      return 1
    }

    function valid_hostname(value, labels_, count_, index_, label_, char_index_, character_) {
      if (length(value) == 0 || length(value) > 253) return 0
      if (is_ipv4_number_syntax(value)) return valid_ipv4(value)
      count_ = split(value, labels_, ".")
      for (index_ = 1; index_ <= count_; index_++) {
        label_ = labels_[index_]
        if (length(label_) == 0 || length(label_) > 63) return 0
        if (substr(label_, 1, 1) == "-" || substr(label_, length(label_), 1) == "-") return 0
        for (char_index_ = 1; char_index_ <= length(label_); char_index_++) {
          character_ = substr(label_, char_index_, 1)
          if (index("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-", character_) == 0) return 0
        }
      }
      return 1
    }

    function valid_hex_group(value, index_, character_) {
      if (length(value) == 0 || length(value) > 4) return 0
      for (index_ = 1; index_ <= length(value); index_++) {
        character_ = substr(value, index_, 1)
        if (index("0123456789abcdefABCDEF", character_) == 0) return 0
      }
      return 1
    }

    function valid_ipv6(value, compressed_, remainder_, parts_, count_, index_, group_, weight_) {
      if (index(value, ":") == 0 || value ~ /:::/) return 0
      if (substr(value, 1, 1) == ":" && substr(value, 1, 2) != "::") return 0
      if (substr(value, length(value), 1) == ":" && substr(value, length(value) - 1, 2) != "::") return 0

      compressed_ = index(value, "::") > 0
      if (compressed_) {
        remainder_ = substr(value, index(value, "::") + 2)
        if (index(remainder_, "::") > 0) return 0
      }

      count_ = split(value, parts_, ":")
      weight_ = 0
      for (index_ = 1; index_ <= count_; index_++) {
        group_ = parts_[index_]
        if (group_ == "") continue
        if (index(group_, ".") > 0) {
          if (index_ != count_ || !valid_ipv4(group_)) return 0
          weight_ += 2
        } else {
          if (!valid_hex_group(group_)) return 0
          weight_++
        }
      }

      return compressed_ ? weight_ < 8 : weight_ == 8
    }

    function is_local_ipv6(value, parts_, count_, index_, group_, last_, nonzero_) {
      count_ = split(value, parts_, ":")
      last_ = 0
      for (index_ = 1; index_ <= count_; index_++) {
        if (parts_[index_] != "") last_ = index_
      }

      if (last_ == 0) return 1
      if (index(parts_[last_], ".") > 0) {
        for (index_ = 1; index_ < last_; index_++) {
          group_ = tolower(parts_[index_])
          if (group_ == "" || group_ ~ /^0+$/ || group_ == "ffff") continue
          return 0
        }
        return is_loopback_ipv4(parts_[last_])
      }

      nonzero_ = 0
      for (index_ = 1; index_ <= last_; index_++) {
        group_ = parts_[index_]
        if (group_ == "" || group_ ~ /^0+$/) continue
        nonzero_++
        if (index_ != last_ || group_ !~ /^0*1$/) return 0
      }

      return nonzero_ <= 1
    }

    NR == 1 { origin = $0 }
    NR > 1 { extra_line = 1 }

    END {
      if (NR != 1 || extra_line || substr(origin, 1, 8) != "https://") exit 1

      authority = substr(origin, 9)
      if (length(authority) == 0) exit 1
      for (i = 1; i <= length(authority); i++) {
        character = substr(authority, i, 1)
        if (index("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.:-[]", character) == 0) exit 1
      }

      port = ""
      has_port = 0
      if (substr(authority, 1, 1) == "[") {
        closing = index(authority, "]")
        if (closing == 0) exit 1
        host = substr(authority, 2, closing - 2)
        suffix = substr(authority, closing + 1)
        if (suffix != "") {
          if (substr(suffix, 1, 1) != ":") exit 1
          has_port = 1
          port = substr(suffix, 2)
        }
        if (!valid_ipv6(host)) exit 1
        if (is_local_ipv6(host)) exit 1
      } else {
        colon = index(authority, ":")
        if (colon > 0) {
          has_port = 1
          host = substr(authority, 1, colon - 1)
          port = substr(authority, colon + 1)
          if (index(port, ":") > 0) exit 1
        } else {
          host = authority
        }
        if (!valid_hostname(host)) exit 1
        if (is_loopback_hostname(host)) exit 1
      }

      if (has_port && (!all_digits(port) || (port + 0) < 1 || (port + 0) > 65535)) exit 1
    }
  '
}

if [ "${SECPAL_API_URL+x}" != "x" ] || ! validate_origin "$SECPAL_API_URL"; then
  fail_origin_contract
fi

runtime_directory=/tmp/secpal-runtime
nginx_directory=/tmp/secpal-nginx

fail_runtime_path() {
  echo "ERROR: Runtime temporary paths are not safe private directories." >&2
  exit 1
}

ensure_private_directory() {
  private_directory=$1

  if [ -L "$private_directory" ] ||
    { [ -e "$private_directory" ] && [ ! -d "$private_directory" ]; }; then
    fail_runtime_path
  fi

  if [ ! -d "$private_directory" ]; then
    mkdir -m 0700 "$private_directory" || fail_runtime_path
  fi

  chmod 0700 "$private_directory" || fail_runtime_path
}

ensure_private_directory "$runtime_directory"
ensure_private_directory "$nginx_directory"

for private_directory in \
  "$nginx_directory/client-body" \
  "$nginx_directory/proxy" \
  "$nginx_directory/fastcgi" \
  "$nginx_directory/uwsgi" \
  "$nginx_directory/scgi"; do
  ensure_private_directory "$private_directory"
done

runtime_file="$runtime_directory/runtime-config.js"
if [ -e "$runtime_file" ] && [ ! -f "$runtime_file" ] && [ ! -L "$runtime_file" ]; then
  fail_runtime_path
fi
rm -f "$runtime_file"

staging_directory="$runtime_directory/.write.$$"
if [ -e "$staging_directory" ] || [ -L "$staging_directory" ]; then
  fail_runtime_path
fi
mkdir -m 0700 "$staging_directory" || fail_runtime_path

temporary_file="$staging_directory/runtime-config.js"
cleanup_staging() {
  rm -f "$temporary_file"
  rmdir "$staging_directory" 2>/dev/null || true
}
trap cleanup_staging EXIT HUP INT TERM

printf '%s\n' \
  'window.__SECPAL_RUNTIME_CONFIG__ = Object.freeze({' \
  "  apiBaseUrl: \"$SECPAL_API_URL\"," \
  '});' >"$temporary_file"
chmod 0444 "$temporary_file"
mv "$temporary_file" "$runtime_file"
rmdir "$staging_directory"
trap - EXIT HUP INT TERM

nginx -t

exec "$@"
