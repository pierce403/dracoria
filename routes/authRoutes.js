const express = require('express');
const User = require('../models/User');
const Dragon = require('../models/Dragon');
const bcrypt = require('bcrypt');
const router = express.Router();

router.get('/auth/register', (req, res) => {
  res.render('register');
});

router.post('/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    const newUser = await User.create({ username, password });
    // Create a default dragon for the new user
    await Dragon.create({
      userId: newUser._id,
      name: 'Draco', // name the new dragon
      stage: 'egg',
      hunger: 0,
      happiness: 100
    });
    console.log(`New user registered and default dragon created for user ID: ${newUser._id}`);
    res.redirect('/auth/login');
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).send('Unable to register this account.');
  }
});

router.get('/auth/login', (req, res) => {
  res.render('login');
});

router.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).send('User not found');
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (isMatch) {
      await new Promise((resolve,reject)=>req.session.regenerate(error=>error?reject(error):resolve()));
      req.session.userId = user._id;
      // Check if the user has a dragon, if not, create a default one
      const dragonExists = await Dragon.findOne({ userId: user._id });
      if (!dragonExists) {
        await Dragon.create({
          userId: user._id,
          name: 'Draco', // 'Draco'
          stage: 'egg',
          hunger: 0,
          happiness: 100
        });
        console.log(`Default dragon created for user ID: ${user._id}`);
      }
      console.log(`User logged in with ID: ${user._id}`);
      return res.redirect('/');
    } else {
      return res.status(400).send('Password is incorrect');
    }
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).send('Unable to sign in.');
  }
});

router.get('/auth/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Error during session destruction:', err);
      return res.status(500).send('Error logging out');
    }
    console.log('User logged out successfully');
    res.redirect('/auth/login');
  });
});

// Route to display the settings form
router.get('/auth/settings', (req, res) => {
  if (!req.session.userId) {
    console.log('User not logged in, redirecting to login page');
    return res.redirect('/auth/login');
  }
  res.render('settings');
});

// Route to update the OpenAI API Key
router.post('/auth/settings', async (req, res) => {
  try {
    const { openAIKey } = req.body;
    const userId = req.session.userId;
    if (!userId) {
      console.log('User session not found, redirecting to login page');
      return res.redirect('/auth/login');
    }
    await User.findByIdAndUpdate(userId, { openAIKey });
    console.log(`OpenAI API key updated for user ID: ${userId}`);
    res.redirect('/dashboard'); // Redirect to dashboard page as per task description
  } catch (error) {
    console.error('Error updating OpenAI API key:', error.message, error.stack);
    res.status(500).send('Error saving settings');
  }
});

module.exports = router;
