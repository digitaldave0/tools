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
    // Validate user authentication
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Unauthorized: No authentication token provided' })
      };
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify the JWT token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Unauthorized: Invalid authentication token' })
      };
    }

    // List files in user's uploads folder and find the one matching fileId
    const { data: files, error } = await supabase.storage
      .from('files')
      .list(`uploads/${user.id}`);

    if (error || !files) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to list files' })
      };
    }

    // Find file that starts with the fileId
    const file = files.find(f => f.name.startsWith(fileId + '-'));

    if (!file) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'File not found' })
      };
    }

    // Check if file has expired
    const now = Date.now();
    const expiresAt = file.metadata?.expiresAt ? parseInt(file.metadata.expiresAt) : null;

    if (expiresAt && now > expiresAt) {
      // File has expired, delete it
      await supabase.storage
        .from('files')
        .remove([`uploads/${user.id}/${file.name}`]);

      return {
        statusCode: 410, // Gone
        body: JSON.stringify({ error: 'File has expired and been deleted' })
      };
    }

    const filePath = `uploads/${user.id}/${file.name}`;

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('files')
      .getPublicUrl(filePath);

    // Extract original filename (everything after the first dash after fileId)
    const originalFileName = file.name.split('-').slice(1).join('-');

    return {
      statusCode: 200,
      body: JSON.stringify({
        downloadUrl: urlData.publicUrl,
        fileName: originalFileName,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null
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