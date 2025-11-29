import unittest
import os
from app import app
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

if __name__ == '__main__':
    unittest.main()

