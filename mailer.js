const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

async function sendVerificationEmail(toEmail, code) {
    const mailOptions = {
        from: `"Phantoms Enterprises" <${process.env.EMAIL_USER}>`,
        to: toEmail,
        subject: 'Phantoms Enterprises - Verification Code',
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
                <h2 style="color: #007bff;">Phantoms Enterprises</h2>
                <p>Your verification code for account registration is:</p>
                <h1 style="background: #f4f4f9; display: inline-block; padding: 10px 20px; border-radius: 4px; letter-spacing: 2px;">${code}</h1>
                <p>This code will expire shortly. Do not share it with anyone.</p>
            </div>
        `
    };

    return transporter.sendMail(mailOptions);
}

module.exports = { sendVerificationEmail };
