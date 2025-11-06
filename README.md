# tools

This repository contains a Netlify-based file upload/download API.

## netlify-python-api

A serverless API for uploading and downloading files using Firebase Storage.

### Features
- Upload files via POST to `/.netlify/functions/upload`
- Download files by File ID via GET to `/.netlify/functions/download?fileId=<id>`
- Simple web interface at `index.html`

### Setup
1. Create a free Supabase account at https://supabase.com
2. Create a new project
3. Go to Settings → API to get your project URL and service role key
4. In Supabase Dashboard → Storage, create a new bucket called "files" and make it public
5. Install dependencies: `npm install`
6. Set environment variables in Netlify: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
7. Deploy to Netlify: `netlify deploy` or connect to GitHub for auto-deploy

### Security Note
The Supabase service role key is stored as Netlify environment variables for security.

### Usage
- Open `index.html` in a browser
- Upload a file to get a File ID and download link
- Use the File ID on another machine to download the file
