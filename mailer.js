async function sendVerificationEmail(toEmail, code) {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
            'api-key': process.env.BREVO_API_KEY,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify({
            sender: { 
                name: 'Phantoms Enterprises', 
                email: 'phantomsenterprises@gmail.com' 
            },
            to: [{ email: toEmail }],
            subject: 'Your Verification Code - Phantoms Enterprises',
            htmlContent: `
                <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
                    <h2 style="color: #333;">Phantoms Enterprises</h2>
                    <p>Your 6-digit verification code is:</p>
                    <h1 style="color: #4F46E5; letter-spacing: 4px; font-size: 32px;">${code}</h1>
                    <p style="color: #666; font-size: 12px;">This code will expire shortly. Do not share it with anyone.</p>
                </div>`
        })
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || 'Failed to send email via Brevo');
    }

    return data;
}

module.exports = { sendVerificationEmail };
