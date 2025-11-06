const { createClient } = require('@supabase/supabase-js');
const Busboy = require('busboy');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

exports.handler = (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  if (!supabase) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Supabase not initialized. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.' })
    };
  }

  return new Promise(async (resolve, reject) => {
    try {
      // Validate user authentication
      const authHeader = event.headers.authorization || event.headers.Authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        resolve({
          statusCode: 401,
          body: JSON.stringify({ error: 'Unauthorized: No authentication token provided' })
        });
        return;
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix

      // Verify the JWT token
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);

      if (authError || !user) {
        resolve({
          statusCode: 401,
          body: JSON.stringify({ error: 'Unauthorized: Invalid authentication token' })
        });
        return;
      }

      // Continue with file upload for authenticated user
      const busboy = Busboy({ headers: event.headers });
      let fileBuffer = Buffer.alloc(0);
      let fileName = '';
      let mimeType = '';

      busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
        // Ensure filename is a string and handle cases where it might be undefined
        fileName = (typeof filename === 'string' && filename) ? filename : 'uploaded-file';
        mimeType = mimetype || 'application/octet-stream';
        file.on('data', (data) => {
          fileBuffer = Buffer.concat([fileBuffer, data]);
        });
      });

      busboy.on('finish', async () => {
        try {
          if (fileBuffer.length === 0) {
            resolve({
              statusCode: 400,
              body: JSON.stringify({ error: 'No file data received' })
            });
            return;
          }

          const fileId = Date.now() + '-' + Math.random().toString(36).substring(2);
          const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_'); // Sanitize filename
          const filePath = `uploads/${user.id}/${fileId}-${sanitizedFileName}`;

          console.log('Uploading file for user:', user.email, 'File:', filePath, 'Size:', fileBuffer.length, 'Type:', mimeType);

          // Set expiration to 24 hours from now
          const expirationTime = Date.now() + (24 * 60 * 60 * 1000); // 24 hours in milliseconds

          // Upload to Supabase Storage with user metadata
          const { data, error } = await supabase.storage
            .from('files')
            .upload(filePath, fileBuffer, {
              contentType: mimeType,
              upsert: false,
              metadata: {
                expiresAt: expirationTime.toString(),
                userId: user.id,
                userEmail: user.email,
                originalFileName: fileName
              }
            });

          if (error) {
            console.error('Supabase upload error:', error);
            resolve({
              statusCode: 500,
              body: JSON.stringify({ error: 'Upload failed: ' + error.message })
            });
            return;
          }

          // Get public URL (assuming bucket is public)
          const { data: urlData } = supabase.storage
            .from('files')
            .getPublicUrl(filePath);

          resolve({
            statusCode: 200,
            body: JSON.stringify({
              message: 'File uploaded successfully',
              fileId: fileId,
              downloadUrl: urlData.publicUrl,
              userId: user.id
            })
          });
        } catch (error) {
          console.error('Upload error:', error);
          resolve({
            statusCode: 500,
            body: JSON.stringify({ error: 'Upload failed: ' + error.message })
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

    } catch (error) {
      console.error('Auth validation error:', error);
      resolve({
        statusCode: 500,
        body: JSON.stringify({ error: 'Authentication validation failed' })
      });
    }
  });
};