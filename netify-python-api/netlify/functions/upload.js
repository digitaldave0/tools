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

        // Upload to Supabase Storage
        const { data, error } = await supabase.storage
          .from('files') // You'll need to create this bucket in Supabase
          .upload(filePath, fileBuffer, {
            contentType: mimeType,
            upsert: false
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
            downloadUrl: urlData.publicUrl
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
  });
};