const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbFile = path.join(__dirname, 'data.sqlite');

const db = new sqlite3.Database(dbFile);

function runAsync(sql, params=[]){
  return new Promise((resolve,reject)=>{
    db.run(sql, params, function(err){
      if(err) return reject(err);
      resolve(this);
    });
  });
}

function getAsync(sql, params=[]){
  return new Promise((resolve,reject)=>{
    db.get(sql, params, (err,row)=>{
      if(err) return reject(err);
      resolve(row);
    });
  });
}

function allAsync(sql, params=[]){
  return new Promise((resolve,reject)=>{
    db.all(sql, params, (err,rows)=>{
      if(err) return reject(err);
      resolve(rows);
    });
  });
}

module.exports = {
  init(){
    db.serialize(()=>{
      db.run('PRAGMA foreign_keys = ON;');
      db.run(`CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        firstName TEXT NOT NULL,
        lastName TEXT NOT NULL,
        phone TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE,
        accountType TEXT DEFAULT 'basic'
      );`);
      db.run(`CREATE TABLE IF NOT EXISTS addresses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customerId INTEGER NOT NULL,
        line1 TEXT NOT NULL,
        city TEXT NOT NULL,
        state TEXT,
        pincode TEXT,
        FOREIGN KEY(customerId) REFERENCES customers(id) ON DELETE CASCADE
      );`);
      db.run(`CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customerId INTEGER,
        orderDate TEXT,
        amount REAL,
        status TEXT,
        FOREIGN KEY(customerId) REFERENCES customers(id) ON DELETE CASCADE
      );`);
      db.run(`CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customerId INTEGER,
        paymentDate TEXT,
        amount REAL,
        method TEXT,
        FOREIGN KEY(customerId) REFERENCES customers(id) ON DELETE CASCADE
      );`);
    });
  },

  // customers
  createCustomer(firstName,lastName,phone,email,accountType){
    return new Promise((resolve,reject)=>{
      const stmt = db.prepare('INSERT INTO customers (firstName,lastName,phone,email,accountType) VALUES (?,?,?,?,?)');
      stmt.run([firstName,lastName,phone,email,accountType], function(err){
        if(err) return reject(err);
        resolve(this.lastID);
      });
    });
  },

  getCustomerByPhone(phone){ return getAsync('SELECT * FROM customers WHERE phone = ?', [phone]); },
  getCustomerByEmail(email){ return getAsync('SELECT * FROM customers WHERE email = ?', [email]); },

  listCustomers({ page=1, limit=20, q, city, state, pincode, sortBy='c.id', order='asc' } = {}){
    return new Promise(async (resolve,reject)=>{
      try{
        const offset = (page-1)*limit;
        let base = 'FROM customers c LEFT JOIN addresses a ON a.customerId = c.id';
        const where = [];
        const params = [];
        if(q){ where.push('(c.firstName LIKE ? OR c.lastName LIKE ? OR c.phone LIKE ? OR c.email LIKE ?)'); params.push('%'+q+'%','%'+q+'%','%'+q+'%','%'+q+'%'); }
        if(city){ where.push('a.city = ?'); params.push(city); }
        if(state){ where.push('a.state = ?'); params.push(state); }
        if(pincode){ where.push('a.pincode = ?'); params.push(pincode); }
        const whereClause = where.length ? ' WHERE ' + where.join(' AND ') : '';
        const countSql = 'SELECT COUNT(DISTINCT c.id) as cnt ' + base + whereClause;
        const countRow = await getAsync(countSql, params);
        const total = countRow ? countRow.cnt : 0;
        const sql = 'SELECT DISTINCT c.id, c.firstName, c.lastName, c.phone, c.email ' + base + whereClause + ` ORDER BY c.id LIMIT ? OFFSET ?`;
        const rows = await allAsync(sql, params.concat([limit, offset]));
        // compute singleAddress flag for each quickly
        for(const r of rows){
          const add = await allAsync('SELECT id FROM addresses WHERE customerId = ?', [r.id]);
          r.singleAddress = add.length === 1;
        }
        resolve({ total, page, limit, customers: rows });
      }catch(err){ reject(err); }
    });
  },

  getCustomer(id){ return getAsync('SELECT * FROM customers WHERE id = ?', [id]); },

  updateCustomer(id, firstName, lastName, phone, email, accountType){
    return runAsync('UPDATE customers SET firstName=?, lastName=?, phone=?, email=?, accountType=? WHERE id=?', [firstName,lastName,phone,email,accountType,id]);
  },

  deleteCustomer(id){ return runAsync('DELETE FROM customers WHERE id = ?', [id]); },

  addAddress(customerId,line1,city,state,pincode){
    return new Promise((resolve,reject)=>{
      const stmt = db.prepare('INSERT INTO addresses (customerId,line1,city,state,pincode) VALUES (?,?,?,?,?)');
      stmt.run([customerId,line1,city,state,pincode], function(err){
        if(err) return reject(err);
        resolve(this.lastID);
      });
    });
  },

  getAddressesByCustomer(customerId){ return allAsync('SELECT * FROM addresses WHERE customerId = ?', [customerId]); },

  updateAddress(id,line1,city,state,pincode){ return runAsync('UPDATE addresses SET line1=?, city=?, state=?, pincode=? WHERE id=?', [line1,city,state,pincode,id]); },

  deleteAddress(id){ return runAsync('DELETE FROM addresses WHERE id = ?', [id]); },

  // orders/payments
  getOrdersByCustomer(customerId){ return allAsync('SELECT * FROM orders WHERE customerId = ? ORDER BY orderDate DESC LIMIT 50', [customerId]); },
  getPaymentsByCustomer(customerId){ return allAsync('SELECT * FROM payments WHERE customerId = ? ORDER BY paymentDate DESC LIMIT 50', [customerId]); },

  // seed demo
  seedDemo: async function(){
    // quick seed: clear tables and add sample customers/addresses/orders/payments
    await runAsync('DELETE FROM payments');
    await runAsync('DELETE FROM orders');
    await runAsync('DELETE FROM addresses');
    await runAsync('DELETE FROM customers');

    const cities = [['Hyderabad','Telangana'],['Mumbai','Maharashtra'],['Bangalore','Karnataka'],['Chennai','Tamil Nadu'],['Kolkata','West Bengal']];
    for(let i=1;i<=40;i++){
      const fn = 'First'+i;
      const ln = 'Last'+i;
      const phone = String(9000000000 + i).slice(0,10);
      const email = `user${i}@example.com`;
      const type = i%5===0 ? 'premium' : 'basic';
      const custId = await new Promise((resolve,reject)=>{
        const stmt = db.prepare('INSERT INTO customers (firstName,lastName,phone,email,accountType) VALUES (?,?,?,?,?)');
        stmt.run([fn,ln,phone,email,type], function(err){
          if(err) return reject(err);
          resolve(this.lastID);
        });
      });
      // addresses: 1 or multiple
      const city = cities[i%cities.length][0];
      const state = cities[i%cities.length][1];
      await new Promise((resolve,reject)=>{
        const stmt = db.prepare('INSERT INTO addresses (customerId,line1,city,state,pincode) VALUES (?,?,?,?)');
        stmt.run([custId,`Street ${i}`,city,state, String(500000 + i).slice(0,6)], function(err){
          if(err) return reject(err);
          resolve();
        });
      });
      if(i%4===0){
        // add second address sometimes
        await new Promise((resolve,reject)=>{
          const stmt = db.prepare('INSERT INTO addresses (customerId,line1,city,state,pincode) VALUES (?,?,?,?)');
          stmt.run([custId,`Alt Street ${i}`,city,state, String(600000 + i).slice(0,6)], function(err){
            if(err) return reject(err);
            resolve();
          });
        });
      }
      // orders & payments
      for(let o=0;o< (i%3); o++){
        await new Promise((resolve,reject)=>{
          const stmt = db.prepare('INSERT INTO orders (customerId,orderDate,amount,status) VALUES (?,?,?,?)');
          stmt.run([custId, new Date(Date.now() - o*86400000).toISOString(), (Math.random()*200).toFixed(2), o%2===0 ? 'delivered' : 'pending'], function(err){
            if(err) return reject(err);
            resolve();
          });
        });
      }
      for(let p=0;p< (i%2); p++){
        await new Promise((resolve,reject)=>{
          const stmt = db.prepare('INSERT INTO payments (customerId,paymentDate,amount,method) VALUES (?,?,?,?)');
          stmt.run([custId, new Date(Date.now() - p*86400000).toISOString(), (Math.random()*200).toFixed(2), p%2===0 ? 'card' : 'upi'], function(err){
            if(err) return reject(err);
            resolve();
          });
        });
      }
    }
  }
};
