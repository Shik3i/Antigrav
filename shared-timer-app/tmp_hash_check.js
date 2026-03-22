const bcrypt = require('bcrypt');

async function test() {
    const hash = '$2b$10$gNsSfnj/qPvCAU69toxPa.L/YMQ4ZQOyxpaXmkTivtCz4uppRU8YG';
    const isPasswordMatch = await bcrypt.compare('password', hash);
    const isAdminMatch = await bcrypt.compare('admin', hash);
    console.log({isPasswordMatch, isAdminMatch});
}
test();
