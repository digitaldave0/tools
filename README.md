# tools

This repository contains a Netlify-based file upload/download API.

## netlify-python-api

A serverless API for uploading and downloading files using Firebase Storage.

### Features
- Upload files via POST to `/.netlify/functions/upload`
- Download files by File ID via GET to `/.netlify/functions/download?fileId=<id>`
- Simple web interface at `index.html`

### Setup
1. Install dependencies: `npm install`
2. Set environment variable in Netlify: `FIREBASE_SERVICE_ACCOUNT_KEY` with the full JSON service account key
3. Deploy to Netlify: `netlify deploy` or connect to GitHub for auto-deploy

### Security Note
The Firebase service account key is stored as a Netlify environment variable `FIREBASE_SERVICE_ACCOUNT_KEY` for security.

### Usage
- Open `index.html` in a browser
- Upload a file to get a File ID and download link
- Use the File ID on another machine to download the file
