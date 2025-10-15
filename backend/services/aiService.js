


const axios = require("axios");
const API_BASE = "http://localhost:8000/api"; // your FastAPI URL
async function generateEmail(senderName, receiverName, industry) {
    try {
        const res = await axios.post("http://localhost:8000/api/generate-email", {
            sender_name: senderName,
            receiver_name: receiverName,
            industry: industry
        }, {
            headers: { "Content-Type": "application/json" }
        });

        return res.data;
    } catch (err) {
        console.error("generateEmail error:", err.response?.data || err.message);
        return null;
    }
}

async function generateReply(emailId) {
    try {
        const res = await axios.post("http://localhost:8000/api/reply-email", {
            email_id: emailId
        }, {
            headers: { "Content-Type": "application/json" }
        });

        return res.data;
    } catch (err) {
        console.error("generateReply error:", err.response?.data || err.message);
        return null;
    }
}

module.exports = { generateEmail, generateReply };
