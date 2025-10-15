// backend/models/HealthCheck.js
class HealthCheck {
    constructor() {
        this.status = "ok";
        this.timestamp = new Date();
    }
}

module.exports = HealthCheck;
