import React, {useEffect, useState} from 'react';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';

function validatePhone(phone){ return /^\d{10}$/.test(phone); }
function validatePincode(pin){ return pin === '' || /^\d{6}$/.test(pin); }
function validateEmail(email){ return email === '' || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email); }

export default function CustomerForm(){
  const [firstName, setFirst] = useState('');
  const [lastName, setLast] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [accountType, setAccountType] = useState('basic');
  const navigate = useNavigate();
  const { id } = useParams();

  useEffect(()=>{
    if(id){
      axios.get(`https://qwipo-server-2.onrender.com/api/customers/${id}`).then(r=>{
        const c = r.data.customer;
        setFirst(c.firstName || '');
        setLast(c.lastName || '');
        setPhone(c.phone || '');
        setEmail(c.email || '');
        setAccountType(c.accountType || 'basic');
      });
    }
  },[id]);

  const submit = async (e) => {
    e.preventDefault();
    if(!firstName || !lastName || !phone) return alert('Please fill mandatory fields');
    if(!validatePhone(phone)) return alert('Phone must be 10 digits');
    if(!validateEmail(email)) return alert('Invalid email');
    try{
      if(id){
        await axios.put(`https://qwipo-server-2.onrender.com/api/customers/${id}`, { firstName, lastName, phone, email, accountType });
        alert('Updated');
      } else {
        await axios.post('https://qwipo-server-2.onrender.com/api/customers', { firstName, lastName, phone, email, accountType });
        alert('Created');
      }
      navigate('/');
    }catch(err){
      console.error(err);
      alert(err.response?.data?.error || 'Error');
    }
  };

  return (
    <div>
      <h2>{id ? 'Edit' : 'Add'} Customer</h2>
      <form onSubmit={submit}>
        <div className="form-row">
          <input placeholder="First name *" value={firstName} onChange={e=>setFirst(e.target.value)} />
          <input placeholder="Last name *" value={lastName} onChange={e=>setLast(e.target.value)} />
          <input placeholder="Phone *" value={phone} onChange={e=>setPhone(e.target.value)} className="small" />
        </div>
        <div className="form-row">
          <input placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
          <select value={accountType} onChange={e=>setAccountType(e.target.value)}>
            <option value="basic">Basic</option>
            <option value="premium">Premium</option>
          </select>
        </div>
        <div style={{display:'flex', gap:8}}>
          <button className="btn primary" type="submit">Save</button>
          <button className="btn" type="button" onClick={()=>navigate('/')}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
