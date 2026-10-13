const User = require('../models/User');
const Dragon = require('../models/Dragon'); // Importing the Dragon model
const logger = require('../utils/logger');

async function increaseLavaJuice(userId, amount) {
  try {
    console.log("userId: ", userId)
    let user = await User.findOne({ _id: userId });
    console.log("user: ", user);

    user.lavaJuice += amount;
    await user.save();
    console.log("user after save: ", user);
    logger.info(`Increased lava juice for userId: ${userId} by ${amount}`);
    //const io = getIo(); // Using the getter function to obtain the io instance
    //io.emit('lavaJuiceUpdate', { userId, newBalance: userBalance.lavaJuice }); // Emitting event for real-time update
  } catch (error) {
    logger.error(`Error increasing lava juice for userId: ${userId}: ${error}`, error);
    throw error;
  }
}

module.exports = {
  increaseLavaJuice,
};