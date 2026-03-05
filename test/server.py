#!/usr/bin/env python3
"""
Local test server for Undisposition browser extension.

Serves files with specific HTTP headers to test that the extension
correctly handles Content-Disposition and Content-Type rewriting.

Usage:
    python3 test/server.py
    # Then visit http://localhost:8888/
"""

import http.server
import socketserver

import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8888

# Minimal test file contents
SVG_CONTENT = b'''<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <rect width="200" height="200" fill="#5084ee"/>
  <text x="100" y="110" text-anchor="middle" fill="white" font-size="20">SVG Test</text>
</svg>'''

# 1x1 pixel PNG
PNG_CONTENT = bytes([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,  # PNG signature
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,  # IHDR chunk
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
    0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,  # IDAT chunk
    0x54, 0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00,
    0x00, 0x00, 0x02, 0x00, 0x01, 0xE2, 0x21, 0xBC,
    0x33, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E,  # IEND chunk
    0x44, 0xAE, 0x42, 0x60, 0x82,
])

# 1x1 pixel WebP (lossy)
WEBP_CONTENT = bytes([
    0x52, 0x49, 0x46, 0x46, 0x1A, 0x00, 0x00, 0x00,
    0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20,
    0x0E, 0x00, 0x00, 0x00, 0x30, 0x01, 0x00, 0x9D,
    0x01, 0x2A, 0x01, 0x00, 0x01, 0x00, 0x01, 0x40,
    0x25, 0xA4, 0x00, 0x03, 0x70, 0x00, 0xFE, 0xFB,
    0x94, 0x00, 0x00,
])

CSV_CONTENT = b'''name,email,score
Alice,alice@example.com,95
Bob,bob@example.com,87
Charlie,charlie@example.com,92
'''

PDF_CONTENT = b"""%PDF-1.0
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 44 >>
stream
BT /F1 24 Tf 100 700 Td (PDF Test) Tj ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000266 00000 n
0000000360 00000 n
trailer << /Size 6 /Root 1 0 R >>
startxref
441
%%EOF"""

ZIP_CONTENT = b'PK\x05\x06' + (b'\x00' * 18)  # empty zip

INDEX_HTML = b'''<!DOCTYPE html>
<html lang="en">
<head>
  <title>Undisposition Test Server</title>
  <style>
    html { background: #1a1a1a; color: #e0e0e0; font-family: monospace; }
    body { max-width: 800px; margin: 40px auto; padding: 0 20px; }
    h1 { color: #5084ee; }
    h2 { color: #e91e63; margin-top: 2em; }
    a { color: #5084ee; }
    table { border-collapse: collapse; width: 100%; margin: 10px 0; }
    td, th { border: 1px solid #444; padding: 8px; text-align: left; }
    th { background: #333; }
    .pass { color: #4caf50; }
    .info { color: #aaa; font-size: 0.9em; }
  </style>
</head>
<body>
  <h1>Undisposition Test Server</h1>
  <p class="info">
    All test files below are served with specific HTTP headers to test
    the extension. Open DevTools Network tab to inspect headers.
  </p>

  <h2>Image Formats</h2>
  <p>Served with <code>Content-Type: application/octet-stream</code>
     and <code>Content-Disposition: attachment</code>.</p>
  <p>With extension ON: should display inline. With extension OFF: should download.</p>
  <table>
    <tr><th>Link</th><th>Expected (ext ON)</th></tr>
    <tr><td><a href="/test.webp">/test.webp</a></td><td>Displays as image</td></tr>
    <tr><td><a href="/test.avif">/test.avif</a></td><td>Displays as image (if browser supports AVIF)</td></tr>
    <tr><td><a href="/test.svg">/test.svg</a></td><td>Displays as SVG graphic</td></tr>
    <tr><td><a href="/test.apng">/test.apng</a></td><td>Displays as image</td></tr>
    <tr><td><a href="/test.pdf">/test.pdf</a></td><td>Displays as PDF</td></tr>
    <tr><td><a href="/test.png">/test.png</a></td><td>Displays as image</td></tr>
  </table>

  <h2>Content-Type Rewriting</h2>
  <p>Files served with Content-Types that normally trigger a download.</p>
  <table>
    <tr><th>Link</th><th>Server Headers</th><th>Expected (ext ON)</th></tr>
    <tr>
      <td><a href="/test.csv">/test.csv</a></td>
      <td><code>Content-Type: text/csv</code></td>
      <td>Displays as plain text in browser</td>
    </tr>
  </table>

  <h2>Binary Downloads</h2>
  <p>Files with binary Content-Types. The extension should preserve Content-Disposition
     so the browser keeps the server-provided filename.</p>
  <table>
    <tr><th>Link</th><th>Server Headers</th><th>Expected (ext ON)</th></tr>
    <tr>
      <td><a href="/test.zip">/test.zip</a></td>
      <td><code>Content-Type: application/zip</code>, <code>Content-Disposition: attachment; filename=Example.zip</code></td>
      <td>Downloads as <b>Example.zip</b> (not test.zip)</td>
    </tr>
    <tr>
      <td><a href="/test.rar">/test.rar</a></td>
      <td><code>Content-Type: application/x-rar-compressed</code>, <code>Content-Disposition: attachment; filename=Archive.rar</code></td>
      <td>Downloads as <b>Archive.rar</b></td>
    </tr>
    <tr>
      <td><a href="/test.exe">/test.exe</a></td>
      <td><code>Content-Type: application/octet-stream</code>, <code>Content-Disposition: attachment; filename=Setup.exe</code></td>
      <td>Downloads as <b>Setup.exe</b></td>
    </tr>
  </table>

  <h2>URL Edge Cases</h2>
  <p>URLs with query strings, paths without extensions, etc.</p>
  <table>
    <tr><th>Link</th><th>Server Headers</th><th>Expected (ext ON)</th></tr>
    <tr>
      <td><a href="/download/report.pdf?token=abc&amp;v=2">/download/report.pdf?token=abc&amp;v=2</a></td>
      <td><code>Content-Type: application/octet-stream</code>, <code>Content-Disposition: attachment</code></td>
      <td>Displays as PDF (query string should not confuse extension)</td>
    </tr>
    <tr>
      <td><a href="/download/data">/download/data</a></td>
      <td><code>Content-Type: application/octet-stream</code>, <code>Content-Disposition: attachment</code></td>
      <td>Displays as plain text (no extension fallback)</td>
    </tr>
  </table>

  <h2>Default Blacklist</h2>
  <p>To verify the default blacklist is seeded on first install:</p>
  <ol>
    <li>Remove and re-load the extension</li>
    <li>Right-click extension icon &rarr; Settings</li>
    <li>Verify <code>googleusercontent.com</code> appears in the blacklist</li>
  </ol>

  <hr>
  <p class="info">Toggle the extension on/off by clicking the toolbar icon.
  Badge should change between blue (active) and pink (disabled).</p>
</body>
</html>'''


# Route definitions: path -> (content_bytes, headers_dict)
ROUTES = {
    '/': (INDEX_HTML, {'Content-Type': 'text/html; charset=utf-8'}),

    # Image formats served as octet-stream with attachment
    '/test.webp': (WEBP_CONTENT, {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': 'attachment; filename=test.webp',
    }),
    '/test.avif': (PNG_CONTENT, {  # use PNG bytes, the MIME type is what matters
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': 'attachment; filename=test.avif',
    }),
    '/test.svg': (SVG_CONTENT, {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': 'attachment; filename=test.svg',
    }),
    '/test.apng': (PNG_CONTENT, {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': 'attachment; filename=test.apng',
    }),

    # Existing formats (regression)
    '/test.pdf': (PDF_CONTENT, {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': 'attachment; filename=test.pdf',
    }),
    '/test.png': (PNG_CONTENT, {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': 'attachment; filename=test.png',
    }),

    # Content-Type rewriting
    '/test.csv': (CSV_CONTENT, {
        'Content-Type': 'text/csv',
    }),

    # Binary downloads (Content-Disposition should be preserved)
    '/test.zip': (ZIP_CONTENT, {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename=Example.zip',
    }),
    '/test.exe': (b'\x00' * 16, {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': 'attachment; filename=Setup.exe',
    }),
    '/test.rar': (b'\x52\x61\x72\x21' + b'\x00' * 12, {
        'Content-Type': 'application/x-rar-compressed',
        'Content-Disposition': 'attachment; filename=Archive.rar',
    }),

    # URL edge cases
    '/download/report.pdf': (PDF_CONTENT, {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': 'attachment; filename=report.pdf',
    }),
    '/download/data': (b'some plain text data\n', {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': 'attachment; filename=data',
    }),
}


class TestHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        # Strip query string for route matching
        path = self.path.split('?')[0]

        if path in ROUTES:
            content, headers = ROUTES[path]
            self.send_response(200)
            for key, value in headers.items():
                self.send_header(key, value)
            self.send_header('Content-Length', str(len(content)))
            self.end_headers()
            self.wfile.write(content)
        else:
            self.send_response(404)
            self.send_header('Content-Type', 'text/plain')
            self.end_headers()
            self.wfile.write(b'404 Not Found')

    def log_message(self, format, *args):
        # Colorized logging
        print(f"  [{self.address_string()}] {args[0]}")


class TestServer(socketserver.TCPServer):
    allow_reuse_address = True


if __name__ == '__main__':
    with TestServer(("", PORT), TestHandler) as httpd:
        print(f"Undisposition test server running at http://localhost:{PORT}/")
        print(f"Press Ctrl+C to stop.\n")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nStopping server.")
            httpd.shutdown()
