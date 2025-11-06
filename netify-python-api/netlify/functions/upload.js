const admin = require('firebase-admin');
const Busboy = require('busboy');
const path = require('path');
const os = require('os');
const fs = require('fs');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: 'netlify-jump-box.appspot.com'
  });
}

const bucket = admin.storage().bucket();

exports.handler = (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  return new Promise((resolve, reject) => {
    const busboy = Busboy({ headers: event.headers });
    let fileBuffer = Buffer.alloc(0);
    let fileName = '';
    let mimeType = '';

    busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
      fileName = filename;
      mimeType = mimetype;
      file.on('data', (data) => {
        fileBuffer = Buffer.concat([fileBuffer, data]);
      });
    });

    busboy.on('finish', async () => {
      try {
        const fileId = Date.now() + '-' + Math.random().toString(36).substring(2);
        const filePath = `uploads/${fileId}-${fileName}`;
        const fileUpload = bucket.file(filePath);

        await fileUpload.save(fileBuffer, {
          metadata: {
            contentType: mimeType,
          },
        });

        // Generate a signed URL for download (valid for 1 hour)
        const [url] = await fileUpload.getSignedUrl({
          action: 'read',
          expires: Date.now() + 60 * 60 * 1000, // 1 hour
        });

        resolve({
          statusCode: 200,
          body: JSON.stringify({
            message: 'File uploaded successfully',
            fileId: fileId,
            downloadUrl: url
          })
        });
      } catch (error) {
        console.error('Upload error:', error);
        resolve({
          statusCode: 500,
          body: JSON.stringify({ error: 'Upload failed' })
        });
      }
    });

    busboy.on('error', (error) => {
      console.error('Busboy error:', error);
      resolve({
        statusCode: 500,
        body: JSON.stringify({ error: 'File parsing failed' })
      });
    });

    // Write the event body to busboy
    busboy.write(event.body, event.isBase64Encoded ? 'base64' : 'binary');
    busboy.end();
  });
};