async function sendVerificationEmail(toEmail, code) {
    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            from: 'onboarding@resend.dev',
            to: toEmail,
            subject: 'Your Verification Code - Phantoms Enterprises',
            html: `<div style="font-family: sans-serif; padding: 20px;">
                    <h2>Phantoms Enterprises</h2>
                    <p>Your 6-digit verification code is:</p>
                    <h1 style="color: #4F46E5; letter-spacing: 2px;">${code}</h1>
                   </div>`
        })
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || 'Failed to send email via Resend API');
    }

    return data;
}

module.exports = { sendVerificationEmail };
