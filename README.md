# Brachytherapy Automator

A Flask-based web application for automating and documenting brachytherapy packaging procedures.

## Features

- **Secure Login**: CSV-based authentication.
- **Eye Plaque Workflow**:
  - Interactive checklist with progress tracking.
  - Automated Activity Calculator (GBq/mCi).
  - Radiation Survey classifier (White-I, Yellow-II, Yellow-III).
  - Per-step notes and file attachments.
  - PDF Export of completed tasks.
  - CSV Export of calculations.
- **Extensible**: Placeholders for Prostate and Gynecologic procedures.

## Setup

1.  **Install Dependencies**:
    ```bash
    pip install -r requirements.txt
    ```

2.  **Configure Users**:
    - Edit `allowed_users.csv` to add valid users.
    - Format: `username,password`

3.  **Run the App**:
    ```bash
    python app.py
    ```
    - Access at `http://localhost:5000`

## Usage

1.  Log in with credentials from `allowed_users.csv`.
2.  Navigate to **Eye Plaque**.
3.  Click "Start New Task".
4.  Follow the checklist.
    - Use the Calculator to determine the correct workflow (<10, 10-81, >81 mCi).
    - Upload photos or add notes to specific steps if needed.
5.  Enter final radiation survey reading.
6.  Export PDF summary.

## Testing

Run unit tests:
```bash
python -m unittest discover tests
```

