/**
 * Shared JWT secret — persistent across server restarts.
 * All modules that sign or verify JWTs import from here.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    const secretPath = path.join(__dirname, 'data', '.jwt_secret');
    if (fs.existsSync(secretPath)) {
        JWT_SECRET = fs.readFileSync(secretPath, 'utf8').trim();
    } else {
        JWT_SECRET = crypto.randomBytes(32).toString('hex');
        // Ensure data directory exists
        if (!fs.existsSync(path.join(__dirname, 'data'))) {
            fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
        }
        fs.writeFileSync(secretPath, JWT_SECRET, 'utf8');
        console.log('Generated new persistent JWT secret at data/.jwt_secret');
    }
}

module.exports = JWT_SECRET;
