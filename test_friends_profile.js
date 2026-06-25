const friendsController = require('./controllers/friendsController');
const authController = require('./controllers/authController');

const testFriendsProfile = async () => {
    const userId = 'user_admin_koala';
    const currentUserId = '2ca1d6d3-7218-488f-9321-2f0f1531cca9';

    const req = {
        params: { userId },
        user: { userId: currentUserId, username: 'test', displayName: 'test' },
        app: { get: () => null }
    };

    const res = {
        status: (code) => {
            console.log('Response status:', code);
            return res;
        },
        json: (data) => {
            console.log('Response data:', data);
        }
    };

    try {
        await friendsController.getUserProfile(req, res, () => {});
    } catch (err) {
        console.error('Error:', err.message);
    }
};

testFriendsProfile();