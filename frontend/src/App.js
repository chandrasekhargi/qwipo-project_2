import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import CustomerList from './components/CustomerList';
import CustomerForm from './components/CustomerForm';
import CustomerDetails from './components/CustomerDetails';

export default function App(){
  return (
    <div className="container">
      <header>
        <h1>Qwipo Project</h1>
        <nav>
          <Link to="/">Customers</Link>
          <Link to="/add">Add</Link>
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<CustomerList />} />
          <Route path="/add" element={<CustomerForm />} />
          <Route path="/edit/:id" element={<CustomerForm />} />
          <Route path="/customer/:id" element={<CustomerDetails />} />
        </Routes>
      </main>
    </div>
  );
}
