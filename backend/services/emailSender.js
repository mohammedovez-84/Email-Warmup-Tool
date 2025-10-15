// const nodemailer = require('nodemailer');

// /**
//  * Creates SMTP transporter using user credentials
//  */
// function createTransporter(account) {
//     return nodemailer.createTransport({
//         host: account.smtpHost,
//         port: account.smtpPort,
//         secure: account.smtpPort === 465, // true for 465, false for 587
//         auth: {
//             user: account.smtpUser,
//             pass: account.smtpPass
//         }
//     });
// }

// /**
//  * Sends a warmup email or reply
//  * @param {Object} senderAccount - contains SMTP credentials
//  * @param {Object} options - { to, subject, html, inReplyTo, references }
//  */
// async function sendEmail(senderAccount, { to, subject, html, inReplyTo = null, references = [] }) {
//     const transporter = createTransporter(senderAccount);

//     const mailOptions = {
//         from: `"${senderAccount.name}" <${senderAccount.smtpUser}>`,
//         to,
//         subject,
//         html,
//         headers: {}
//     };

//     // For reply emails
//     if (inReplyTo) {
//         mailOptions.inReplyTo = inReplyTo;
//         mailOptions.references = references;
//     }

//     try {
//         const info = await transporter.sendMail(mailOptions);
//         return {
//             success: true,
//             messageId: info.messageId,
//             to,
//             subject
//         };
//     } catch (error) {
//         return {
//             success: false,
//             error: error.message
//         };
//     }
// }
// module.exports = { sendEmail };




// const nodemailer = require('nodemailer');

// /**
//  * Creates SMTP transporter using user credentials or OAuth2 tokens for Microsoft
//  */
// function createTransporter(account) {
//   if (account.type === 'microsoft') {
//     // OAuth2 for Microsoft SMTP
//     return nodemailer.createTransport({
//       host: account.smtpHost || 'smtp.office365.com',
//       port: account.smtpPort || 587,
//       secure: false, // 587 uses STARTTLS
//       auth: {
//         type: 'OAuth2',
//         user: account.smtpUser,
//         accessToken: account.accessToken,
//         // refreshToken can be used outside to refresh accessToken if expired
//       },
//       tls: {
//         ciphers: 'TLSv1.2'
//       }
//     });
//   }

//   // fallback for google/custom
//   return nodemailer.createTransport({
//     host: account.smtpHost,
//     port: account.smtpPort,
//     secure: account.smtpPort === 465,
//     auth: {
//       user: account.smtpUser,
//       pass: account.smtpPass
//     }
//   });
// }

// /**
//  * Sends a warmup email or reply
//  * @param {Object} senderAccount - contains SMTP credentials or OAuth tokens
//  * @param {Object} options - { to, subject, html, inReplyTo, references }
//  */
// async function sendEmail(senderAccount, { to, subject, html, inReplyTo = null, references = [] }) {
//   const transporter = createTransporter(senderAccount);

//   const mailOptions = {
//     from: `"${senderAccount.name}" <${senderAccount.smtpUser}>`,
//     to,
//     subject,
//     html,
//     headers: {}
//   };

//   if (inReplyTo) {
//     mailOptions.inReplyTo = inReplyTo;
//     mailOptions.references = references;
//   }

//   try {
//     const info = await transporter.sendMail(mailOptions);
//     return {
//       success: true,
//       messageId: info.messageId,
//       to,
//       subject
//     };
//   } catch (error) {
//     return {
//       success: false,
//       error: error.message
//     };
//   }
// }

// module.exports = { sendEmail };




const nodemailer = require('nodemailer');

/**
* Creates SMTP transporter using user credentials or OAuth2 tokens for Microsoft
*/
function createTransporter(account) {
  if (account.type === 'microsoft') {
    // OAuth2 for Microsoft SMTP
    return nodemailer.createTransport({
      host: account.smtpHost || 'smtp.office365.com',
      port: account.smtpPort || 587,
      secure: false, // 587 uses STARTTLS
      auth: {
        type: 'OAuth2',
        user: account.smtpUser,
        accessToken: account.accessToken,
        // refreshToken can be used outside to refresh accessToken if expired
      },
      tls: {
        ciphers: 'TLSv1.2'
      }
    });
  }

  // fallback for google/custom
  return nodemailer.createTransport({
    host: account.smtpHost,
    port: account.smtpPort,
    secure: account.smtpPort === 465,
    auth: {
      user: account.smtpUser,
      pass: account.smtpPass
    }
  });
}

/**
* Sends a warmup email or reply
* @param {Object} senderAccount - contains SMTP credentials or OAuth tokens
* @param {Object} options - { to, subject, html, inReplyTo, references }
*/
async function sendEmail(senderAccount, { to, subject, html, inReplyTo = null, references = [] }) {
  const transporter = createTransporter(senderAccount);

  const mailOptions = {
    from: `"${senderAccount.name}" <${senderAccount.smtpUser}>`,
    to,
    subject,
    html,
    headers: {}
  };

  if (inReplyTo) {
    mailOptions.inReplyTo = inReplyTo;
    mailOptions.references = references;
  }

  try {
    const info = await transporter.sendMail(mailOptions);
    return {
      success: true,
      messageId: info.messageId,
      to,
      subject
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = { sendEmail };

