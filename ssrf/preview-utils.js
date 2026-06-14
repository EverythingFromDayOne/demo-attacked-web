function extractMetaDescription(body) {
  const match1 = body.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
  if (match1) return match1[1];

  const match2 = body.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
  if (match2) return match2[1];

  return 'No description found';
}

function buildPreviewFromFetch(url, response, body) {
  const contentType = response.headers.get('content-type') || '';
  const trimmed = body.trim();
  const isJson =
    contentType.includes('application/json') ||
    trimmed.startsWith('{') ||
    trimmed.startsWith('[');

  if (isJson) {
    let formatted = body;
    try {
      formatted = JSON.stringify(JSON.parse(body), null, 2);
    } catch (err) {
      formatted = body;
    }

    return {
      success: true,
      title: url,
      description: formatted.slice(0, 500),
      rawJson: formatted,
      url: url,
      status: response.status,
      contentType: contentType || 'application/json',
    };
  }

  const titleMatch = body.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : url;

  return {
    success: true,
    title: title,
    description: extractMetaDescription(body),
    rawJson: null,
    url: url,
    status: response.status,
    contentType: contentType,
  };
}

function isUrlSafe(rawUrl) {
  let parsed;

  try {
    parsed = new URL(rawUrl);
  } catch (err) {
    return { safe: false, reason: 'Invalid URL format' };
  }

  // ✅ PROTECTED: Only allow http and https. Blocks file://, gopher://, dict://,
  //    ftp://, and other schemes that could be used for SSRF or local file read.
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { safe: false, reason: 'Scheme "' + parsed.protocol + '" not allowed — only http/https' };
  }

  const host = parsed.hostname.toLowerCase();

  // ✅ PROTECTED: Block loopback addresses (all representations of 127.0.0.1 / ::1)
  if (['localhost', '127.0.0.1', '::1', '0.0.0.0', '[::1]'].includes(host)) {
    return { safe: false, reason: 'Private/loopback address blocked' };
  }

  // ✅ PROTECTED: Block AWS EC2 instance metadata endpoint
  if (host === '169.254.169.254') {
    return { safe: false, reason: 'Cloud metadata endpoint blocked' };
  }

  // ✅ PROTECTED: Block GCP metadata endpoint
  if (host === 'metadata.google.internal') {
    return { safe: false, reason: 'Cloud metadata endpoint blocked' };
  }

  // ✅ PROTECTED: Block RFC-1918 private IP ranges
  const octets = host.split('.').map(Number);
  if (octets.length === 4 && octets.every(function (n) { return !isNaN(n); })) {
    if (octets[0] === 10) {
      return { safe: false, reason: 'Private IP range 10.0.0.0/8 blocked' };
    }
    if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) {
      return { safe: false, reason: 'Private IP range 172.16.0.0/12 blocked' };
    }
    if (octets[0] === 192 && octets[1] === 168) {
      return { safe: false, reason: 'Private IP range 192.168.0.0/16 blocked' };
    }
  }

  return { safe: true };
}

module.exports = {
  buildPreviewFromFetch: buildPreviewFromFetch,
  isUrlSafe: isUrlSafe,
};
