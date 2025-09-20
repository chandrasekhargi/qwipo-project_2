import React, {useEffect, useState} from 'react';
import axios from 'axios';
import { useParams, Link } from 'react-router-dom';

export default function CustomerDetails(){
  const { id } = useParams();
  const [customer, setCustomer] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [line1, setLine1] = useState('');
  const [city, setCity] = useState('');
  const [stateV, setStateV] = useState('');
  const [pincode, setPincode] = useState('');
  const [tab, setTab] = useState('addresses');
  const [orders, setOrders] = useState([]);
  const [payments, setPayments] = useState([]);

  const fetch = async () => {
    const res = await axios.get(`http://localhost:4000/api/customers/${id}`);
    setCustomer(res.data.customer);
    setAddresses(res.data.addresses || []);
    setCustomer(c=>({...c, singleAddress: (res.data.addresses || []).length===1}));
  };

  useEffect(()=>{ fetch(); fetchOrders(); fetchPayments(); }, [id]);

  const addAddress = async (e) => {
    e.preventDefault();
    if(!line1 || !city) return alert('Line1 and city required');
    await axios.post(`http://localhost:4000/api/customers/${id}/addresses`, { line1, city, state: stateV, pincode });
    setLine1(''); setCity(''); setStateV(''); setPincode('');
    fetch();
  };

  const removeAddr = async (aid) => {
    if(!window.confirm('Delete address?')) return;
    await axios.delete(`http://localhost:4000/api/addresses/${aid}`);
    fetch();
  };

  const fetchOrders = async () => {
    const res = await axios.get(`http://localhost:4000/api/customers/${id}/orders`);
    setOrders(res.data.orders || []);
  };

  const fetchPayments = async () => {
    const res = await axios.get(`http://localhost:4000/api/customers/${id}/payments`);
    setPayments(res.data.payments || []);
  };

  return (
    <div>
      <h2>Customer Details</h2>
      {!customer ? <div>Loading...</div> :
        <div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div>
              <div><strong>{customer.firstName} {customer.lastName}</strong></div>
              <div>{customer.email} — {customer.phone}</div>
              <div>{customer.singleAddress ? <span style={{color:'green'}}>Only One Address</span> : null}</div>
              <div>Account: {customer.accountType}</div>
            </div>
            <div>
              <Link to={`/edit/${customer.id}`} className="btn">Edit</Link>
              <Link to="/" className="btn" style={{marginLeft:8}}>Back</Link>
            </div>
          </div>

          <div className="tabs">
            <div className="tab" onClick={()=>setTab('addresses')}>Addresses</div>
            <div className="tab" onClick={()=>setTab('orders')}>Orders</div>
            <div className="tab" onClick={()=>setTab('payments')}>Payments</div>
          </div>

          {tab==='addresses' && <>
            <h3>Addresses</h3>
            {addresses.length === 0 && <div>No addresses yet</div>}
            {addresses.map(a=>(
              <div key={a.id} className="addr">
                <div>{a.line1}</div>
                <div>{a.city} {a.state} {a.pincode}</div>
                <div style={{marginTop:6}}>
                  <button className="btn" onClick={()=>removeAddr(a.id)}>Delete</button>
                </div>
              </div>
            ))}

            <h4>Add address</h4>
            <form onSubmit={addAddress}>
              <div className="form-row">
                <input placeholder="Address line1 *" value={line1} onChange={e=>setLine1(e.target.value)} />
                <input placeholder="City *" value={city} onChange={e=>setCity(e.target.value)} className="small" />
                <input placeholder="State" value={stateV} onChange={e=>setStateV(e.target.value)} className="small" />
                <input placeholder="Pincode" value={pincode} onChange={e=>setPincode(e.target.value)} className="small" />
              </div>
              <div style={{display:'flex', gap:8}}>
                <button className="btn primary" type="submit">Add Address</button>
              </div>
            </form>
          </>}

          {tab==='orders' && <>
            <h3>Orders (demo)</h3>
            {orders.length===0 && <div>No orders</div>}
            {orders.map(o=>(
              <div key={o.id} className="addr">
                <div>Order #{o.id} — {new Date(o.orderDate).toLocaleString()}</div>
                <div>Amount: {o.amount} — Status: {o.status}</div>
              </div>
            ))}
          </>}

          {tab==='payments' && <>
            <h3>Payments (demo)</h3>
            {payments.length===0 && <div>No payments</div>}
            {payments.map(p=>(
              <div key={p.id} className="addr">
                <div>Payment #{p.id} — {new Date(p.paymentDate).toLocaleString()}</div>
                <div>Amount: {p.amount} — Method: {p.method}</div>
              </div>
            ))}
          </>}
        </div>
      }
    </div>
  );
}
