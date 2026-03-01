import { useState } from 'react';
import './App.css';
function App() {
  const [activeWorkspace, setActiveWorkspace] = useState('Operations Fortress');
  const workspaces = ['Operations Fortress','Sales Shield','Finance Vault','Client Vigilance'];
  return (
    <div className="cockpit">
      <nav className="nav">
        <h1>ULU MALU NEXUS</h1>
        {workspaces.map(w => <button key={w} className={activeWorkspace === w ? 'active' : ''} onClick={() => setActiveWorkspace(w)}>{w}</button>)}
      </nav>
      <main className="canvas">
        <div className="chat-panel"><h2>{activeWorkspace}</h2><div>Meta Commander online.</div></div>
        <div className="widgets"><div>PentestForge READY</div><div>Churn LOW</div></div>
      </main>
      <div className="action-bar"><button>LAUNCH PENTEST</button><button>SCAN CLIENTS</button></div>
    </div>
  );
}
export default App;
