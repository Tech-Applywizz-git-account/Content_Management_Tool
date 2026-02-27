const https = require('https');

const data = JSON.stringify({
    current_stage: 'WRITER_VIDEO_APPROVAL',
    assigned_to_role: 'WRITER',
    status: 'WAITING_APPROVAL'
});

const options = {
    hostname: 'kifpnlyljlxppuzizmsf.supabase.co',
    path: '/rest/v1/projects?id=eq.efba9ad2-4602-428a-b661-1f8be312d51f',
    method: 'PATCH',
    headers: {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpZnBubHlsamx4cHB1eml6bXNmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDAzNTE5NSwiZXhwIjoyMDg1NjExMTk1fQ.dJv-w9RzsdnaS-Oy7yb6p7fDg_ln2DnGUI0zdikRRxM',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpZnBubHlsamx4cHB1eml6bXNmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDAzNTE5NSwiZXhwIjoyMDg1NjExMTk1fQ.dJv-w9RzsdnaS-Oy7yb6p7fDg_ln2DnGUI0zdikRRxM',
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

const req = https.request(options, (res) => {
    console.log(`Status: ${res.statusCode}`);
    res.on('data', (d) => {
        process.stdout.write(d);
    });
});

req.on('error', (e) => {
    console.error(e);
});

req.write(data);
req.end();
