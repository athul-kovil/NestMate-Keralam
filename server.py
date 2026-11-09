#!/usr/bin/env python3
"""
NestMate - Local HTTP Development Server
Serves the roommate finder web application with proper MIME types and UTF-8 encoding.
Usage:
    python server.py
"""

import http.server
import socketserver
import os
import sys
import webbrowser

PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class NestMateHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        # Enable CORS and caching headers for local dev
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        super().end_headers()

    def guess_type(self, path):
        mtype = super().guess_type(path)
        if path.endswith('.js'):
            return 'application/javascript; charset=utf-8'
        elif path.endswith('.css'):
            return 'text/css; charset=utf-8'
        elif path.endswith('.html'):
            return 'text/html; charset=utf-8'
        return mtype

def run_server():
    os.chdir(DIRECTORY)
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

    socketserver.TCPServer.allow_reuse_address = True
    
    ports = [8000, 8080, 5000, 3000, 8888]
    httpd = None
    active_port = PORT
    
    for p in ports:
        try:
            httpd = socketserver.TCPServer(("", p), NestMateHandler)
            active_port = p
            break
        except OSError:
            continue
            
    if not httpd:
        httpd = socketserver.TCPServer(("", 0), NestMateHandler)
        active_port = httpd.server_address[1]

    url = f"http://localhost:{active_port}"
    print("=" * 60)
    print("  NestMate - Roommate & Shared Space Matching Platform")
    print("=" * 60)
    print(f"  > Server running at: {url}")
    print(f"  > Serving files from: {DIRECTORY}")
    print(f"  > Opening default browser at {url}...")
    print("  > Press Ctrl+C to stop the server")
    print("=" * 60)
    
    # Auto-open browser
    try:
        webbrowser.open(url)
    except Exception:
        pass

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down NestMate server. Goodbye!")

if __name__ == "__main__":
    run_server()
