import argparse
import json
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

from config import BASE_DIR
from renderer import mobile_rows_html, rows_html, write_index
from scraper import get_standings


def run_once():
    print('=' * 60)
    print(' LA ANT MATCH - Flashscore -> HTML/CSS')
    print('=' * 60)

    standings = get_standings()

    if len(standings) != 16:
        raise RuntimeError(
            f'Expected 16 teams, but scraper returned {len(standings)}. '
            'index.html was NOT replaced.'
        )

    standings.sort(key=lambda x: x['rank'])
    write_index(standings)

    print('\nCLASSEMENT:')
    for team in standings:
        logo = 'LOGO OK' if team.get('logo') or team.get('logo_src') else 'NO LOGO'
        print(
            f"{team['rank']:>2} | "
            f"MJ={team['played']} | PTS={team['points']} | {logo}"
        )

    print('\nDONE.')


class AppHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(BASE_DIR), **kwargs)

    def do_POST(self):
        if self.path != '/api/update':
            self.send_error(404, 'Not found')
            return

        try:
            standings = get_standings()
            if len(standings) != 16:
                raise RuntimeError(
                    f'Expected 16 teams, but scraper returned {len(standings)}.'
                )
            standings.sort(key=lambda x: x['rank'])
            payload = {
                'rows': rows_html(standings),
                'mobileRows': mobile_rows_html(standings),
            }
            body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        except Exception as exc:
            body = json.dumps({'error': str(exc)}, ensure_ascii=False).encode('utf-8')
            self.send_response(500)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        print(f'[server] {format % args}')


def serve(host='127.0.0.1', port=8000):
    server = ThreadingHTTPServer((host, port), AppHandler)
    print(f'Open http://{host}:{port}/index.html')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nServer stopped.')
    finally:
        server.server_close()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--watch', action='store_true')
    parser.add_argument('--interval', type=int, default=300)
    parser.add_argument('--serve', action='store_true')
    parser.add_argument('--port', type=int, default=8000)
    args = parser.parse_args()

    if args.serve:
        serve(port=args.port)
        return

    if not args.watch:
        run_once()
        return

    while True:
        try:
            run_once()
        except Exception as exc:
            print(f'ERROR: {exc}')
        print(f'\nNext update in {args.interval}s...')
        time.sleep(max(10, args.interval))


if __name__ == '__main__':
    main()
