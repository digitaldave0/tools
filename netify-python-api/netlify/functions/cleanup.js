const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

exports.handler = async (event, context) => {
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

  try {
    // List all files in uploads folder
    const { data: files, error } = await supabase.storage
      .from('files')
      .list('uploads');

    if (error || !files) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to list files' })
      };
    }

    const now = Date.now();
    const expiredFiles = [];
    const validFiles = [];

    // Check each file for expiration
    for (const file of files) {
      const expiresAt = file.metadata?.expiresAt ? parseInt(file.metadata.expiresAt) : null;

      if (expiresAt && now > expiresAt) {
        expiredFiles.push(`uploads/${file.name}`);
      } else {
        validFiles.push({
          name: file.name,
          size: file.metadata?.size || 0,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null
        });
      }
    }

    // Delete expired files
    let deletedCount = 0;
    if (expiredFiles.length > 0) {
      const { error: deleteError } = await supabase.storage
        .from('files')
        .remove(expiredFiles);

      if (!deleteError) {
        deletedCount = expiredFiles.length;
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `Cleanup completed. Deleted ${deletedCount} expired files.`,
        deletedFiles: deletedCount,
        remainingFiles: validFiles.length,
        files: validFiles
      })
    };
  } catch (error) {
    console.error('Cleanup error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Cleanup failed: ' + error.message })
    };
  }
};