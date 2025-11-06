const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'GET') {
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

  const fileId = event.queryStringParameters.fileId;
  if (!fileId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'fileId parameter required' })
    };
  }

  try {
    // List files with prefix to find the file
    const { data: files, error } = await supabase.storage
      .from('files')
      .list('uploads', {
        search: fileId
      });

    if (error || !files || files.length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'File not found' })
      };
    }

    const file = files[0];
    const filePath = `uploads/${file.name}`;

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('files')
      .getPublicUrl(filePath);

    return {
      statusCode: 200,
      body: JSON.stringify({
        downloadUrl: urlData.publicUrl,
        fileName: file.name.split('-').slice(1).join('-') // Extract original filename
      })
    };
  } catch (error) {
    console.error('Download error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Download failed: ' + error.message })
    };
  }
};;