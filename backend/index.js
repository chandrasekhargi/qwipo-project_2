require('dotenv').config();
const express = require('express');
const passport = require('passport')
const bodyParser = require('body-parser');
const cors = require('cors');
const morgan = require('morgan');
const fs = require('fs');
const path = require('path');
const { body, validationResult } = require('express-validator');
const dbModule = require('./db');


const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(morgan('dev'));
dbModule.init();

//AUTH Database setup

const dbPath = process.env.DATABASE_URL || path.join(__dirname, 'local.db');
const sqliteDb = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to database:', err.message);
  } else {
    console.log('Connected to SQLite database at', dbPath);
  }
});

//PASSPORT
app.use(express.urlencoded({ extended: true }));

// Session required for passport
app.use(session({
  secret: process.env.SESSION_SECRET|| 'mySuperSecret123!', //use process.env.SESSION_SECRET
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL
},
(accessToken, refreshToken, profile, done) => {
  // Here you can save/find user in your DB
  console.log('Google profile:', profile);
  return done(null, profile);
}));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

app.get('/', (req, res) => {
  res.send('Backend server running!');
});

// Google OAuth login
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

// Google OAuth callback
app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => {
    res.send('Google login successful!');
  }
);



const logStream = fs.createWriteStream(path.join(__dirname, 'errors.log'), { flags: 'a' });

const asyncHandler = fn => (req,res,next) => Promise.resolve(fn(req,res,next)).catch(next);

// Create customer with validation (email & accountType optional)
app.post('/api/customers', [
  body('firstName').notEmpty(),
  body('lastName').notEmpty(),
  body('phone').matches(/^\d{10}$/),
  body('email').optional().isEmail(),
  body('accountType').optional().isIn(['basic','premium'])
], asyncHandler(async (req, res) => {
  const errs = validationResult(req);
  if(!errs.isEmpty()) return res.status(400).json({ errors: errs.array() });
  const { firstName, lastName, phone, email, accountType } = req.body;
  if(await db.getCustomerByPhone(phone)) return res.status(409).json({ error: 'Phone already exists' });
  if(email && await db.getCustomerByEmail(email)) return res.status(409).json({ error: 'Email already exists' });
  const id = await db.createCustomer(firstName,lastName,phone,email,accountType || 'basic');
  res.status(201).json({ id, message: 'Customer created' });
}));

// List customers with filters, sorting, pagination (supports infinite-scroll)
app.get('/api/customers', asyncHandler(async (req, res) => {
  const { page=1, limit=20, q, city, state, pincode, sortBy='id', order='asc' } = req.query;
  const result = await db.listCustomers({ page: parseInt(page), limit: parseInt(limit), q, city, state, pincode, sortBy, order });
  res.json(result);
}));

app.get('/api/customers/:id', asyncHandler(async (req,res)=>{
  const id = req.params.id;
  const customer = await db.getCustomer(id);
  if(!customer) return res.status(404).json({ error: 'Not found' });
  const addresses = await db.getAddressesByCustomer(id);
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
  const errs = validationResult(req);
  if(!errs.isEmpty()) return res.status(400).json({ errors: errs.array() });
  const id = req.params.id;
  const { firstName, lastName, phone, email, accountType } = req.body;
  const otherPhone = await db.getCustomerByPhone(phone);
  if(otherPhone && otherPhone.id != id) return res.status(409).json({ error: 'Phone belongs to another customer' });
  if(email){
    const otherEmail = await db.getCustomerByEmail(email);
    if(otherEmail && otherEmail.id != id) return res.status(409).json({ error: 'Email belongs to another customer' });
  }
  await db.updateCustomer(id, firstName, lastName, phone, email, accountType || 'basic');
  res.json({ message: 'Updated' });
}));

app.delete('/api/customers/:id', asyncHandler(async (req,res)=>{
  const id = req.params.id;
  await db.deleteCustomer(id);
  res.json({ message: 'Deleted' });
}));

// Addresses
app.post('/api/customers/:id/addresses', [
  body('line1').notEmpty(),
  body('city').notEmpty(),
  body('pincode').optional().matches(/^\d{6}$/)
], asyncHandler(async (req,res)=>{
  const errs = validationResult(req);
  if(!errs.isEmpty()) return res.status(400).json({ errors: errs.array() });
  const customerId = req.params.id;
  const { line1, city, state, pincode } = req.body;
  const addrId = await db.addAddress(customerId,line1,city,state,pincode);
  res.status(201).json({ id: addrId });
}));

app.put('/api/addresses/:id', [
  body('line1').notEmpty(),
  body('city').notEmpty(),
  body('pincode').optional().matches(/^\d{6}$/)
], asyncHandler(async (req,res)=>{
  const id = req.params.id;
  const { line1, city, state, pincode } = req.body;
  await db.updateAddress(id,line1,city,state,pincode);
  res.json({ message: 'Address updated' });
}));

app.delete('/api/addresses/:id', asyncHandler(async (req,res)=>{
  const id = req.params.id;
  await db.deleteAddress(id);
  res.json({ message: 'Address deleted' });
}));

// Orders/payments endpoints
app.get('/api/customers/:id/orders', asyncHandler(async (req,res)=>{
  const id = req.params.id;
  const orders = await db.getOrdersByCustomer(id);
  res.json({ orders });
}));
app.get('/api/customers/:id/payments', asyncHandler(async (req,res)=>{
  const id = req.params.id;
  const payments = await db.getPaymentsByCustomer(id);
  res.json({ payments });
}));

// seed endpoint (safe for local demo) to populate demo data quickly
app.post('/api/seed', asyncHandler(async (req,res)=>{
  await db.seedDemo();
  res.json({ message: 'Seeded demo data' });
}));

// Error handler
app.use((err, req, res, next) => {
  const msg = `[${new Date().toISOString()}] ${req.method} ${req.url} - ${err.stack}\n`;
  logStream.write(msg);
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, ()=>console.log('Server running on', PORT));

module.exports = app;
