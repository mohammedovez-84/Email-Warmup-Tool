const mongoose = require('mongoose');

const senderReceiverMetricsSchema = new mongoose.Schema({
    senderEmail: {
        type: String,
        required: true,
        index: true
    },
    receiverEmail: {
        type: String,
        required: true,
        index: true
    },
    totalSent: {
        type: Number,
        default: 0
    },
    totalReplied: {
        type: Number,
        default: 0
    },
    totalBounced: {
        type: Number,
        default: 0
    },
    totalOpened: {
        type: Number,
        default: 0
    },
    avgResponseTime: {
        type: Number,
        default: 0
    },
    lastInteraction: {
        type: Date,
        default: Date.now
    },
    warmupScore: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Compound index for unique sender-receiver pairs
senderReceiverMetricsSchema.index({ senderEmail: 1, receiverEmail: 1 }, { unique: true });

module.exports = mongoose.model('SenderReceiverMetrics', senderReceiverMetricsSchema);