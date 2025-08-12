import React, { useState } from 'react';
import './LandingPage.css';

const LandingPage = () => {
  const [formData, setFormData] = useState({
    website: '',
    email: '',
    theme: 'clean-white',
    businessType: 'flower-shop'
  });
  const [status, setStatus] = useState('');

  const themes = [
    { id: 'clean-white', name: 'Clean White' },
    { id: 'dark-black', name: 'Dark Black' },
    { id: 'colorful', name: 'Colorful' }
  ];

  const businessTypes = [
    { id: 'flower-shop', name: 'Flower Shop' },
    { id: 'retail-store', name: 'Retail Store' },
    { id: 'healthcare', name: 'Healthcare' },
    { id: 'tech', name: 'Tech' },
    { id: 'pet-care', name: 'Pet Care' },
    { id: 'local-business', name: 'Local Business' },
    { id: 'blog', name: 'Blog' }
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/clone-website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      // Start polling for status updates
      startStatusPolling();
    } catch (error) {
      setStatus('Error: ' + error.message);
    }
  };

  return (
    <div className="landing-page">
      <h1>LAB007 AI Website Cloner</h1>
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Your Current Website:</label>
          <input 
            type="url" 
            required
            value={formData.website}
            onChange={(e) => setFormData({...formData, website: e.target.value})}
          />
        </div>

        <div className="form-group">
          <label>Your Email (Optional):</label>
          <input 
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({...formData, email: e.target.value})}
          />
        </div>

        <div className="form-group">
          <label>Preferred Style:</label>
          <select 
            value={formData.theme}
            onChange={(e) => setFormData({...formData, theme: e.target.value})}
          >
            {themes.map(theme => (
              <option key={theme.id} value={theme.id}>{theme.name}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Business Type:</label>
          <select 
            value={formData.businessType}
            onChange={(e) => setFormData({...formData, businessType: e.target.value})}
          >
            {businessTypes.map(type => (
              <option key={type.id} value={type.id}>{type.name}</option>
            ))}
          </select>
        </div>

        <button type="submit">Generate Website Designs</button>
      </form>

      {status && (
        <div className="status-box">
          <h2>Status:</h2>
          <p>{status}</p>
        </div>
      )}
    </div>
  );
};

export default LandingPage; 