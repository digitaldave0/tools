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
        body: JSON.stringify({ error: 'Failed to get storage stats' })
      };
    }

    // Calculate total size
    let totalSize = 0;
    let fileCount = 0;
    const now = Date.now();

    for (const file of files) {
      totalSize += file.metadata?.size || 0;
      fileCount++;

      // Check for expired files and count them
      const expiresAt = file.metadata?.expiresAt ? parseInt(file.metadata.expiresAt) : null;
      if (expiresAt && now > expiresAt) {
        // Could mark as expired, but for stats we just count total
      }
    }

    // Supabase free tier limit is 500MB per user
    const maxSize = 500 * 1024 * 1024; // 500MB in bytes
    const usedSize = totalSize;
    const remainingSize = Math.max(0, maxSize - usedSize);
    const usedPercentage = ((usedSize / maxSize) * 100).toFixed(1);

    return {
      statusCode: 200,
      body: JSON.stringify({
        totalSize: usedSize,
        maxSize: maxSize,
        remainingSize: remainingSize,
        usedPercentage: parseFloat(usedPercentage),
        fileCount: fileCount,
        formatted: {
          used: formatBytes(usedSize),
          max: formatBytes(maxSize),
          remaining: formatBytes(remainingSize)
        }
      })
    };
  } catch (error) {
    console.error('Storage stats error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to get storage stats: ' + error.message })
    };
  }
};

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}