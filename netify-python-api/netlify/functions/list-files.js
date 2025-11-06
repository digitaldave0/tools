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

    // List files in user's uploads folder
    const { data: files, error } = await supabase.storage
      .from('files')
      .list(`uploads/${user.id}`);

    if (error || !files) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to list files' })
      };
    }

    const now = Date.now();
    const fileList = [];

    // Process each file
    for (const file of files) {
      const fileId = file.name.split('-').slice(0, 2).join('-'); // Extract fileId (timestamp-random)
      const originalFileName = file.name.split('-').slice(2).join('-'); // Extract original filename
      const expiresAt = file.metadata?.expiresAt ? parseInt(file.metadata.expiresAt) : null;
      const isExpired = expiresAt ? now > expiresAt : false;

      fileList.push({
        fileId: fileId,
        fileName: originalFileName,
        expiresAt: expiresAt,
        isExpired: isExpired,
        size: file.metadata?.size || 0,
        uploadedAt: file.created_at
      });
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        files: fileList
      })
    };
  } catch (error) {
    console.error('List files error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to list files: ' + error.message })
    };
  }
};