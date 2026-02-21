#!/usr/bin/env python3
"""
Vercel serverless entry point for Flask application.
Vercel Python runtime expects a WSGI callable named 'app'.
"""
import os
import sys

# Add parent directory to path to import app
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Set Vercel environment flag
os.environ['VERCEL'] = '1'

# Import the Flask app from app.py
from app import app

# Export the Flask app for Vercel
# Vercel Python runtime will look for 'app' or 'application'
application = app

# For local testing
if __name__ == "__main__":
    app.run(debug=True, port=5000)