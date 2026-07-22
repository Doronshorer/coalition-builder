const { useState, useMemo, useEffect } = React;

// ============================================
// HELPER FUNCTIONS
// ============================================

const parseTags = (str) => (str || '').split(',').map(s => s.trim().toLowerCase()).filter(s => s);

const renderLogo = (logoStr, classes = "w-6 h-6 inline-block") => {
  if (!logoStr) return '⬜';
  if (logoStr.startsWith('http') || logoStr.startsWith('data:image')) {
    return <img src={logoStr} alt="logo" className={`${classes} object-contain rounded`} />;
  }
  return <span className={classes}>{logoStr}</span>;
};

// ============================================
// COALITION COMPATIBILITY MATRIX
// ============================================

function CompatibilityMatrix({ parties, seatShares }) {
  const calculateConflicts = (party1, party2) => {
    const policies1 = parseTags(party1.corePolicies);
    const redLines2 = parseTags(party2.redLines);
    return policies1.filter(p => redLines2.includes(p)).length;
  };

  const pairs = [];
  for (let i = 0; i < seatShares.length; i++) {
    for (let j = i + 1; j < seatShares.length; j++) {
      const conflicts = calculateConflicts(seatShares[i], seatShares[j]) + calculateConflicts(seatShares[j], seatShares[i]);
      if (conflicts > 0) {
        pairs.push({
          party1: seatShares[i],
          party2: seatShares[j],
          conflicts: conflicts
        });
      }
    }
  }

  pairs.sort((a, b) => b.conflicts - a.conflicts);

  const getConflictLevel = (count) => {
    if (count >= 3) return { level: 'high', label: 'Critical' };
    if (count >= 2) return { level: 'medium', label: 'Significant' };
    return { level: 'low', label: 'Minor' };
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow border-t-4 border-amber-500 flex flex-col">
      <h3 className="text-xl font-bold mb-4 text-gray-700">Coalition Compatibility</h3>
      {pairs.length === 0 ? (
        <p className="text-gray-400 text-center py-4">No conflicts between selected parties</p>
      ) : (
        <div className="compatibility-grid">
          {pairs.map((pair, idx) => {
            const conflictInfo = getConflictLevel(pair.conflicts);
            return (
              <div key={idx} className="compatibility-row">
                <div className="party-pair-label">
                  {pair.party1.name} ↔ {pair.party2.name}
                </div>
                <div className={`conflict-indicator ${conflictInfo.level}`}>
                  <span className="text-sm">
                    {conflictInfo.label}: {pair.conflicts} {pair.conflicts === 1 ? 'issue' : 'issues'}
                  </span>
                  <span className="conflict-score ml-auto">⚠️</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================
// NEGOTIATION PHASE COMPONENT
// ============================================

function NegotiationPhase({ seatShares, coalition, coalitionMembers, handleDecision, decisions, db, selectedCountry, selectedScenario }) {
  const [currentConflictIdx, setCurrentConflictIdx] = useState(0);

  // Generate all conflicts needing negotiation
  const conflicts = [];
  for (let i = 0; i < coalitionMembers.length; i++) {
    for (let j = 0; j < coalitionMembers.length; j++) {
      if (i !== j) {
        const p1 = coalitionMembers[i];
        const p2 = coalitionMembers[j];
        const conflicts1 = parseTags(p1.corePolicies).filter(demand => parseTags(p2.redLines).includes(demand));
        conflicts1.forEach(conflict => {
          const conflictId = `${p1.id}-${p2.id}-${conflict}`;
          if (!conflicts.find(c => c.id === conflictId)) {
            conflicts.push({
              id: conflictId,
              party1Id: p1.id,
              party2Id: p2.id,
              party1Name: p1.name,
              party2Name: p2.name,
              policy: conflict,
              party1Logo: p1.logo,
              party2Logo: p2.logo,
              party1Color: p1.color,
              party2Color: p2.color
            });
          }
        });
      }
    }
  }

  if (conflicts.length === 0) {
    return (
      <div className="max-w-3xl mx-auto p-6 py-12 text-center">
        <h2 className="text-4xl font-bold mb-4">Government Formation Consensus</h2>
        <div className="bg-green-50 p-8 rounded-2xl border-2 border-green-500 shadow-lg">
          <p className="text-2xl font-bold text-green-700 mb-2">✓ No conflicts detected!</p>
          <p className="text-gray-600 mb-6">All coalition parties align on policy positions.</p>
          <button onClick={() => handleDecision(null, 'skip')} className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-full shadow-lg transition-transform hover:scale-105">
            Proceed to Final Summary ➔
          </button>
        </div>
      </div>
    );
  }

  const currentConflict = conflicts[currentConflictIdx];
  const isLastConflict = currentConflictIdx === conflicts.length - 1;
  const progressPercent = ((currentConflictIdx + 1) / conflicts.length) * 100;

  const decisionOptions = [
    {
      id: 'support',
      title: `Include "${currentConflict.policy}"`,
      effect: `${currentConflict.party1Name}'s core demand is accepted into the government platform. ${currentConflict.party2Name} must compromise.`,
      outcome: `${currentConflict.policy} included`
    },
    {
      id: 'drop',
      title: `Exclude "${currentConflict.policy}"`,
      effect: `The policy is dropped from the government platform. ${currentConflict.party1Name} accepts the exclusion.`,
      outcome: `${currentConflict.policy} excluded`
    },
    {
      id: 'compromise',
      title: 'Modified/Compromise Version',
      effect: `A compromise version of "${currentConflict.policy}" is negotiated that both parties can accept.`,
      outcome: `Compromise on ${currentConflict.policy}`
    }
  ];

  return (
    <div className="max-w-4xl mx-auto p-6 py-12">
      <h2 className="text-3xl font-bold mb-2">Coalition Negotiation: Policy Disputes</h2>
      <p className="text-gray-600 mb-6">Resolve disagreements between coalition partners:</p>

      <div className="negotiation-progress">
        <span>Conflict {currentConflictIdx + 1} of {conflicts.length}</span>
        <div className="progress-bar flex-1 mx-4">
          <div className="progress-fill" style={{ width: `${progressPercent}%` }}></div>
        </div>
        <span className="text-blue-600">{Math.round(progressPercent)}%</span>
      </div>

      <div className="negotiation-conflict-card">
        <div className="conflict-header">
          <div className="party-badge" style={{ color: currentConflict.party1Color }}>
            {renderLogo(currentConflict.party1Logo, "text-2xl")}
          </div>
          <div className="flex-1">
            <div className="font-bold text-lg text-gray-800">{currentConflict.party1Name} vs {currentConflict.party2Name}</div>
            <div className="text-sm text-gray-500">Disagreement over policy: <span className="font-semibold text-amber-600">"{currentConflict.policy}"</span></div>
          </div>
          <div className="party-badge" style={{ color: currentConflict.party2Color }}>
            {renderLogo(currentConflict.party2Logo, "text-2xl")}
          </div>
        </div>

        <div className="conflict-description">
          {currentConflict.party1Name} demands the policy <strong>"{currentConflict.policy}"</strong> be included in the government platform, but this violates {currentConflict.party2Name}'s red lines. How should the coalition resolve this?
        </div>

        <div className="decision-options">
          {decisionOptions.map(option => (
            <div
              key={option.id}
              className={`decision-option ${decisions[currentConflict.id] === option.id ? 'selected' : ''}`}
              onClick={() => handleDecision(currentConflict, option.id)}
            >
              <div className="decision-radio"></div>
              <div className="decision-text">
                <div className="decision-title">{option.title}</div>
                <div className="decision-effect">{option.effect}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-between items-center mt-8">
        <button
          onClick={() => setCurrentConflictIdx(prev => Math.max(0, prev - 1))}
          disabled={currentConflictIdx === 0}
          className="bg-gray-400 hover:bg-gray-500 disabled:opacity-50 text-white font-bold py-2 px-6 rounded transition-colors"
        >
          ← Previous
        </button>

        {!isLastConflict ? (
          <button
            onClick={() => setCurrentConflictIdx(prev => Math.min(conflicts.length - 1, prev + 1))}
            disabled={!decisions[currentConflict.id]}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-2 px-6 rounded transition-colors"
          >
            Next Issue →
          </button>
        ) : (
          <button
            onClick={() => handleDecision(null, 'complete')}
            disabled={!decisions[currentConflict.id]}
            className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold py-3 px-8 rounded shadow-lg transition-transform hover:scale-105"
          >
            Finalize Government ✓
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================
// DEV DASHBOARD COMPONENT
// ============================================

function DevDashboard({ db, setDb, setScreen }) {
  const [activeC, setActiveC] = useState(Object.keys(db)[0] || '');
  const [activeS, setActiveS] = useState(activeC ? Object.keys(db[activeC])[0] || '' : '');
  const [newCountry, setNewCountry] = useState('');
  const [newScenario, setNewScenario] = useState('');
  const [showExport, setShowExport] = useState(false);

  useEffect(() => {
    if (activeC && db[activeC] && !db[activeC][activeS]) {
      setActiveS(Object.keys(db[activeC])[0] || '');
    }
  }, [activeC, db, activeS]);

  const updateDb = (newDb) => {
    setDb(newDb);
    localStorage.setItem('coalitionDb', JSON.stringify(newDb));
  };

  const updateParty = (partyId, field, val) => {
    const newDb = { ...db };
    const idx = newDb[activeC][activeS].parties.findIndex(p => p.id === partyId);
    if (idx > -1) {
      newDb[activeC][activeS].parties[idx][field] = val;
      updateDb(newDb);
    }
  };

  const addParty = () => {
    const newDb = { ...db };
    const parties = newDb[activeC][activeS].parties;
    const newId = parties.length ? Math.max(...parties.map(p => p.id)) + 1 : 1;
    parties.push({ id: newId, name: 'New Party', color: '#555555', logo: '⬜', corePolicies: '', redLines: '', poll: 0, votes: 0 });
    updateDb(newDb);
  };

  const removeParty = (partyId) => {
    const newDb = { ...db };
    newDb[activeC][activeS].parties = newDb[activeC][activeS].parties.filter(p => p.id !== partyId);
    updateDb(newDb);
  };

  const updateRules = (field, val) => {
    const newDb = { ...db };
    newDb[activeC][activeS][field] = Number(val);
    updateDb(newDb);
  };

  const handleAddCountry = () => {
    if (!newCountry) return;
    const newDb = { ...db, [newCountry]: { "2026 Snapshot": { seats: 100, threshold: 5, parties: [] } } };
    updateDb(newDb);
    setActiveC(newCountry);
    setActiveS("2026 Snapshot");
    setNewCountry('');
  };

  const handleAddScenario = () => {
    if (!newScenario || !activeC) return;
    const newDb = { ...db };
    newDb[activeC][newScenario] = { seats: 100, threshold: 5, parties: [] };
    updateDb(newDb);
    setActiveS(newScenario);
    setNewScenario('');
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 flex flex-col font-sans">
      <div className="bg-slate-950 p-4 flex justify-between items-center border-b border-slate-800">
        <h2 className="text-2xl font-bold text-white flex items-center"><span className="mr-3">⚙️</span> Visual Database Editor</h2>
        <div className="flex gap-4">
          <button onClick={() => setShowExport(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 rounded font-bold">📤 Export to Live Game</button>
          <button onClick={() => setScreen('HOME')} className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded font-bold">Exit to Game</button>
        </div>
      </div>

      {showExport && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-6">
          <div className="bg-slate-800 p-6 rounded-xl max-w-3xl w-full border border-slate-600 shadow-2xl">
            <h3 className="text-2xl font-bold text-white mb-2">How to push updates to the live website:</h3>
            <p className="text-slate-400 mb-4 text-sm leading-relaxed">
              Click inside the box below, press <strong>Ctrl+A</strong> to select all, and copy it. Then, paste it over the <code>INITIAL_DB</code> section at the top of your <code>index.html</code> file and redeploy.
            </p>
            <textarea readOnly value={`const INITIAL_DB = ${JSON.stringify(db, null, 2)};`} className="w-full h-80 bg-slate-950 text-emerald-400 p-4 font-mono text-xs rounded border border-slate-700 outline-none mb-4 selection:bg-emerald-900"></textarea>
            <div className="flex justify-end">
              <button onClick={() => setShowExport(false)} className="bg-slate-600 hover:bg-slate-500 px-6 py-2 rounded font-bold text-white">Close Window</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <div className="w-72 bg-slate-800 border-r border-slate-700 flex flex-col">
          <div className="p-4 overflow-y-auto flex-1">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Countries & Scenarios</h3>
            {Object.keys(db).map(country => (
              <div key={country} className="mb-6">
                <button onClick={() => { setActiveC(country); setActiveS(Object.keys(db[country])[0] || ''); }} className={`font-bold text-lg flex items-center w-full text-left mb-2 ${activeC === country ? 'text-blue-400' : 'text-slate-300 hover:text-white'}`}>
                  {activeC === country ? '📂' : '📁'} <span className="ml-2">{country}</span>
                </button>
                {activeC === country && (
                  <div className="pl-6 space-y-1 border-l-2 border-slate-700 ml-2">
                    {Object.keys(db[country]).map(scenario => (
                      <button key={scenario} onClick={() => setActiveS(scenario)} className={`block w-full text-left px-2 py-1 text-sm rounded ${activeS === scenario ? 'bg-blue-600 text-white font-semibold' : 'text-slate-400 hover:bg-slate-700'}`}>
                        {scenario}
                      </button>
                    ))}
                    <div className="px-2 py-2 flex">
                      <input type="text" value={newScenario} onChange={(e) => setNewScenario(e.target.value)} placeholder="New Scenario..." className="w-full bg-slate-900 text-xs px-2 py-1 rounded-l border border-slate-700 outline-none"/>
                      <button onClick={handleAddScenario} className="bg-slate-700 px-2 rounded-r text-xs font-bold hover:bg-slate-600">+</button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            <div className="mt-8 border-t border-slate-700 pt-4">
              <label className="text-xs font-bold text-slate-500 uppercase">Add New Country</label>
              <div className="flex mt-2">
                <input type="text" value={newCountry} onChange={(e) => setNewCountry(e.target.value)} placeholder="e.g. UK" className="w-full bg-slate-900 text-sm px-2 py-2 rounded-l border border-slate-700 outline-none"/>
                <button onClick={handleAddCountry} className="bg-slate-700 px-3 rounded-r text-sm font-bold hover:bg-blue-600">+</button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 p-8 overflow-y-auto bg-slate-900">
          {activeC && activeS && db[activeC][activeS] ? (
            <div className="max-w-5xl mx-auto">
              <div className="flex justify-between items-end mb-8 border-b border-slate-700 pb-4">
                <div>
                  <h4 className="text-blue-400 font-bold mb-1">{activeC}</h4>
                  <h2 className="text-3xl font-bold text-white">{activeS}</h2>
                </div>
                <div className="flex gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Total Seats</label>
                    <input type="number" value={db[activeC][activeS].seats} onChange={(e) => updateRules('seats', e.target.value)} className="bg-slate-800 text-white p-2 rounded border border-slate-600 w-24 text-center font-mono"/>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Threshold %</label>
                    <input type="number" step="0.1" value={db[activeC][activeS].threshold} onChange={(e) => updateRules('threshold', e.target.value)} className="bg-slate-800 text-white p-2 rounded border border-slate-600 w-24 text-center font-mono"/>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {db[activeC][activeS].parties.map((party) => (
                  <div key={party.id} className="bg-slate-800 p-4 rounded-lg border-l-4 shadow-lg flex flex-col gap-3 relative" style={{ borderColor: party.color }}>
                    <button onClick={() => removeParty(party.id)} className="absolute top-2 right-2 text-slate-500 hover:text-red-500 bg-slate-900 rounded-full w-6 h-6 flex items-center justify-center text-xs">✕</button>

                    <div className="grid grid-cols-12 gap-4 items-center">
                      <div className="col-span-1 flex flex-col items-center">
                        <label className="text-[10px] font-bold text-slate-500 uppercase mb-1">Logo URL/Emoji</label>
                        <div className="flex items-center justify-center w-12 h-12 bg-slate-900 rounded overflow-hidden p-1 border border-slate-700 shadow-inner mb-1">
                          {renderLogo(party.logo, "max-w-full max-h-full text-2xl")}
                        </div>
                        <input type="text" value={party.logo} onChange={(e) => updateParty(party.id, 'logo', e.target.value)} className="w-full text-[10px] bg-slate-900 border border-slate-700 p-1 text-center text-slate-300 rounded"/>
                      </div>

                      <div className="col-span-3">
                        <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Party Name</label>
                        <input type="text" value={party.name} onChange={(e) => updateParty(party.id, 'name', e.target.value)} className="w-full bg-slate-900 text-white font-bold p-2 rounded border border-slate-700 focus:border-blue-500 outline-none"/>
                      </div>

                      <div className="col-span-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Color</label>
                        <input type="color" value={party.color} onChange={(e) => updateParty(party.id, 'color', e.target.value)} className="w-full h-10 border-0 rounded cursor-pointer bg-slate-900 p-0.5"/>
                      </div>

                      <div className="col-span-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Poll/Votes Base %</label>
                        <input type="number" step="0.1" value={party.poll} onChange={(e) => { updateParty(party.id, 'poll', Number(e.target.value)); updateParty(party.id, 'votes', Number(e.target.value)); }} className="w-full bg-slate-900 text-emerald-400 font-mono p-2 rounded border border-slate-700 text-center outline-none"/>
                      </div>

                      <div className="col-span-5 flex flex-col gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase block">Core Policies (Comma separated)</label>
                          <input type="text" value={party.corePolicies} placeholder="e.g. Welfare, Free Trade" onChange={(e) => updateParty(party.id, 'corePolicies', e.target.value)} className="w-full bg-slate-900 text-slate-300 text-xs p-2 rounded border border-slate-700 outline-none"/>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-rose-500 uppercase block">Red Lines (Must match policies)</label>
                          <input type="text" value={party.redLines} placeholder="e.g. Wealth Tax" onChange={(e) => updateParty(party.id, 'redLines', e.target.value)} className="w-full bg-rose-950/30 text-rose-300 text-xs p-2 rounded border border-rose-900/50 outline-none"/>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                <button onClick={addParty} className="w-full py-4 border-2 border-dashed border-slate-700 text-slate-400 font-bold rounded-lg hover:border-blue-500 hover:text-blue-500 transition-colors">
                  + Add Party to {activeS}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-slate-600 font-bold text-xl">Select a Scenario on the left to edit</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// MAIN APP COMPONENT
// ============================================

function App() {
  const [screen, setScreen] = useState('HOME');

  const [db, setDb] = useState(window.INITIAL_DB || {});
  useEffect(() => {
    const saved = localStorage.getItem('coalitionDb');
    if (saved) setDb(JSON.parse(saved));
  }, []);

  // Game State
  const [selectedCountry, setSelectedCountry] = useState('Israel');
  const [selectedScenario, setSelectedScenario] = useState('');
  const [threshold, setThreshold] = useState(3.25);
  const [totalSeats, setTotalSeats] = useState(120);
  const [coalition, setCoalition] = useState([]);
  const [displayMode, setDisplayMode] = useState('seats');
  const [parties, setParties] = useState([]);
  const [devPassword, setDevPassword] = useState('');
  const [decisions, setDecisions] = useState({});

  const resetGame = () => { setCoalition([]); setScreen('HOME'); setDecisions({}); };

  // Math Engine
  const validParties = parties.filter(p => p.votes >= threshold);
  const totalValidVotes = validParties.reduce((sum, p) => sum + p.votes, 0);
  const majorityTarget = Math.floor(totalSeats / 2) + 1;

  const seatShares = useMemo(() => {
    if (totalValidVotes === 0) return [];
    let mapped = validParties.map(p => {
      const exactSeats = (p.votes / totalValidVotes) * totalSeats;
      return { ...p, seatPercentage: (p.votes / totalValidVotes) * 100, floor: Math.floor(exactSeats), remainder: exactSeats - Math.floor(exactSeats) };
    });
    let allocatedSeats = mapped.reduce((sum, p) => sum + p.floor, 0);
    let remainingSeats = totalSeats - allocatedSeats;
    mapped.sort((a, b) => b.remainder - a.remainder);
    for (let i = 0; i < remainingSeats; i++) mapped[i].floor += 1;
    return mapped.sort((a, b) => a.id - b.id).map(p => ({ ...p, seats: p.floor }));
  }, [parties, threshold, totalSeats, totalValidVotes]);

  const totalRawVotes = parties.reduce((sum, p) => sum + (Number(p.votes) || 0), 0);
  const coalitionSeats = coalition.reduce((sum, id) => {
    const party = seatShares.find(p => p.id === id);
    return sum + (party ? party.seats : 0);
  }, 0);
  const coalitionPercentage = totalSeats > 0 ? (coalitionSeats / totalSeats) * 100 : 0;
  const isMajority = coalitionSeats >= majorityTarget;

  // Conflicts
  const conflicts = [];
  const coalitionMembers = seatShares.filter(p => coalition.includes(p.id));
  for (let i = 0; i < coalitionMembers.length; i++) {
    for (let j = 0; j < coalitionMembers.length; j++) {
      if (i !== j) {
        const p1 = coalitionMembers[i];
        const p2 = coalitionMembers[j];
        const overlaps = parseTags(p1.corePolicies).filter(demand => parseTags(p2.redLines).includes(demand));
        overlaps.forEach(conflict => {
          const msg = `Conflict: ${p1.name} demands "${conflict}", violating ${p2.name}'s red lines.`;
          if (!conflicts.includes(msg)) conflicts.push(msg);
        });
      }
    }
  }

  const handleNegotiationDecision = (conflict, decision) => {
    if (decision === 'complete') {
      setScreen('SUMMARY');
    } else if (decision === 'skip') {
      setScreen('SUMMARY');
    } else if (conflict) {
      setDecisions({ ...decisions, [conflict.id]: decision });
    }
  };

  // --- SCREEN ROUTING ---
  if (screen === 'HOME') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center p-6 bg-gradient-to-br from-slate-100 to-slate-200 relative">
        <button onClick={() => setScreen('DEV_LOGIN')} className="absolute top-6 right-6 text-2xl opacity-40 hover:opacity-100 transition-opacity" title="Dev Dashboard">⚙️</button>
        <h1 className="text-6xl font-bold mb-4 text-slate-900 tracking-tight">Coalition Builder</h1>
        <p className="text-xl text-slate-600 mb-10 max-w-2xl">Select a political landscape, adjust polling data, test electoral thresholds, and negotiate a governing majority.</p>
        <button onClick={() => {
          if (db['Israel'] && db['Israel']['2026 Polling Snapshot']) {
            const data = db['Israel']['2026 Polling Snapshot'];
            setSelectedCountry('Israel');
            setSelectedScenario('2026 Polling Snapshot');
            setTotalSeats(data.seats);
            setThreshold(data.threshold);
            setParties(JSON.parse(JSON.stringify(data.parties)));
          }
          setScreen('SETTINGS');
        }} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-12 rounded-full shadow-xl transition-transform transform hover:scale-105 text-xl border-4 border-white">
          Enter Parliament
        </button>
      </div>
    );
  }

  if (screen === 'DEV_LOGIN') {
    const checkPassword = () => {
      if (devPassword === 'TessaEars') { setScreen('DEV_DASH'); setDevPassword(''); }
      else { alert('Incorrect password'); }
    };
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white">
        <div className="bg-slate-800 p-8 rounded-xl shadow-2xl w-full max-w-md text-center">
          <h2 className="text-2xl font-bold mb-6">Developer Access</h2>
          <input type="password" value={devPassword} onChange={(e) => setDevPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && checkPassword()} placeholder="Password" className="w-full p-3 mb-4 rounded text-slate-900 font-mono outline-none"/>
          <div className="flex gap-4">
            <button onClick={() => setScreen('HOME')} className="w-1/2 p-3 bg-slate-700 rounded hover:bg-slate-600 font-bold">Cancel</button>
            <button onClick={checkPassword} className="w-1/2 p-3 bg-blue-600 rounded hover:bg-blue-500 font-bold">Login</button>
          </div>
        </div>
      </div>
    );
  }

  if (screen === 'DEV_DASH') {
    return <DevDashboard db={db} setDb={setDb} setScreen={setScreen} />;
  }

  if (screen === 'SETTINGS') {
    const handleScenarioChange = (country, scenario) => {
      setSelectedCountry(country); setSelectedScenario(scenario);
      if (country === 'Custom') {
        setParties([{ id: 1, name: 'New Party', color: '#94a3b8', logo: '⬜', corePolicies: '', redLines: '', poll: 0, votes: 0 }]);
        setTotalSeats(100); setThreshold(5); return;
      }
      if (db[country] && db[country][scenario]) {
        const data = db[country][scenario];
        setTotalSeats(data.seats); setThreshold(data.threshold); setParties(JSON.parse(JSON.stringify(data.parties)));
      }
    };

    const updateParty = (id, field, value) => setParties(parties.map(p => p.id === id ? { ...p, [field]: value } : p));
    const addParty = () => {
      const newId = parties.length ? Math.max(...parties.map(p => p.id)) + 1 : 1;
      setParties([...parties, { id: newId, name: 'New Party', color: '#94a3b8', logo: '⬜', corePolicies: '', redLines: '', votes: 0, poll: 0 }]);
    };
    const removeParty = (id) => setParties(parties.filter(p => p.id !== id));

    return (
      <div className="max-w-6xl mx-auto p-6 py-12">
        <h2 className="text-3xl font-bold mb-6">Step 1: Set the Political Landscape</h2>
        <div className="flex flex-col md:flex-row items-center space-y-4 md:space-y-0 md:space-x-6 bg-white p-6 rounded-xl shadow-md mb-8 border-t-4 border-blue-600">
          <div className="w-full md:w-1/2">
            <label className="block text-sm font-bold text-gray-700 mb-2">1. Select Country</label>
            <select value={selectedCountry} onChange={(e) => { setSelectedCountry(e.target.value); setSelectedScenario(''); if (e.target.value === 'Custom') handleScenarioChange('Custom', 'Custom'); }} className="w-full p-3 border border-gray-300 rounded-lg font-semibold bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none">
              <option value="">-- Choose Country --</option>
              {Object.keys(db).map(key => <option key={key} value={key}>{key}</option>)}
              <option value="Custom">-- Custom Empty Sandbox --</option>
            </select>
          </div>
          <div className={`w-full md:w-1/2 transition-opacity duration-300 ${selectedCountry && selectedCountry !== 'Custom' ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
            <label className="block text-sm font-bold text-gray-700 mb-2">2. Load Election/Poll Scenario</label>
            <select value={selectedScenario} onChange={(e) => handleScenarioChange(selectedCountry, e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg font-semibold bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none">
              <option value="">-- Select Scenario --</option>
              {selectedCountry && db[selectedCountry] && Object.keys(db[selectedCountry]).map(key => <option key={key} value={key}>{key}</option>)}
            </select>
          </div>
        </div>

        <div className="space-y-4 mb-8">
          {parties.map(party => (
            <div key={party.id} className="bg-white p-4 rounded-lg shadow-sm border-l-8 transition-shadow hover:shadow-md" style={{ borderColor: party.color }}>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="col-span-1 text-center">
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Logo</label>
                  <input type="text" value={party.logo} onChange={(e) => updateParty(party.id, 'logo', e.target.value)} placeholder="URL or 🟦" className="w-full p-1 text-xs border rounded bg-gray-50 mb-1"/>
                  <div className="h-6 flex items-center justify-center">{renderLogo(party.logo, "max-h-6 max-w-full text-xl")}</div>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Name</label>
                  <input type="text" value={party.name} onChange={(e) => updateParty(party.id, 'name', e.target.value)} className="w-full p-2 border rounded bg-gray-50 font-semibold"/>
                </div>
                <div className="col-span-1">
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Color</label>
                  <input type="color" value={party.color} onChange={(e) => updateParty(party.id, 'color', e.target.value)} className="w-full h-10 border rounded cursor-pointer p-1"/>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Base Poll %</label>
                  <input type="number" step="0.1" value={party.poll} onChange={(e) => { updateParty(party.id, 'poll', e.target.value); updateParty(party.id, 'votes', e.target.value); }} className="w-full p-2 border rounded bg-blue-50 font-mono text-blue-900"/>
                </div>
                <div className="col-span-3">
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Core Demands</label>
                  <input type="text" value={party.corePolicies} placeholder="e.g., Free Trade" onChange={(e) => updateParty(party.id, 'corePolicies', e.target.value)} className="w-full p-2 border rounded bg-gray-50"/>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-red-500 uppercase mb-1">Red Lines</label>
                  <input type="text" value={party.redLines} placeholder="e.g., Wealth Tax" onChange={(e) => updateParty(party.id, 'redLines', e.target.value)} className="w-full p-2 border rounded border-red-200 bg-red-50"/>
                </div>
                <div className="col-span-1 flex items-end">
                  <button onClick={() => removeParty(party.id)} className="w-full p-2 bg-gray-100 text-gray-500 rounded hover:bg-red-100 hover:text-red-600 transition-colors">✕</button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow">
          <button onClick={addParty} className="font-bold text-blue-600 hover:text-blue-800 px-6 py-3 bg-blue-50 hover:bg-blue-100 rounded transition-colors">+ Add Party</button>
          <button onClick={() => { setCoalition([]); setScreen('GAME'); setDecisions({}); }} className="bg-slate-900 text-white font-bold py-3 px-10 rounded hover:bg-slate-800 transition-colors shadow-lg text-lg">Proceed to Election ➔</button>
        </div>
      </div>
    );
  }

  if (screen === 'GAME') {
    const updateVotes = (id, val) => setParties(parties.map(p => p.id === id ? { ...p, votes: Number(val) } : p));
    const toggleCoalition = (id) => setCoalition(prev => prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]);

    return (
      <div className="max-w-7xl mx-auto p-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold">Step 2: Results & Negotiation</h2>
          <button onClick={() => setScreen('NEGOTIATION')} className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded shadow-lg transition-transform hover:scale-105">Confirm Government ➔</button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-white p-6 rounded-xl shadow border-t-4 border-slate-900 flex flex-col">
              <div className="grid grid-cols-2 gap-4 mb-6 bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div>
                  <label className="block font-bold text-slate-700 mb-1 text-sm uppercase">Total Seats</label>
                  <input type="number" value={totalSeats} onChange={(e) => setTotalSeats(Number(e.target.value))} className="w-full p-2 border border-slate-300 rounded font-mono text-lg text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none bg-white"/>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1 text-sm uppercase">Threshold (%)</label>
                  <input type="number" step="0.1" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} className="w-full p-2 border border-slate-300 rounded font-mono text-lg text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none bg-white"/>
                </div>
              </div>

              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold">Adjust Results</h3>
                <span className={`font-bold px-3 py-1 rounded text-sm ${totalRawVotes > 100.1 ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-700'}`}>Total Counted: {totalRawVotes.toFixed(1)}%</span>
              </div>

              <div className="space-y-3 overflow-y-auto pr-2 max-h-96">
                <div className="grid grid-cols-12 gap-2 text-xs font-bold text-gray-400 uppercase px-2">
                  <div className="col-span-5">Party</div><div className="col-span-3 text-center">Base Poll</div><div className="col-span-4 text-right">Actual Result %</div>
                </div>
                {parties.map(party => {
                  const diff = (party.votes - party.poll).toFixed(1);
                  const eliminated = party.votes > 0 && party.votes < threshold;
                  return (
                    <div key={party.id} className={`grid grid-cols-12 gap-2 items-center p-3 rounded-lg border ${eliminated ? 'bg-red-50 border-red-200 opacity-70' : 'bg-white border-gray-200 shadow-sm'}`}>
                      <div className="col-span-5 flex items-center">
                        <span className="mr-3 flex items-center justify-center w-8 h-8">{renderLogo(party.logo, "max-w-full max-h-full text-2xl")}</span>
                        <span className="font-bold truncate text-base" style={{ color: party.color }}>{party.name}</span>
                      </div>
                      <div className="col-span-3 text-center font-mono text-gray-400 text-sm">{party.poll}%</div>
                      <div className="col-span-4 flex items-center justify-end relative">
                        <input type="number" min="0" max="100" step="0.1" value={party.votes} onChange={(e) => updateVotes(party.id, e.target.value)} className="border border-gray-300 rounded px-2 py-1 w-20 text-right font-mono bg-white focus:ring-2 focus:ring-blue-400 outline-none" />
                        <div className={`absolute -right-6 w-5 text-right text-xs font-bold ${diff > 0 ? 'text-green-500' : diff < 0 ? 'text-red-500' : 'text-transparent'}`}>{diff > 0 ? '▲' : '▼'}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <div className="bg-white p-6 rounded-xl shadow border-t-4 border-blue-600 flex flex-col">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold">Parliament Map</h3>
                <div className="bg-gray-100 rounded-lg p-1 flex text-sm font-bold shadow-inner">
                  <button onClick={() => setDisplayMode('seats')} className={`px-4 py-1.5 rounded-md transition-colors ${displayMode === 'seats' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>Seats</button>
                  <button onClick={() => setDisplayMode('percentage')} className={`px-4 py-1.5 rounded-md transition-colors ${displayMode === 'percentage' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>%</button>
                </div>
              </div>

              <div className="w-full h-14 bg-gray-200 rounded-xl overflow-hidden flex relative mb-8 shadow-inner border border-gray-300">
                <div className="absolute left-1/2 top-0 bottom-0 w-1 bg-slate-900 z-10 shadow-[0_0_5px_rgba(0,0,0,0.5)]"></div>
                {seatShares.map(party => (
                  <div key={party.id} style={{ width: `${party.seatPercentage}%`, backgroundColor: party.color }} className="h-full flex items-center justify-center text-white text-xs font-bold border-r border-white/20 transition-all duration-300 hover:opacity-90">
                    {party.seatPercentage > 4 ? (displayMode === 'seats' ? party.seats : party.seatPercentage.toFixed(1) + '%') : ''}
                  </div>
                ))}
              </div>

              <h3 className="text-lg font-bold mb-3 text-gray-700">Negotiating Table</h3>
              <div className="flex flex-wrap gap-3 mb-6">
                {seatShares.map(party => (
                  <button key={party.id} onClick={() => toggleCoalition(party.id)} className="px-4 py-2 rounded-lg border-2 font-bold transition-all shadow-sm flex items-center transform hover:-translate-y-1" style={{ backgroundColor: coalition.includes(party.id) ? party.color : 'white', borderColor: party.color, color: coalition.includes(party.id) ? 'white' : 'black' }}>
                    <span className="mr-2 flex items-center justify-center w-5 h-5">{renderLogo(party.logo, "max-w-full max-h-full")}</span>{party.name}
                    <span className="ml-3 px-2 py-0.5 rounded-md text-xs font-mono" style={{ backgroundColor: coalition.includes(party.id) ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.06)' }}>{displayMode === 'seats' ? party.seats : party.seatPercentage.toFixed(1) + '%'}</span>
                  </button>
                ))}
              </div>

              <div className={`mt-auto p-5 rounded-xl text-center border-2 transition-colors duration-300 ${isMajority ? 'bg-green-50 border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.2)]' : 'bg-red-50 border-red-300'}`}>
                <h4 className={`text-2xl font-bold mb-1 ${isMajority ? 'text-green-700' : 'text-red-700'}`}>{isMajority ? 'Majority Government Formed' : 'Hung Parliament'}</h4>
                <p className="text-lg font-mono font-semibold text-slate-800 mt-2">{coalitionSeats} / {majorityTarget} Seats Required</p>
              </div>

              {conflicts.length > 0 && (
                <div className="mt-4 p-4 bg-amber-50 border-l-4 border-amber-500 rounded-r-lg shadow-sm">
                  <h4 className="font-bold text-amber-800 mb-2 flex items-center"><span className="mr-2 text-xl">⚠️</span> Ideological Conflict Detected</h4>
                  <ul className="list-disc pl-8 text-sm text-amber-900 space-y-1 font-medium">{conflicts.map((c, idx) => <li key={idx}>{c}</li>)}</ul>
                </div>
              )}
            </div>

            <CompatibilityMatrix parties={parties} seatShares={seatShares} />
          </div>
        </div>
      </div>
    );
  }

  if (screen === 'NEGOTIATION') {
    return <NegotiationPhase seatShares={seatShares} coalition={coalition} coalitionMembers={coalitionMembers} handleDecision={handleNegotiationDecision} decisions={decisions} db={db} selectedCountry={selectedCountry} selectedScenario={selectedScenario} />;
  }

  if (screen === 'SUMMARY') {
    return (
      <div className="max-w-4xl mx-auto p-6 py-12">
        <h2 className="text-4xl font-bold mb-2 text-center">Final Government Data</h2>
        <p className="text-gray-600 text-center mb-8">Your coalition agreement and negotiated policies</p>

        <div className="bg-white p-8 rounded-2xl shadow-xl mb-8 text-left border border-gray-100">
          <div className="flex justify-between border-b border-gray-200 pb-4 mb-6">
            <span className="text-xl font-semibold text-gray-600">Government Classification:</span>
            <span className={`text-xl font-bold ${isMajority ? 'text-green-600' : 'text-red-600'}`}>{isMajority ? 'Majority (Stable)' : 'Minority (Fragile)'}</span>
          </div>

          <div className="mb-8">
            <h4 className="font-bold text-gray-500 uppercase text-xs tracking-wider mb-3">Coalition Members</h4>
            <div className="flex flex-wrap gap-2">
              {coalitionMembers.map(p => (
                <span key={p.id} className="px-4 py-2 rounded-lg text-white font-semibold shadow-sm flex items-center" style={{ backgroundColor: p.color }}>
                  <span className="mr-2 flex items-center justify-center w-5 h-5">{renderLogo(p.logo, "max-w-full max-h-full invert brightness-0 filter")}</span> {p.name} <span className="ml-2 opacity-75 font-mono text-sm">({p.seats})</span>
                </span>
              ))}
            </div>
          </div>

          <div className="mb-8 bg-gray-50 p-4 rounded-xl border border-gray-200">
            <h4 className="font-bold text-gray-500 uppercase text-xs tracking-wider mb-3">Parliamentary Control</h4>
            <div className="w-full bg-gray-300 rounded-full h-5 mb-3 overflow-hidden flex relative shadow-inner">
              <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-black z-10"></div>
              <div className="h-5 transition-all duration-1000" style={{ width: `${coalitionPercentage}%`, backgroundColor: '#3b82f6' }}></div>
            </div>
            <div className="flex justify-between items-center text-sm font-bold"><span className="text-gray-500">{totalSeats} Total Seats</span><span className="text-blue-600 text-lg">{coalitionSeats} Seats ({coalitionPercentage.toFixed(1)}%)</span></div>
          </div>

          {Object.keys(decisions).length > 0 && (
            <div className="mb-8">
              <h4 className="font-bold text-gray-500 uppercase text-xs tracking-wider mb-3">Negotiated Decisions</h4>
              <div className="space-y-2">
                {Object.entries(decisions).map(([conflictId, decision]) => (
                  <div key={conflictId} className="coalition-agreement-item" style={{ borderColor: '#3b82f6' }}>
                    <span className="text-lg">✓</span>
                    <div>
                      <div className="font-semibold text-gray-800">Decision Made</div>
                      <div className="agreement-decision">
                        {decision === 'support' && 'Policy demand from one party accepted'}
                        {decision === 'drop' && 'Contested policy dropped from platform'}
                        {decision === 'compromise' && 'Compromise version negotiated between parties'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <button onClick={resetGame} className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-4 px-10 rounded-full shadow-lg transition-transform hover:-translate-y-1 text-lg">↺ Start New Election</button>
      </div>
    );
  }
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
