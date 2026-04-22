#!/bin/bash
cd "$(dirname "$0")"
PORT=4040
echo ""
echo "  http://localhost:$PORT"
echo ""
open "http://localhost:$PORT" 2>/dev/null &
if command -v python3 &>/dev/null; then
  python3 -m http.server $PORT
elif command -v ruby &>/dev/null; then
  ruby -run -e httpd . -p $PORT
elif command -v php &>/dev/null; then
  php -S localhost:$PORT
else
  echo "No python3/ruby/php found. Run: xcode-select --install"
  read -p "Press Enter..."
fi
