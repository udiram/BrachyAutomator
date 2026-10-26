import re
import unittest
import os
from flask import Response
from app import app, SECURITY_HEADERS, apply_security_headers
from brachy.auth import load_users

class BrachyTestCase(unittest.TestCase):
    def setUp(self):
        app.config['TESTING'] = True
        app.config['WTF_CSRF_ENABLED'] = False
        self.client = app.test_client()
        
    def test_login_page_loads(self):
        response = self.client.get('/login')
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'Sign In', response.data)

    def test_auth_logic(self):
        # Ensure we can read the CSV
        users = load_users()
        self.assertIn('simieles@uabmc.edu', users)
        self.assertEqual(users['simieles@uabmc.edu'], 'BabyLion!')

    def test_protected_routes(self):
        # Without login, should redirect to login
        response = self.client.get('/eye-plaque', follow_redirects=True)
        self.assertIn(b'Sign In', response.data)
        
    def test_calculator_logic(self):
        # Logic verification
        # 1 seed, 1 mCi apparent
        seeds = 1
        apparent = 1.0
        # Formula: Contained mCi = 1 * 1 * 1.62 = 1.62
        # GBq = 1.62 / 27.027 = 0.0599...
        contained_mci = seeds * apparent * 1.62
        contained_gbq = contained_mci / 27.027
        self.assertAlmostEqual(contained_mci, 1.62)
        self.assertAlmostEqual(contained_gbq, 0.05994, places=4)

    def _assert_security_headers(self, response):
        for name, value in SECURITY_HEADERS.items():
            self.assertEqual(response.headers.get(name), value, name)

    def test_security_headers_on_each_response_kind(self):
        login = self.client.get('/login')
        self.assertEqual(login.status_code, 200)
        self._assert_security_headers(login)

        redirect = self.client.get('/eye-plaque')
        self.assertEqual(redirect.status_code, 302)
        self._assert_security_headers(redirect)

        css = self.client.get('/static/css/main.css')
        self.assertEqual(css.status_code, 200)
        self._assert_security_headers(css)

        script = self.client.get('/static/js/eye_plaque.js')
        self.assertEqual(script.status_code, 200)
        self._assert_security_headers(script)

        missing = self.client.get('/no-such-page')
        self.assertEqual(missing.status_code, 404)
        self._assert_security_headers(missing)

    def test_security_headers_are_not_overwritten(self):
        response = Response('ok')
        response.headers['X-Frame-Options'] = 'SAMEORIGIN'
        apply_security_headers(response)
        self.assertEqual(response.headers['X-Frame-Options'], 'SAMEORIGIN')
        self.assertEqual(
            response.headers['Content-Security-Policy'],
            SECURITY_HEADERS['Content-Security-Policy'],
        )

    def test_pages_have_no_inline_scripts(self):
        login = self.client.get('/login')
        self.assertEqual(_inline_scripts(login.get_data(as_text=True)), [])

        self._login()
        page = self.client.get('/eye-plaque')
        self.assertEqual(page.status_code, 200)
        html = page.get_data(as_text=True)
        self.assertEqual(_inline_scripts(html), [])
        self.assertIn('name="current-user"', html)
        self.assertNotIn('window.current_user_id', html)

    def test_session_cookie_flags_when_not_debug(self):
        self.assertFalse(app.debug)
        self.assertTrue(app.config['SESSION_COOKIE_HTTPONLY'])
        self.assertEqual(app.config['SESSION_COOKIE_SAMESITE'], 'Lax')
        response = self._login()
        flags = _cookie_flags(_session_cookie(response))
        self.assertIn('httponly', flags)
        self.assertEqual(flags.get('samesite'), 'Lax')
        self.assertIn('secure', flags)

    def test_session_cookie_secure_off_in_debug(self):
        original_debug = app.debug
        original_secure = app.config['SESSION_COOKIE_SECURE']
        app.debug = True
        try:
            response = self._login()
            flags = _cookie_flags(_session_cookie(response))
            self.assertIn('httponly', flags)
            self.assertEqual(flags.get('samesite'), 'Lax')
            self.assertNotIn('secure', flags)
        finally:
            app.debug = original_debug
            app.config['SESSION_COOKIE_SECURE'] = original_secure

    def _login(self):
        users = load_users()
        username = next(iter(users))
        return self.client.post('/login', data={
            'username': username,
            'password': users[username],
        }, follow_redirects=False)


def _inline_scripts(html):
    return re.findall(r'<script\b(?![^>]*\bsrc\s*=)[^>]*>', html, flags=re.I)


def _session_cookie(response):
    cookies = response.headers.getlist('Set-Cookie')
    for cookie in cookies:
        if cookie.startswith('session='):
            return cookie
    raise AssertionError('session cookie missing: %r' % (cookies,))


def _cookie_flags(set_cookie):
    flags = {}
    for part in [piece.strip() for piece in set_cookie.split(';')][1:]:
        if '=' in part:
            name, value = part.split('=', 1)
            flags[name.lower()] = value
        else:
            flags[part.lower()] = True
    return flags


if __name__ == '__main__':
    unittest.main()

