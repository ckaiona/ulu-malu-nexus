import { useState } from 'react'

export default function App() {
  const [active, setActive] = useState('ops')
  const navs = [['ops','Operations Fortress'],['sales','Sales Shield'],['finance','Finance Vault'],['client','Client Vigilance']]
  return (
    <div style={{display:'flex',height:'100vh',background:'#060F1E',color:'#C8E0F4',fontFamily:'monospace'}}>
      <div style={{width:200,background:'#080F1C',borderRight:'1px solid #1A3A5C',padding:16}}>
        <div style={{color:'#00E6C3',fontSize:16,fontWeight:700,marginBottom:20}}>◈ ULU MALU</div>
        {navs.map(([id,label]) => <div key={id} onClick={()=>setActive(id)} style={{padding:'10px 12px',marginBottom:4,cursor:'pointer',borderLeft:active===id?'2px solid #00E6C3':'2px solid transparent',color:active===id?'#00E6C3':'#3A6080'}}>{label}</div>)}
      </div>
      <div style={{flex:1,padding:20}}>
        <div style={{color:'#00E6C3',marginBottom:20}}>COMMAND NEXUS — ONLINE</div>
        <div style={{display:'flex',gap:12,marginBottom:20}}>
          {[['Clients','18'],['Pentests','3'],['Threats','7'],['MRR','$84K']].map(([l,v])=><div key={l} style={{flex:1,background:'#0D1F35',border:'1px solid #1A3A5C',borderRadius:8,padding:16}}><div style={{color:'#5A7FA0',fontSize:10}}>{l}</div><div style={{color:'#00E6C3',fontSize:24,fontWeight:700}}>{v}</div></div>)}
        </div>
        <div style={{background:'#0D1F35',border:'1px solid #1A3A5C',borderRadius:8,padding:16}}>Meta Commander online. Zero-trust verified.</div>
      </div>
      <div style={{width:160,background:'#080F1C',borderLeft:'1px solid #1A3A5C',padding:16}}>
        {['LAUNCH PENTEST','DEPLOY AGENT','THREAT SCAN'].map(a=><div key={a} style={{padding:'10px 12px',marginBottom:8,border:'1px solid #1A3A5C',borderRadius:6,cursor:'pointer',fontSize:10}}>{a}</div>)}
      </div>
    </div>
  )
}
