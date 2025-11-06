const admin = require('firebase-admin');

let serviceAccount;
try {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
} catch (error) {
  console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:', error);
  serviceAccount = null;
}

if (!admin.apps.length && serviceAccount) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: 'netlify-jump-box.appspot.com'
  });
}

const bucket = admin.apps.length ? admin.storage().bucket() : null;

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  if (!bucket) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Firebase not initialized. Check FIREBASE_SERVICE_ACCOUNT_KEY environment variable.' })
    };
  }

  const fileId = event.queryStringParameters.fileId;
  if (!fileId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'fileId parameter required' })
    };
  }

  try {
    // List files with prefix to find the file
    const [files] = await bucket.getFiles({ prefix: `uploads/${fileId}-` });
    if (files.length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'File not found' })
      };
    }

    const file = files[0];

    // Generate a signed URL for download (valid for 1 hour)
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 60 * 60 * 1000, // 1 hour
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        downloadUrl: url,
        fileName: file.name.split('/').pop().split('-').slice(1).join('-') // Extract original filename
      })
    };
  } catch (error) {
    console.error('Download error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Download failed' })
    };
  }
};