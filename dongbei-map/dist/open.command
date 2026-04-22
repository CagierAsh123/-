#!/bin/bash
cd "$(dirname "$0")"
PORT=4040
echo ""
echo "========================================"
echo "  Yanbian Prefecture Data Visualization"
echo "========================================"
echo ""
echo "  http://localhost:$PORT"
echo "  Close this window to stop"
echo ""

open "http://localhost:$PORT" 2>/dev/null &

# try python3 first, then ruby (macOS built-in)
if command -v python3 &>/dev/null; then
  python3 -m http.server $PORT
elif command -v ruby &>/dev/null; then
  ruby -run -e httpd . -p $PORT
elif command -v php &>/dev/null; then
  php -S localhost:$PORT
else
  echo "ERROR: No python3/ruby/php found."
  echo "Install: xcode-select --install"
  read -p "Press Enter to close..."
fi
