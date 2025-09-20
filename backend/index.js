require('dotenv').config();
const express = require('express');
const passport = require('passport');
const session = require('express-session');
const cors = require('cors');
const morgan = require('morgan');
const fs = require('fs');
const path = require('path');
const { body, validationResult } = require('express-validator');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const dbModule = require('./db');

const app = express();

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Initialize DB
const dbPath = process.env.DATABASE_URL || path.join(__dirname, 'local.db');
dbModule.init(dbPath); // dbModule uses this internally

// Logging
const logStream = fs.createWriteStream(path.join(__dirname, 'errors.log'), { flags: 'a' });
const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Session for Passport
app.use(session({
  secret: process.env.SESSION_SECRET || 'mySuperSecret123!',
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

// Google OAuth
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL
}, (accessToken, refreshToken, profile, done) => {
  console.log('Google profile:', profile);
  return done(null, profile);
}));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// Routes
app.get('/', (req, res) => res.send('Backend server running!'));

// Google OAuth routes
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => res.send('Google login successful!')
);

// Customers
app.post('/api/customers', [
  body('firstName').notEmpty(),
  body('lastName').notEmpty(),
  body('phone').matches(/^\d{10}$/),
  body('email').optional().isEmail(),
  body('accountType').optional().isIn(['basic','premium'])
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if(!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { firstName, lastName, phone, email, accountType } = req.body;

  if(await dbModule.getCustomerByPhone(phone)) return res.status(409).json({ error: 'Phone already exists' });
  if(email && await dbModule.getCustomerByEmail(email)) return res.status(409).json({ error: 'Email already exists' });

  const id = await dbModule.createCustomer(firstName, lastName, phone, email, accountType || 'basic');
  res.status(201).json({ id, message: 'Customer created' });
}));

app.get('/api/customers', asyncHandler(async (req, res) => {
  const { page=1, limit=20, q, city, state, pincode, sortBy='id', order='asc' } = req.query;
  const result = await dbModule.listCustomers({ page: parseInt(page), limit: parseInt(limit), q, city, state, pincode, sortBy, order });
  res.json(result);
}));

app.get('/api/customers/:id', asyncHandler(async (req, res) => {
  const id = req.params.id;
  const customer = await dbModule.getCustomer(id);
  if(!customer) return res.status(404).json({ error: 'Not found' });
  const addresses = await dbModule.getAddressesByCustomer(id);
  customer.singleAddress = addresses.length === 1;
  res.json({ customer, addresses });
}));

app.put('/api/customers/:id', [
  body('firstName').notEmpty(),
  body('lastName').notEmpty(),
  body('phone').matches(/^\d{10}$/),
  body('email').optional().isEmail(),
  body('accountType').optional().isIn(['basic','premium'])
], asyncHandler(async (req,res)=>{
  const errors = validationResult(req);
  if(!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const id = req.params.id;
  const { firstName, lastName, phone, email, accountType } = req.body;

  const otherPhone = await dbModule.getCustomerByPhone(phone);
  if(otherPhone && otherPhone.id != id) return res.status(409).json({ error: 'Phone belongs to another customer' });

  if(email){
    const otherEmail = await dbModule.getCustomerByEmail(email);
    if(otherEmail && otherEmail.id != id) return res.status(409).json({ error: 'Email belongs to another customer' });
  }

  await dbModule.updateCustomer(id, firstName, lastName, phone, email, accountType || 'basic');
  res.json({ message: 'Updated' });
}));

app.delete('/api/customers/:id', asyncHandler(async (req,res)=>{
  const id = req.params.id;
  await dbModule.deleteCustomer(id);
  res.json({ message: 'Deleted' });
}));

// Addresses routes
app.post('/api/customers/:id/addresses', [
  body('line1').notEmpty(),
  body('city').notEmpty(),
  body('pincode').optional().matches(/^\d{6}$/)
], asyncHandler(async (req,res)=>{
  const errors = validationResult(req);
  if(!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const customerId = req.params.id;
  const { line1, city, state, pincode } = req.body;
  const addrId = await dbModule.addAddress(customerId, line1, city, state, pincode);
  res.status(201).json({ id: addrId });
}));

app.put('/api/addresses/:id', [
  body('line1').notEmpty(),
  body('city').notEmpty(),
  body('pincode').optional().matches(/^\d{6}$/)
], asyncHandler(async (req,res)=>{
  const id = req.params.id;
  const { line1, city, state, pincode } = req.body;
  await dbModule.updateAddress(id, line1, city, state, pincode);
  res.json({ message: 'Address updated' });
}));

app.delete('/api/addresses/:id', asyncHandler(async (req,res)=>{
  const id = req.params.id;
  await dbModule.deleteAddress(id);
  res.json({ message: 'Address deleted' });
}));

// Orders & Payments
app.get('/api/customers/:id/orders', asyncHandler(async (req,res)=>{
  const id = req.params.id;
  const orders = await dbModule.getOrdersByCustomer(id);
  res.json({ orders });
}));

app.get('/api/customers/:id/payments', asyncHandler(async (req,res)=>{
  const id = req.params.id;
  const payments = await dbModule.getPaymentsByCustomer(id);
  res.json({ payments });
}));

// Seed demo data
app.post('/api/seed', asyncHandler(async (req,res)=>{
  await dbModule.seedDemo();
  res.json({ message: 'Seeded demo data' });
}));

// Error handler
app.use((err, req, res, next) => {
  const msg = `[${new Date().toISOString()}] ${req.method} ${req.url} - ${err.stack}\n`;
  logStream.write(msg);
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, ()=>console.log(`Server running on port ${PORT}`));

module.exports = app;
