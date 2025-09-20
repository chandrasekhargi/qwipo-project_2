const request = require('supertest');
const expect = require('chai').expect;
const appUrl = 'http://localhost:4000';

describe('Customers API - full flows', function(){
  it('should create, read, update and delete a customer', async function(){
    // create
    const create = await request(appUrl).post('/api/customers').send({
      firstName: 'Test',
      lastName: 'User',
      phone: '9123456789',
      email: 'testuser@example.com'
    });
    expect(create.status).to.equal(201);
    const id = create.body.id;
    // fetch
    const get = await request(appUrl).get(`/api/customers/${id}`);
    expect(get.status).to.equal(200);
    expect(get.body.customer.firstName).to.equal('Test');
    // update
    const upd = await request(appUrl).put(`/api/customers/${id}`).send({
      firstName:'Test2', lastName:'User2', phone: '9123456790'
    });
    expect(upd.status).to.equal(200);
    // delete
    const del = await request(appUrl).delete(`/api/customers/${id}`);
    expect(del.status).to.equal(200);
  });
});
