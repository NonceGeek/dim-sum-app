import * as React from 'react';

interface VerificationEmailProps {
  verificationCode: string;
  userName?: string;
}

export const VerificationEmail: React.FC<Readonly<VerificationEmailProps>> = ({
  verificationCode,
  userName = 'User',
}) => (
  <div style={{ fontFamily: 'Arial, sans-serif', maxWidth: '600px', margin: '0 auto' }}>
    <div style={{ backgroundColor: '#f8f9fa', padding: '20px', textAlign: 'center' }}>
      <h1 style={{ color: '#333', margin: '0' }}>DimSum App</h1>
    </div>
    
    <div style={{ padding: '40px 20px', backgroundColor: '#ffffff' }}>
      <h2 style={{ color: '#333', marginBottom: '20px' }}>Hello, {userName}!</h2>
      
      <p style={{ color: '#666', fontSize: '16px', lineHeight: '1.6', marginBottom: '30px' }}>
        Thank you for signing up with DimSum App. Please use the verification code below to complete your registration:
      </p>
      
      <div style={{ 
        backgroundColor: '#f8f9fa', 
        border: '2px solid #e9ecef', 
        borderRadius: '8px', 
        padding: '20px', 
        textAlign: 'center',
        marginBottom: '30px'
      }}>
        <div style={{ 
          fontSize: '32px', 
          fontWeight: 'bold', 
          color: '#007bff', 
          letterSpacing: '8px',
          fontFamily: 'monospace'
        }}>
          {verificationCode}
        </div>
      </div>
      
      <p style={{ color: '#666', fontSize: '14px', lineHeight: '1.6' }}>
        This code will expire in 10 minutes. If you didn't request this code, please ignore this email.
      </p>
      
      <p style={{ color: '#666', fontSize: '14px', lineHeight: '1.6', marginTop: '30px' }}>
        Best regards,<br />
        The DimSum App Team
      </p>
    </div>
    
    <div style={{ backgroundColor: '#f8f9fa', padding: '20px', textAlign: 'center', fontSize: '12px', color: '#666' }}>
      <p>This is an automated email. Please do not reply to this message.</p>
    </div>
  </div>
); 