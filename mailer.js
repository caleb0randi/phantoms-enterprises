const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // Port 465 requires secure: true to bypass Render port blocks
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    tls: {
        rejectUnauthorized: false // Prevents certificate verification timeouts
    }
});

async function sendVerificationEmail(toEmail, code) {
    const mailOptions = {
        from: `"Phantoms Enterprises" <${process.env.EMAIL_USER}>`,
        to: toEmail,
        subject: 'Your Verification Code - Phantoms Enterprises',
        text: `Your verification code is: ${code}`,
        html: `<h3>Phantoms Enterprises Verification</h3><p>Your 6-digit code is: <b>${code}</b></p>`
    };

    return await transporter.sendMail(mailOptions);
}

module.exports = { sendVerificationEmail };
