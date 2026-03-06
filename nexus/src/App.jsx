import { useState } from 'react';
function App() {
  const [active, setActive] = useState('Operations Fortress');
  return (
    <div style={{background:'#060F1E',color:'#C8E0F4',fontFamily:'Inter,sans-serif',height:'100vh',display:'flex',overflow:'hidden'}}>
      <nav style={{width:'260px',background:'#0A1829',borderRight:'2px solid #00E6C3',padding:'28px 20px'}}>
        <div style={{color:'#00E6C3',fontSize:'22px',fontWeight:800,letterSpacing:'4px',marginBottom:'32px',textShadow:'0 0 20px #00E6C3'}}>ULU MALU NEXUS</div>
        {['Operations Fortress','Sales Shield','Finance Vault','Client Vigilance'].map(w => 
          <button key={w} onClick={()=>setActive(w)} style={{display:'block',width:'100%',padding:'16px',margin:'8px 0',background:active===w?'#00E6C3':'transparent',color:active===w?'#060F1E':'#C8E0F4',border:'1px solid #00E6C3',borderRadius:'6px',fontWeight:600,boxShadow:active===w?'0 0 20px #00E6C3':'none'}}>{w}</button>
        )}
      </nav>
      <main style={{flex:1,padding:'32px',display:'grid',gridTemplateColumns:'2fr 1fr',gap:'24px'}}>
        <div style={{background:'#0A1829',border:'2px solid #00E6C3',borderRadius:'12px',padding:'28px',boxShadow:'0 0 40px rgba(0,230,195,0.25)'}}>
          <div style={{color:'#00E6C3',fontSize:'18px',marginBottom:'12px'}}>META COMMANDER v3.0</div>
          <div style={{background:'#060F1E',padding:'20px',borderRadius:'8px',border:'1px solid #00E6C3',lineHeight:1.6}}>Zero-trust verified. Local agent online.<br/>I have full control of this machine. What are your orders, Commander?</div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:'16px'}}>
          <div style={{background:'#0A1829',border:'2px solid #00E6C3',borderRadius:'12px',padding:'24px',textAlign:'center',boxShadow:'0 0 30px rgba(0,230,195,0.2)'}}>
            <div style={{fontSize:'42px',color:'#00E6C3'}}>18</div><div style={{fontSize:'12px',color:'#5A9ABA'}}>ACTIVE CLIENTS</div>
          </div>
          <div style={{background:'#0A1829',border:'2px solid #00E6C3',borderRadius:'12px',padding:'24px',textAlign:'center',boxShadow:'0 0 30px rgba(0,230,195,0.2)'}}>
            <div style={{fontSize:'42px',color:'#00E6C3'}}>$84K</div><div style={{fontSize:'12px',color:'#5A9ABA'}}>MRR THIS MONTH</div>
          </div>
        </div>
        <div style={{gridColumn:'1/-1',background:'#0A1829',border:'2px solid #00E6C3',borderRadius:'12px',padding:'28px'}}>
          <div style={{color:'#00E6C3',fontSize:'15px',marginBottom:'16px'}}>CLIENT SECURITY POSTURE — LIVE</div>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead><tr style={{textAlign:'left',fontSize:'11px',color:'#5A9ABA'}}><th>CLIENT</th><th>STATUS</th><th>RISK</th></tr></thead>
            <tbody style={{color:'#C8E0F4'}}>
              <tr><td>HEMIC Health</td><td>SECURE</td><td>LOW</td></tr>
              <tr><td>SentinelOne</td><td>WARNING</td><td>MED</td></tr>
              <tr><td>KoreTech Labs</td><td>CRITICAL</td><td>HIGH</td></tr>
            </tbody>
          </table>
        </div>
        <div style={{gridColumn:'1/-1',display:'flex',gap:'16px'}}>
          <button onClick={()=>alert('🚀 PentestForge spinning up — SOC2 locked in')} style={{flex:1,padding:'22px',background:'#00E6C3',color:'#060F1E',border:'none',borderRadius:'8px',fontWeight:700,fontSize:'15px',boxShadow:'0 0 30px #00E6C3'}}>LAUNCH PENTEST</button>
          <button onClick={()=>alert('🔍 ThreatHorizon scanning all tenants...')} style={{flex:1,padding:'22px',background:'transparent',border:'2px solid #00E6C3',color:'#C8E0F4',borderRadius:'8px'}}>SCAN CLIENTS</button>
          <button onClick={()=>alert('🤖 AgenticServiceBuilder deploying local AI to tenant')} style={{flex:1,padding:'22px',background:'transparent',border:'2px solid #00E6C3',color:'#C8E0F4',borderRadius:'8px'}}>DEPLOY AI AGENT</button>
        </div>
      </main>
    </div>
  );
}
export default App;
