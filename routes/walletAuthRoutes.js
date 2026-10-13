const express = require('express');
const router = express.Router();

// Middleware to check if user is already logged in
const redirectIfAuthenticated = (req, res, next) => {
    if (req.session.address) {
        return res.redirect('/');
    }
    next();
};

router.get('/auth/wallet', redirectIfAuthenticated, async (req, res) => {
    res.render('walletLogin', { title: 'Login with Ethereum Wallet' });
});

router.post('/auth/wallet', async (req, res) => {
    const { walletAddress } = req.body;
    // Authentication logic with wallet address
    req.session.address = walletAddress; // Store in session
    res.redirect('/');
});

module.exports = router;