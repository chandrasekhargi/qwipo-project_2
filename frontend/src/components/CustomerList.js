import React, {useEffect, useState, useRef} from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

export default function CustomerList(){
  const [customers, setCustomers] = useState([]);
  const [q, setQ] = useState('');
  const [city, setCity] = useState('');
  const [stateV, setStateV] = useState('');
  const [pincode, setPincode] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef();

  const fetch = async (reset=false) => {
    setLoading(true);
    const res = await axios.get('http://localhost:5000/api/customers', { params: { q, city, state: stateV, pincode, page, limit } });
    setTotal(res.data.total || 0);
    if(reset) setCustomers(res.data.customers);
    else setCustomers(prev=>[...prev, ...res.data.customers]);
    setLoading(false);
  };

  useEffect(()=>{ // reset when filters change
    setPage(1);
    fetch(true);
  }, [q, city, stateV, pincode]);

  useEffect(()=>{ // fetch next page when page changes (but not first when filters cause reset which already fetched)
    if(page===1) return;
    fetch(false);
  }, [page]);

  // infinite scroll handler
  useEffect(()=>{
    const el = containerRef.current;
    if(!el) return;
    const onScroll = () => {
      if(loading) return;
      if(el.scrollTop + el.clientHeight >= el.scrollHeight - 10){
        if(customers.length < total) setPage(p=>p+1);
      }
    };
    el.addEventListener('scroll', onScroll);
    return ()=>el.removeEventListener('scroll', onScroll);
  }, [customers, total, loading]);

  const clearFilters = () => { setQ(''); setCity(''); setStateV(''); setPincode(''); setPage(1); setCustomers([]); }

  const remove = async (id) => {
    if(!window.confirm('Delete customer?')) return;
    await axios.delete(`http://localhost:5000/api/customers/${id}`);
    setCustomers([]);
    setPage(1);
    fetch(true);
  };

  return (
    <div>
      <div className="top-row">
        <h2>Customers</h2>
        <div>
          <input placeholder="search name, phone or email" value={q} onChange={e=>setQ(e.target.value)} />
        </div>
      </div>

      <div style={{marginTop:8, display:'flex', gap:8, flexWrap:'wrap',marginBottom:10}}>
        <input placeholder="City" value={city} onChange={e=>setCity(e.target.value)} className="small" />
        <input placeholder="State" value={stateV} onChange={e=>setStateV(e.target.value)} className="small" />
        <input placeholder="Pincode" value={pincode} onChange={e=>setPincode(e.target.value)} className="small" />
        <button className="btn" onClick={()=>{ setPage(1); setCustomers([]); fetch(true); }}>Apply</button>
        <button className="btn" onClick={clearFilters}>Clear</button>
      </div>

      <div className="list-container" ref={containerRef}>
        {customers.map(c=>(
          <div className="customer-card" key={c.id}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <div><strong>{c.firstName} {c.lastName}</strong> ({c.email})</div>
                <div>{c.phone} — {c.singleAddress ? 'Only One Address' : 'Multiple'}</div>
              </div>
              <div>
                <Link to={`/customer/${c.id}`} className="btn">View</Link>
                <Link to={`/edit/${c.id}`} className="btn" style={{marginLeft:8}}>Edit</Link>
                <button onClick={()=>remove(c.id)} className="btn" style={{marginLeft:8}}>Delete</button>
              </div>
            </div>
          </div>
        ))}
        {loading && <div style={{padding:8}}>Loading...</div>}
        {!loading && customers.length===0 && <div style={{padding:8}}>No customers</div>}
      </div>

      <div style={{marginTop:12, display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <div>Showing {customers.length} of {total}</div>
        <div>
          <button className="btn" onClick={()=>{ setCustomers([]); setPage(1); fetch(true); }}>Refresh</button>
        </div>
      </div>
    </div>
  );
}
