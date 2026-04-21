const adminController = require('./adminController');
const roomController = require('./roomController');
const userController = require('./userController');
const externalController = require('./externalController');
const gameController = require('./gameController');

module.exports = {
    ...adminController,
    ...roomController,
    ...userController,
    ...externalController,
    ...gameController
};
