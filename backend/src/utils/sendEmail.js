// backend/src/utils/sendEmail.js
const sgMail = require('@sendgrid/mail');

// Ensure API key is loaded from environment variables
if (!process.env.SENDGRID_API_KEY) {
    console.error('FATAL ERROR: SENDGRID_API_KEY is not defined in environment variables.');
    // Optionally exit process in production? process.exit(1);
} else {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    console.log('SendGrid API Key configured.'); // Confirmation log
}

/**
 * Sends an email using SendGrid.
 * @param {object} options - Email options.
 * @param {string} options.to - Recipient email address.
 * * @param {string} options.subject - Email subject line.
 * @param {string} options.text - Plain text content (optional).
 * @param {string} options.html - HTML content.
 */
const sendEmail = async (options) => {
    const msg = {
        to: options.to,
        from: {
             email: process.env.EMAIL_FROM,
             name: 'Tactical Guessing' // Optional: Sender name
        },
        subject: options.subject,
        text: options.text, // Optional fallback text content
        html: options.html, // Main HTML content
    };

    // Basic check before attempting send
    if (!process.env.SENDGRID_API_KEY || !process.env.EMAIL_FROM) {
         console.error('Email configuration missing (API Key or From Address). Email not sent.');
         // In a real app, you might want to throw an error or handle this more gracefully
         return; // Prevent sending if config is missing
    }
     if (!msg.to) {
          console.error('Email recipient ("to") is missing. Email not sent.');
          return;
     }

     console.log(`[sendEmail] Using EMAIL_FROM: ${process.env.EMAIL_FROM}`); // Log the value
     console.log(`[sendEmail] Sending message object:`, msg); // Log the full msg object


    try {
        console.log(`Attempting to send email to ${msg.to} with subject "${msg.subject}"`);
        await sgMail.send(msg);
        console.log('Email sent successfully.');
    } catch (error) {
        console.error('Error sending email:', error);
        if (error.response) {
            // Log detailed SendGrid API errors if available
            console.error('SendGrid Error Body:', error.response.body);
        }
        // Decide if you want to re-throw the error or just log it
        // throw new Error('Email could not be sent'); // Option: re-throw
    }
};

module.exports = sendEmail;