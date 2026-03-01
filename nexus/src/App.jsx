import { useState } from 'react';
function App() {
  const [active, setActive] = useState('Operations Fortress');
  return (
    <div style={{background:'#0A2540',color:'#E0F2FF',fontFamily:'Inter,sans-serif',height:'100vh',display:'flex',overflow:'hidden'}}>
      {/* LEFT NAV */}
      <nav style={{width:'280px',background:'#05121F',borderRight:'1px solid #00E6C3',padding:'20px'}}>
        <h1 style={{color:'#00E6C3',margin:0}}>ULU MALU NEXUS</h1>
        {['Operations Fortress','Sales Shield','Finance Vault','Client Vigilance'].map(w => 
          <button key={w} onClick={()=>setActive(w)} style={{width:'100%',padding:'14px',margin:'6px 0',background:active===w?'#00E6C3':'#0A2540',color:active===w?'#05121F':'white',border:'1px solid #00E6C3'}}>{w}</button>
        )}
      </nav>

      {/* MAIN CANVAS */}
      <main style={{flex:1,padding:'20px',display:'grid',gridTemplateColumns:'2fr 1fr',gap:'20px'}}>
        {/* META COMMANDER */}
        <div style={{background:'#05121F',border:'1px solid #00E6C3',padding:'20px',borderRadius:'8px'}}>
          <h2>META COMMANDER</h2>
          <div style={{background:'#0A2540',padding:'16px',borderRadius:'6px'}}>ULU Meta Commander online. Zero-trust verified.<br/>Ready for orders, Commander.</div>
        </div>

        {/* METRICS CARDS */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
          <div style={{background:'#05121F',padding:'16px',border:'1px solid #00E6C3',borderRadius:'8px',textAlign:'center'}}>
            <div style={{fontSize:'2rem',color:'#00E6C3'}}>18</div><div>ACTIVE CLIENTS</div>
          </div>
          <div style={{background:'#05121F',padding:'16px',border:'1px solid #00E6C3',borderRadius:'8px',textAlign:'center'}}>
            <div style={{fontSize:'2rem',color:'#00E6C3'}}>3</div><div>PENTESTS</div>
          </div>
          <div style={{background:'#05121F',padding:'16px',border:'1px solid #00E6C3',borderRadius:'8px',textAlign:'center'}}>
            <div style={{fontSize:'2rem',color:'#00E6C3'}}>7</div><div>THREATS</div>
          </div>
          <div style={{background:'#05121F',padding:'16px',border:'1px solid #00E6C3',borderRadius:'8px',textAlign:'center'}}>
            <div style={{fontSize:'2rem',color:'#00E6C3'}}>$84K</div><div>MRR</div>
          </div>
        </div>

        {/* CLIENT TABLE + QUICK ACTIONS */}
        <div style={{background:'#05121F',border:'1px solid #00E6C3',padding:'20px',borderRadius:'8px',gridColumn:'1/-1'}}>
          <h3>CLIENT SECURITY POSTURE</h3>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead><tr style={{textAlign:'left'}}><th>CLIENT</th><th>STATUS</th><th>RISK</th></tr></thead>
            <tbody>
              <tr><td>HEMIC Health</td><td>SECURE</td><td>LOW</td></tr>
              <tr><td>SentinelOne</td><td>WARNING</td><td>MED</td></tr>
            </tbody>
          </table>
        </div>

        {/* ACTION BAR */}
        <div style={{gridColumn:'1/-1',display:'flex',gap:'12px'}}>
          <button onClick={()=>alert('🚀 PentestForge launched — SOC2 locked')} style={{flex:1,padding:'16px',background:'#00E6C3',color:'#05121F',border:'none',fontWeight:'bold'}}>LAUNCH PENTEST</button>
          <button onClick={()=>alert('🔍 Scanning all clients...')} style={{flex:1,padding:'16px',background:'#0A2540',border:'1px solid #00E6C3',color:'white'}}>SCAN CLIENTS</button>
          <button onClick={()=>alert('🤖 Deploying AI Agent...')} style={{flex:1,padding:'16px',background:'#0A2540',border:'1px solid #00E6C3',color:'white'}}>DEPLOY AI AGENT</button>
        </div>
      </main>
    </div>
  );
}
export default App;
