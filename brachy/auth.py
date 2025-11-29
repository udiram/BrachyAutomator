import csv
import os
from flask_login import UserMixin

class User(UserMixin):
    def __init__(self, id):
        self.id = id

def load_users():
    """
    Loads users from allowed_users.csv
    Returns a dictionary {username: password}
    """
    users = {}
    csv_path = os.path.join(os.getcwd(), 'allowed_users.csv')
    if os.path.exists(csv_path):
        with open(csv_path, mode='r', newline='', encoding='utf-8') as csvfile:
            reader = csv.DictReader(csvfile)
            for row in reader:
                if 'username' in row and 'password' in row:
                    username = row['username'].strip()
                    password = row['password'].strip()
                    users[username] = password
    return users

